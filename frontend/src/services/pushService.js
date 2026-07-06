/**
 * Servicio de suscripción a Push Notifications via Web Push API.
 * Gestiona la suscripción del navegador al servidor de push y la sincronización con el backend.
 */

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

/**
 * Convierte una clave VAPID base64url a Uint8Array para PushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Obtiene la clave pública VAPID del backend
 */
async function getVapidPublicKey() {
  try {
    const response = await fetch(`${API_URL}/push/vapid-public-key`)
    if (!response.ok) return null
    const data = await response.json()
    if (!data.available || !data.publicKey) return null
    return data.publicKey
  } catch (e) {
    console.warn('⚠️ No se pudo obtener la clave VAPID:', e.message)
    return null
  }
}

/**
 * Suscribe al usuario a push notifications.
 * Requiere que el Service Worker esté registrado y permisos de notificación concedidos.
 * @param {boolean} force - Si true, elimina la suscripción existente antes de crear una nueva.
 * @returns {PushSubscription|null}
 */
export async function subscribeToPush(force = false) {
  const log = (msg) => console.log(`[Push] ${msg}`)
  const warn = (msg) => console.warn(`[Push] ${msg}`)
  const err = (msg, e) => console.error(`[Push] ${msg}`, e)

  try {
    // 1. Verificar soporte
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      warn('❌ Push no soportado en este navegador')
      localStorage.setItem('scolyax.pushError', 'Browser no soporta PushManager')
      return null
    }
    log('1/7 ✅ Navegador soporta push')

    // 2. Verificar permiso de notificaciones
    if (Notification.permission !== 'granted') {
      log('2/7 Solicitando permiso de notificaciones...')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        warn(`2/7 ❌ Permiso denegado: ${permission}`)
        localStorage.setItem('scolyax.pushError', `Permiso: ${permission}`)
        return null
      }
    }
    log('2/7 ✅ Permisos concedidos')

    // 3. Obtener clave VAPID del backend
    log(`3/7 Obteniendo VAPID de ${API_URL}...`)
    const vapidKey = await getVapidPublicKey()
    if (!vapidKey) {
      warn('3/7 ❌ Sin clave VAPID del servidor')
      localStorage.setItem('scolyax.pushError', 'Sin clave VAPID del servidor')
      return null
    }
    log(`3/7 ✅ VAPID obtenida: ${vapidKey.substring(0, 20)}...`)

    // 4. Obtener registro del Service Worker (con timeout)
    log('4/7 Esperando Service Worker...')
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout (10s)')), 10000))
    ])
    log(`4/7 ✅ Service Worker activo: ${registration.scope}`)

    // 5. Verificar si ya hay suscripción existente
    let subscription = await registration.pushManager.getSubscription()

    if (subscription && force) {
      // Forzar renovación: eliminar suscripción vieja
      log('5/7 🔄 Forzando renovación — eliminando suscripción anterior...')
      try {
        const oldEndpoint = subscription.endpoint
        await subscription.unsubscribe()
        // Notificar al backend que la suscripción fue eliminada
        const token = localStorage.getItem('scolyax.sessionToken')
        if (token) {
          await fetch(`${API_URL}/push/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ endpoint: oldEndpoint })
          }).catch(() => {})
        }
        subscription = null
        log('5/7 Suscripción anterior eliminada')
      } catch (e) {
        warn('5/7 No se pudo eliminar suscripción anterior:', e.message)
        subscription = null
      }
    }

    if (!subscription) {
      // 6. Crear nueva suscripción
      log('5/7 Creando nueva suscripción push...')
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      })
      log('5/7 ✅ Nueva suscripción creada')
    } else {
      log('5/7 ✅ Suscripción existente reutilizada (sin cambios)')
    }
    log(`6/7 Endpoint: ${subscription.endpoint.substring(0, 60)}...`)

    // 7. Enviar suscripción al backend
    const token = localStorage.getItem('scolyax.sessionToken')
    if (!token) {
      warn('7/7 ❌ Sin token de sesión — no se puede guardar en servidor')
      localStorage.setItem('scolyax.pushError', 'Sin token de sesión')
      return subscription
    }

    log('7/7 Enviando suscripción al servidor...')
    const subJson = subscription.toJSON()
    const response = await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(subJson)
    })
    
    if (response.ok) {
      log('7/7 ✅ ¡Suscripción push guardada en el servidor!')
      localStorage.setItem('scolyax.pushSubscribed', 'true')
      localStorage.setItem('scolyax.pushSubscribedAt', new Date().toISOString())
      localStorage.removeItem('scolyax.pushError')

      // Sincronizar config con el SW (incluyendo clave VAPID para renovar suscripciones)
      await _syncConfigToServiceWorker(vapidKey)
    } else {
      const errorText = await response.text().catch(() => 'unknown')
      warn(`7/7 ❌ Servidor rechazó suscripción: ${response.status} — ${errorText}`)
      localStorage.setItem('scolyax.pushError', `Server ${response.status}: ${errorText}`)
    }

    return subscription
  } catch (error) {
    err('❌ Error en subscribeToPush:', error)
    localStorage.setItem('scolyax.pushError', error.message)
    return null
  }
}

/**
 * Cancela la suscripción push del usuario.
 */
export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    
    if (subscription) {
      const endpoint = subscription.endpoint

      // Cancelar en el navegador
      await subscription.unsubscribe()

      // Notificar al backend
      const token = localStorage.getItem('scolyax.sessionToken')
      if (token) {
        await fetch(`${API_URL}/push/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ endpoint })
        })
      }
      
      localStorage.removeItem('scolyax.pushSubscribed')
      console.log('✅ Suscripción push cancelada')
    }
  } catch (error) {
    console.error('❌ Error cancelando suscripción push:', error)
  }
}

/**
 * Envía una notificación push de prueba.
 * Retorna el objeto de diagnóstico completo del servidor.
 */
export async function sendTestPush() {
  try {
    const token = localStorage.getItem('scolyax.sessionToken')
    if (!token) return { status: 'error', sent: 0, total_subs: 0, reason: 'Sin sesión activa' }

    const response = await fetch(`${API_URL}/push/test`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) {
      return { status: 'error', sent: 0, total_subs: 0, reason: `HTTP ${response.status}` }
    }
    return await response.json()
  } catch (error) {
    console.error('❌ Error enviando push de prueba:', error)
    return { status: 'error', sent: 0, total_subs: 0, reason: error.message }
  }
}

/**
 * Verifica si el usuario está suscrito a push
 */
export async function isPushSubscribed() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}

/**
 * Inicializa push notifications automáticamente.
 * Se llama al iniciar la app cuando hay sesión activa.
 * Siempre intenta suscribir si los permisos están concedidos.
 */
export async function initPushNotifications() {
  try {
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (!localStorage.getItem('scolyax.sessionToken')) return
    
    console.log('[Push] 🔄 Iniciando auto-suscripción push...')
    const sub = await subscribeToPush()
    
    if (!sub) {
      // Reintentar una vez después de 3 segundos
      console.log('[Push] ⏳ Reintentando suscripción en 3s...')
      setTimeout(async () => {
        try {
          await subscribeToPush()
        } catch (e) {
          console.debug('[Push] Reintento fallido:', e.message)
        }
      }, 3000)
    }

    // Pasar API URL, token y VAPID key al Service Worker para background sync
    await _syncConfigToServiceWorker()

    // Registrar periodic background sync (para procesar notificaciones con la app cerrada)
    await _registerPeriodicSync()
  } catch (error) {
    console.debug('[Push] init error:', error.message)
  }
}

/**
 * Envía la configuración (API URL, token, VAPID) al Service Worker para que pueda
 * hacer requests en background sin que la app esté abierta.
 * Espera hasta 3s a que el controller esté disponible si aún no lo está.
 */
async function _syncConfigToServiceWorker(vapidKey = null) {
  try {
    // Esperar hasta 3s a que el SW tome control (puede ser null en la primera carga)
    let controller = navigator.serviceWorker.controller
    if (!controller) {
      controller = await Promise.race([
        new Promise((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            resolve(navigator.serviceWorker.controller)
          }, { once: true })
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), 3000))
      ])
    }
    if (!controller) return

    const token = localStorage.getItem('scolyax.sessionToken')

    controller.postMessage({ type: 'SET_API_URL', apiUrl: API_URL })

    if (token) {
      controller.postMessage({ type: 'SET_SESSION_TOKEN', token: token })
    }

    // Guardar clave VAPID en el SW para que pueda renovar suscripciones si expiran
    if (vapidKey) {
      controller.postMessage({ type: 'SET_VAPID_KEY', vapidKey: vapidKey })
    }
  } catch (e) {
    console.debug('SW config sync:', e.message)
  }
}

/**
 * Registra periodic background sync para que el navegador despierte el SW
 * periódicamente y procese notificaciones pendientes del servidor.
 * Solo funciona en Chrome/Edge con PWA instalada.
 */
async function _registerPeriodicSync() {
  try {
    const registration = await navigator.serviceWorker.ready
    
    // Verificar si el navegador soporta periodic sync
    if (!('periodicSync' in registration)) {
      console.debug('Periodic Background Sync no soportado')
      return
    }

    // Verificar permiso
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' })
    if (status.state !== 'granted') {
      console.debug('Periodic sync permission:', status.state)
      return
    }

    // Registrar con intervalo mínimo (el navegador decide el real, ~12h mínimo)
    await registration.periodicSync.register('process-pending-notifications', {
      minInterval: 15 * 60 * 1000  // 15 minutos mínimo solicitado
    })
    console.log('✅ Periodic background sync registrado para notificaciones')
  } catch (e) {
    console.debug('Periodic sync:', e.message)
  }
}

/**
 * Obtiene el estado del sistema de push notifications desde el servidor.
 * @returns {Object|null} Estado con diagnóstico completo
 */
export async function getPushStatus() {
  try {
    const token = localStorage.getItem('scolyax.sessionToken')
    if (!token) return null

    const response = await fetch(`${API_URL}/push/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.debug('Push status:', error.message)
    return null
  }
}

/**
 * Obtiene las notificaciones push programadas del usuario.
 * @returns {Object} { pending: [], sent: [] }
 */
export async function getScheduledNotifications() {
  try {
    const token = localStorage.getItem('scolyax.sessionToken')
    if (!token) return { pending: [], sent: [] }

    const response = await fetch(`${API_URL}/push/scheduled`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) return { pending: [], sent: [] }
    return await response.json()
  } catch (error) {
    console.debug('Scheduled notifications:', error.message)
    return { pending: [], sent: [] }
  }
}

/**
 * Fuerza el procesamiento inmediato de notificaciones pendientes.
 */
export async function processNotificationsNow() {
  try {
    const token = localStorage.getItem('scolyax.sessionToken')
    if (!token) return false

    const response = await fetch(`${API_URL}/push/process-now`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    return response.ok
  } catch (error) {
    console.debug('Process now:', error.message)
    return false
  }
}
