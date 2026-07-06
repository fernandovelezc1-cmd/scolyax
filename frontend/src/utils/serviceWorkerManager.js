/**
 * Utilidad para registrar el Service Worker
 * Gestiona el ciclo de vida del SW y actualizaciones
 */

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('⚠️ Service Workers no soportados en este navegador')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    })

    console.log('✅ Service Worker registrado:', registration.scope)

    // Listener para actualizaciones
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      console.log('🆕 Nueva versión del Service Worker encontrada')

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
          // Nuevo SW activado y con control → recargar para servir assets frescos
          console.log('📦 Nuevo SW activado, recargando para aplicar cambios...')
          window.location.reload()
        }
      })
    })

    // Cuando el SW cambia de controlador, recargar SOLO si había un SW previo
    // (actualización real). En primera instalación no hay controller previo → no recargar,
    // para que beforeinstallprompt pueda dispararse normalmente.
    const previousController = navigator.serviceWorker.controller
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (previousController !== null) {
        console.log('🔄 SW actualizado — recargando para aplicar nueva versión...')
        window.location.reload()
      }
    })

    // Verificar actualizaciones cada hora
    setInterval(() => {
      registration.update()
    }, 60 * 60 * 1000)

    return registration
  } catch (error) {
    console.error('❌ Error registrando Service Worker:', error)
    return null
  }
}

/**
 * Desregistra el Service Worker (útil para desarrollo)
 */
export async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      const success = await registration.unregister()
      console.log('🗑️ Service Worker desregistrado:', success)
      return success
    }
    return false
  } catch (error) {
    console.error('❌ Error desregistrando Service Worker:', error)
    return false
  }
}

/**
 * Verifica si el Service Worker está activo
 */
export function isServiceWorkerActive() {
  return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null
}

/**
 * Envía un mensaje al Service Worker
 */
export async function sendMessageToSW(message) {
  if (!isServiceWorkerActive()) {
    console.warn('⚠️ Service Worker no está activo')
    return
  }

  try {
    navigator.serviceWorker.controller.postMessage(message)
  } catch (error) {
    console.error('❌ Error enviando mensaje al SW:', error)
  }
}

/**
 * Fuerza la activación de un nuevo Service Worker
 */
export async function skipWaiting() {
  if (!isServiceWorkerActive()) {
    return
  }

  sendMessageToSW({ type: 'SKIP_WAITING' })
  window.location.reload()
}

/**
 * Limpia todas las caches
 */
export async function clearAllCaches() {
  if (!('caches' in window)) {
    return
  }

  try {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames.map(name => caches.delete(name))
    )
    console.log('🧹 Todas las caches limpiadas')
  } catch (error) {
    console.error('❌ Error limpiando caches:', error)
  }
}

/**
 * Muestra notificación de actualización disponible
 */
function showUpdateNotification() {
  // Detectar si es móvil
  const isMobile = window.innerWidth <= 768
  
  // Crear notificación personalizada
  const notification = document.createElement('div')
  notification.className = 'sw-update-notification'
  
  // Estructura HTML
  const content = document.createElement('div')
  content.style.cssText = isMobile 
    ? `
      display: flex;
      flex-direction: column;
      gap: 12px;
      text-align: center;
    `
    : `
      display: flex;
      align-items: center;
      gap: 16px;
    `
  
  const icon = document.createElement('span')
  icon.textContent = '🔄'
  icon.style.cssText = isMobile
    ? `
      font-size: 28px;
      display: block;
    `
    : `
      font-size: 32px;
      flex-shrink: 0;
    `
  
  const textContainer = document.createElement('div')
  textContainer.style.cssText = isMobile
    ? `
      flex: 1;
    `
    : `
      flex: 1;
      min-width: 0;
    `
  
  const title = document.createElement('strong')
  title.textContent = 'Nueva versión disponible'
  title.style.cssText = isMobile
    ? `
      display: block;
      font-size: 15px;
      margin-bottom: 4px;
      color: #ffffff;
    `
    : `
      display: block;
      font-size: 16px;
      margin-bottom: 4px;
      color: #ffffff;
    `
  
  const description = document.createElement('p')
  description.textContent = isMobile ? 'Actualización lista' : 'Hay una actualización de Scolyax lista para instalar'
  description.style.cssText = isMobile
    ? `
      margin: 0;
      font-size: 13px;
      opacity: 0.9;
      color: #ffffff;
      line-height: 1.3;
    `
    : `
      margin: 0;
      font-size: 14px;
      opacity: 0.95;
      color: #ffffff;
      line-height: 1.4;
    `
  
  const button = document.createElement('button')
  button.textContent = 'Actualizar'
  button.style.cssText = isMobile
    ? `
      background: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(10px);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 10px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
      width: 100%;
    `
    : `
      background: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(10px);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
      white-space: nowrap;
      flex-shrink: 0;
    `
  button.onmouseover = () => {
    button.style.background = 'rgba(255, 255, 255, 0.35)'
    button.style.transform = 'translateY(-1px)'
  }
  button.onmouseout = () => {
    button.style.background = 'rgba(255, 255, 255, 0.25)'
    button.style.transform = 'translateY(0)'
  }
  button.onclick = () => window.location.reload()

  textContainer.appendChild(title)
  textContainer.appendChild(description)
  
  if (isMobile) {
    content.appendChild(icon)
    content.appendChild(textContainer)
    content.appendChild(button)
  } else {
    content.appendChild(icon)
    content.appendChild(textContainer)
    content.appendChild(button)
  }
  
  notification.appendChild(content)

  // Estilos del contenedor principal
  notification.style.cssText = isMobile
    ? `
      position: fixed;
      bottom: 16px;
      left: 16px;
      right: 16px;
      background: linear-gradient(135deg, #c9d62f 0%, #c8de1f 100%);
      color: #ffffff;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
      z-index: 10001;
      animation: slideInFromBottom 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    `
    : `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #c9d62f 0%, #c8de1f 100%);
      color: #ffffff;
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
      z-index: 10001;
      max-width: 420px;
      animation: slideInFromRight 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    `

  // Agregar estilos de animación al documento si no existen
  if (!document.getElementById('sw-update-styles')) {
    const style = document.createElement('style')
    style.id = 'sw-update-styles'
    style.textContent = `
      @keyframes slideInFromRight {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes slideOutToRight {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100px);
        }
      }
      @keyframes slideInFromBottom {
        from {
          opacity: 0;
          transform: translateY(100px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes slideOutToBottom {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(100px);
        }
      }
    `
    document.head.appendChild(style)
  }

  document.body.appendChild(notification)

  // Auto-remover después de 12 segundos
  setTimeout(() => {
    notification.style.animation = isMobile 
      ? 'slideOutToBottom 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      : 'slideOutToRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    setTimeout(() => notification.remove(), 300)
  }, 12000)
}

/**
 * Solicita permiso de notificaciones y registra push
 */
export async function registerPushNotifications() {
  if (!('Notification' in window) || !('PushManager' in window)) {
    console.warn('⚠️ Push notifications no soportadas')
    return null
  }

  try {
    const permission = await Notification.requestPermission()
    
    if (permission !== 'granted') {
      console.log('⚠️ Permiso de notificaciones denegado')
      return null
    }

    const registration = await navigator.serviceWorker.ready
    
    // Aquí se puede agregar la suscripción al servidor de push
    // Por ahora solo retornamos el registration
    return registration
  } catch (error) {
    console.error('❌ Error registrando push notifications:', error)
    return null
  }
}

/**
 * Verifica el estado de sincronización en background
 */
export async function checkBackgroundSyncSupport() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    console.warn('⚠️ Background Sync no soportado')
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    return 'sync' in registration
  } catch {
    return false
  }
}

// Agregar estilos para la notificación de actualización
const styles = document.createElement('style')
styles.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  .sw-update-notification__content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .sw-update-notification__icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .sw-update-notification__text {
    flex: 1;
  }

  .sw-update-notification__text strong {
    display: block;
    font-size: 16px;
    margin-bottom: 4px;
  }

  .sw-update-notification__text p {
    font-size: 14px;
    opacity: 0.9;
    margin: 0;
  }

  .sw-update-notification__btn {
    background: white;
    color: #c9d62f;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .sw-update-notification__btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  @media (max-width: 768px) {
    .sw-update-notification {
      bottom: 10px !important;
      right: 10px !important;
      left: 10px !important;
      max-width: none !important;
    }

    .sw-update-notification__content {
      flex-direction: column;
      text-align: center;
    }

    .sw-update-notification__btn {
      width: 100%;
    }
  }
`
document.head.appendChild(styles)

export default {
  registerServiceWorker,
  unregisterServiceWorker,
  isServiceWorkerActive,
  sendMessageToSW,
  skipWaiting,
  clearAllCaches,
  registerPushNotifications,
  checkBackgroundSyncSupport
}
