/**
 * Service Worker para Scolyax PWA
 * Gestiona cache, offline y notificaciones push
 * Version: 2.6.1 - CSS rating modal update
 */

const CACHE_NAME = 'scolyax-v2.6.1'
const RUNTIME_CACHE = 'scolyax-runtime-v2.6.1'
const IMAGE_CACHE = 'scolyax-images-v2.6.1'

// ========== Helper VAPID (requerido para pushsubscriptionchange) ==========
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// ========== IndexedDB para config persistente (sobrevive reinicios del SW) ==========
const IDB_NAME = 'scolyax-sw-config'
const IDB_STORE = 'config'

function _openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key) {
  try {
    const db = await _openIDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch { return undefined }
}

async function idbSet(key, value) {
  try {
    const db = await _openIDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* ignore */ }
}

// Recursos críticos para funcionamiento offline
// Solo incluir archivos que realmente existen
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
]

// Estrategia: Cache First para assets estáticos
const CACHE_FIRST_URLS = [
  /\.css$/,
  /\.js$/,
  /\.woff2?$/,
  /\.ttf$/,
  /\.eot$/,
  /\.svg$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.webp$/
]

// Estrategia: Network First para API calls
const NETWORK_FIRST_URLS = [
  /\/api\//
]

// ========== INSTALACIÓN ==========
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Instalando...')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Cacheando recursos críticos')
        return cache.addAll(PRECACHE_URLS)
      })
      .then(() => {
        console.log('✅ Service Worker: Instalación completa')
        return self.skipWaiting() // Activar inmediatamente
      })
      .catch((error) => {
        console.error('❌ Service Worker: Error en instalación', error)
      })
  )
})

// ========== ACTIVACIÓN ==========
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activando...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        console.log('🗑️ Service Worker: Limpiando todos los caches antiguos')
        // Eliminar TODOS los caches antiguos (no solo los nuestros)
        return Promise.all(
          cacheNames.map((name) => {
            console.log('🗑️ Service Worker: Eliminando cache:', name)
            return caches.delete(name)
          })
        )
      })
      .then(() => {
        console.log('✅ Service Worker: Activación completa - todos los caches eliminados')
        return self.clients.claim() // Tomar control de todas las páginas
      })
  )
})

// ========== FETCH HANDLER ==========
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar requests no HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return
  }

  // Ignorar chrome-extension y otros protocolos
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return
  }

  // Estrategia basada en el tipo de recurso
  if (NETWORK_FIRST_URLS.some(pattern => pattern.test(request.url))) {
    // Network First para APIs
    event.respondWith(networkFirst(request))
  } else if (CACHE_FIRST_URLS.some(pattern => pattern.test(request.url))) {
    // Cache First para assets estáticos
    event.respondWith(cacheFirst(request))
  } else if (url.origin === location.origin) {
    // Stale While Revalidate para mismo origen
    event.respondWith(staleWhileRevalidate(request))
  } else {
    // Network Only para recursos externos
    event.respondWith(fetch(request))
  }
})

// ========== ESTRATEGIA: CACHE FIRST ==========
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  
  if (cached) {
    console.log('📦 Cache Hit:', request.url)
    return cached
  }
  
  console.log('🌐 Cache Miss, fetching:', request.url)
  try {
    const response = await fetch(request)
    
    // Solo cachear respuestas exitosas (200-299)
    if (response.ok && response.status >= 200 && response.status < 300) {
      // Determinar cache correcto
      const cacheToUse = request.url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)
        ? IMAGE_CACHE
        : CACHE_NAME
      
      const cacheStorage = await caches.open(cacheToUse)
      cacheStorage.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.error('❌ Fetch failed:', error)
    return getOfflineFallback(request)
  }
}

// ========== ESTRATEGIA: NETWORK FIRST ==========
async function networkFirst(request) {
  const url = new URL(request.url)
  
  // En desarrollo, permitir localhost
  // En producción (no localhost:5173), permitir todas las APIs
  
  try {
    const response = await fetch(request)
    
    if (response.ok) {
      // Solo cachear GET y HEAD (DELETE, PUT, POST no son cacheables por la Cache API)
      // No cachear localhost en desarrollo
      const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
      if ((request.method === 'GET' || request.method === 'HEAD') && !isLocalhost) {
        const cache = await caches.open(RUNTIME_CACHE)
        cache.put(request, response.clone())
      }
    }
    
    return response
  } catch (error) {
    console.log('🔌 Offline, intentando cache:', request.url)
    const cached = await caches.match(request)
    
    if (cached) {
      return cached
    }
    
    return getOfflineFallback(request)
  }
}

// ========== ESTRATEGIA: STALE WHILE REVALIDATE ==========
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => cached || getOfflineFallback(request))
  
  return cached || fetchPromise
}

// ========== OFFLINE FALLBACK ==========
function getOfflineFallback(request) {
  const url = new URL(request.url)
  
  // Para páginas HTML, retornar offline page
  if (request.headers.get('accept').includes('text/html')) {
    return new Response(
      generateOfflinePage(),
      {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store'
        }
      }
    )
  }
  
  // Para APIs, retornar JSON con error
  if (url.pathname.includes('/api/')) {
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'Sin conexión. Los datos se sincronizarán cuando vuelvas a estar online.'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  
  // Para imágenes, retornar placeholder
  if (request.headers.get('accept').includes('image')) {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#667eea" width="200" height="200"/><text fill="#fff" font-size="16" x="50%" y="50%" text-anchor="middle">Offline</text></svg>',
      {
        headers: { 'Content-Type': 'image/svg+xml' }
      }
    )
  }
  
  // Default: 503 Service Unavailable
  return new Response('Offline', { status: 503 })
}

// ========== PÁGINA OFFLINE ==========
function generateOfflinePage() {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sin conexión - Scolyax</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          padding: 20px;
        }
        
        .offline-container {
          text-align: center;
          max-width: 500px;
        }
        
        .offline-icon {
          font-size: 80px;
          margin-bottom: 20px;
          animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        h1 {
          font-size: 32px;
          margin-bottom: 16px;
          font-weight: 700;
        }
        
        p {
          font-size: 18px;
          line-height: 1.6;
          margin-bottom: 24px;
          opacity: 0.9;
        }
        
        .features {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          margin: 24px 0;
          backdrop-filter: blur(10px);
        }
        
        .features h2 {
          font-size: 20px;
          margin-bottom: 16px;
        }
        
        .features ul {
          list-style: none;
          text-align: left;
        }
        
        .features li {
          padding: 8px 0;
          padding-left: 28px;
          position: relative;
        }
        
        .features li:before {
          content: "✓";
          position: absolute;
          left: 0;
          font-weight: bold;
          color: #4ade80;
        }
        
        button {
          background: white;
          color: #667eea;
          border: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }
        
        button:active {
          transform: translateY(0);
        }
        
        .status {
          margin-top: 20px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-size: 14px;
        }
        
        .status.checking {
          background: rgba(251, 191, 36, 0.2);
        }
        
        .status.online {
          background: rgba(74, 222, 128, 0.2);
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">🔌</div>
        <h1>Sin conexión a Internet</h1>
        <p>No te preocupes, Scolyax sigue funcionando en modo offline.</p>
        
        <div class="features">
          <h2>Disponible sin conexión:</h2>
          <ul>
            <li>Ver tareas guardadas</li>
            <li>Crear nuevas tareas (se sincronizarán después)</li>
            <li>Usar temporizador Pomodoro</li>
            <li>Ver recordatorios locales</li>
            <li>Acceder a resúmenes guardados</li>
          </ul>
        </div>
        
        <button onclick="checkConnection()">Reintentar conexión</button>
        
        <div id="status" class="status"></div>
      </div>
      
      <script>
        function checkConnection() {
          const status = document.getElementById('status');
          status.className = 'status checking';
          status.textContent = '🔄 Verificando conexión...';
          
          fetch('/manifest.json', { method: 'HEAD', cache: 'no-store' })
            .then(response => {
              if (response.ok) {
                status.className = 'status online';
                status.textContent = '✅ ¡Conexión restaurada! Redirigiendo...';
                setTimeout(() => {
                  window.location.href = '/';
                }, 1500);
              } else {
                throw new Error('No connection');
              }
            })
            .catch(() => {
              status.className = 'status';
              status.textContent = '❌ Aún sin conexión. Intenta más tarde.';
              setTimeout(() => {
                status.textContent = '';
              }, 3000);
            });
        }
        
        // Auto-check cada 30 segundos
        setInterval(() => {
          if (navigator.onLine) {
            checkConnection();
          }
        }, 30000);
        
        // Listener de online
        window.addEventListener('online', () => {
          checkConnection();
        });
      </script>
    </body>
    </html>
  `
}

// ========== NOTIFICACIONES PUSH ==========
// CRÍTICO: Este handler DEBE ser a prueba de fallos.
// Si falla sin mostrar notificación, Chrome penaliza al SW y deja de
// despertarlo para pushes futuros (incluso con la app cerrada).
self.addEventListener('push', (event) => {
  console.log('📬 Push recibido en SW (background-safe)')

  // Parsear datos de forma segura — NUNCA dejar que un error evite showNotification
  let data = {}
  try {
    if (event.data) {
      data = event.data.json()
    }
  } catch (parseErr) {
    console.warn('⚠️ Push payload no es JSON válido, usando fallback:', parseErr.message)
    try {
      data = { body: event.data ? event.data.text() : '' }
    } catch { /* ignore */ }
  }

  const title = data.title || 'Scolyax'
  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: '/web-app-manifest-192x192.png',
    badge: '/web-app-manifest-192x192.png',
    tag: data.tag || 'scolyax-notification-' + Date.now(),
    renotify: true,
    requireInteraction: !!data.requireInteraction,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    data: {
      ...(typeof data === 'object' ? data : {}),
      dateTime: new Date().toISOString(),
      url: data.url || '/'
    },
    actions: data.actions || [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Descartar' }
    ],
    dir: 'ltr',
    lang: 'es-ES'
  }

  // Solo agregar image si viene explícitamente en el payload
  if (data.image) {
    options.image = data.image
  }

  // SOLO mostrar la notificación — el backend scheduler ya envía todas las
  // notificaciones pendientes cada 30s. Añadir fetch aquí crea un feedback loop
  // y extiende el tiempo del evento, lo que hace que Chrome penalice el SW
  // y deje de despertarlo para pushes futuros cuando la PWA está cerrada.
  event.waitUntil(
    self.registration.showNotification(title, options).catch((notifErr) => {
      console.error('❌ Error mostrando notificación, intentando fallback:', notifErr)
      return self.registration.showNotification('Scolyax', {
        body: 'Tienes una actualización pendiente',
        icon: '/web-app-manifest-192x192.png',
        tag: 'scolyax-fallback-' + Date.now()
      })
    })
  )
})

// ========== CLICK EN NOTIFICACIÓN ==========
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Click en notificación:', event.notification.tag)
  event.notification.close()
  
  const urlToOpen = event.notification.data?.url || '/'
  
  // Si se hizo click en una acción
  if (event.action === 'close') {
    console.log('✋ Notificación descartada por usuario')
    return
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana abierta con la misma URL, enfocarla
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        
        // Si hay cualquier ventana de Scolyax, enfocarla y navega
        for (const client of clientList) {
          if (client.url.includes(location.origin) && 'focus' in client) {
            client.focus()
            return client.navigate(urlToOpen)
          }
        }
        
        // Si no, abrir nueva ventana
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

// ========== SINCRONIZACIÓN (ver handlers en PERIODIC BACKGROUND SYNC más abajo) ==========

// ========== MENSAJES DEL CLIENTE ==========
self.addEventListener('message', (event) => {
  console.log('📨 Mensaje recibido:', event.data)
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        )
      })
    )
  }

  // Guardar la API URL para background sync (en memoria Y en IndexedDB para persistencia)
  if (event.data.type === 'SET_API_URL') {
    self._scolyaxApiUrl = event.data.apiUrl
    idbSet('apiUrl', event.data.apiUrl)
  }

  // Guardar session token para background sync (en memoria Y en IndexedDB)
  if (event.data.type === 'SET_SESSION_TOKEN') {
    self._scolyaxSessionToken = event.data.token
    idbSet('sessionToken', event.data.token)
  }

  // Guardar clave VAPID para renovar suscripción si expira (pushsubscriptionchange)
  if (event.data.type === 'SET_VAPID_KEY') {
    self._scolyaxVapidKey = event.data.vapidKey
    idbSet('vapidPublicKey', event.data.vapidKey)
  }

  // Mostrar notificación local desde el frontend (funciona en background)
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data
    event.waitUntil(
      self.registration.showNotification(title || 'Scolyax', {
        icon: '/web-app-manifest-192x192.png',
        badge: '/web-app-manifest-192x192.png',
        vibrate: [200, 100, 200],
        tag: 'local-notification',
        renotify: true,
        data: { url: '/' },
        actions: [
          { action: 'open', title: 'Abrir' },
          { action: 'close', title: 'Descartar' }
        ],
        ...options
      })
    )
  }
})

// ========== PERIODIC BACKGROUND SYNC (navegadores que lo soportan) ==========
// Esto permite que el SW despierte periódicamente y pida al servidor
// que procese notificaciones pendientes, incluso con la app cerrada.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'process-pending-notifications') {
    console.log('🔄 Periodic sync: procesando notificaciones pendientes')
    event.waitUntil(triggerServerNotificationProcessing())
  }
})

// También usar el sync normal como fallback
self.addEventListener('sync', (event) => {
  console.log('🔄 Sincronización en background:', event.tag)
  
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks())
  }
  
  if (event.tag === 'sync-reminders') {
    event.waitUntil(syncReminders())
  }

  if (event.tag === 'process-notifications') {
    event.waitUntil(triggerServerNotificationProcessing())
  }
})

/**
 * Llama al backend para que procese y envíe notificaciones push pendientes.
 * Esto funciona en background sin que la app esté abierta.
 */
async function triggerServerNotificationProcessing() {
  try {
    // Leer config de memoria primero, si no está, leer de IndexedDB (persiste entre reinicios del SW)
    let apiUrl = self._scolyaxApiUrl || await idbGet('apiUrl')
    let token = self._scolyaxSessionToken || await idbGet('sessionToken')

    // Guardar en memoria para próximas llamadas
    if (apiUrl) self._scolyaxApiUrl = apiUrl
    if (token) self._scolyaxSessionToken = token

    if (!apiUrl || !token) {
      console.debug('⚠️ No hay API URL o token para sync de notificaciones')
      return
    }

    const response = await fetch(`${apiUrl}/push/process-now`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.sent > 0) {
        console.log(`📬 Background sync: ${data.sent} notificaciones procesadas`)
      }
    }
  } catch (error) {
    console.debug('Background notification sync skipped:', error.message)
  }
}

async function syncTasks() {
  console.log('🔄 Sincronizando tareas...')
  // Aquí iría la lógica de sincronización
}

async function syncReminders() {
  console.log('🔄 Sincronizando recordatorios...')
  // Aquí iría la lógica de sincronización
}

// ========== PUSH SUBSCRIPTION CHANGE ==========
// Si la suscripción push cambia (expira, se renueva), re-suscribir automáticamente
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('🔄 Push subscription changed, re-subscribing...')
  event.waitUntil(
    (async () => {
      try {
        // Usar clave VAPID almacenada para la re-suscripción
        const storedVapidKey = self._scolyaxVapidKey || await idbGet('vapidPublicKey')
        let applicationServerKey = event.oldSubscription?.options?.applicationServerKey
        if (!applicationServerKey && storedVapidKey) {
          applicationServerKey = urlBase64ToUint8Array(storedVapidKey)
        }
        const newSubscription = await self.registration.pushManager.subscribe(
          applicationServerKey
            ? { userVisibleOnly: true, applicationServerKey }
            : { userVisibleOnly: true }
        )
        // Leer config de IndexedDB (self._ puede estar vacío tras reinicio del SW)
        const apiUrl = self._scolyaxApiUrl || await idbGet('apiUrl')
        const token = self._scolyaxSessionToken || await idbGet('sessionToken')
        if (!apiUrl || !token) {
          console.warn('⚠️ No hay config para reenviar suscripción al backend')
          return
        }
        await fetch(`${apiUrl}/push/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(newSubscription.toJSON())
        })
        console.log('✅ Push subscription renewed')
      } catch (err) {
        console.error('❌ Failed to renew push subscription:', err)
      }
    })()
  )
})

console.log('🎯 Service Worker cargado y listo')