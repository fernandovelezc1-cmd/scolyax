/**
 * NotificationCenter - Centro de notificaciones con soporte para Push
 */
import React, { useState, useEffect, useCallback } from 'react'
import ConfirmDialog from './ConfirmDialog'

// Utilidad para registrar el Service Worker
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Notifications] Service Worker no soportado en este navegador')
    return null
  }

  // No registrar en desarrollo (localhost)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('[Notifications] Service Worker desactivado en desarrollo')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    })
    console.log('[Notifications] Service Worker registrado:', registration.scope)
    return registration
  } catch (error) {
    console.error('[Notifications] Error registrando Service Worker:', error)
    return null
  }
}

// Solicitar permisos de notificaciones
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('[Notifications] Notificaciones no soportadas en este navegador')
    alert('⚠️ Tu navegador no soporta notificaciones push. Prueba con Chrome, Firefox o Edge.')
    return 'unsupported'
  }

  // Verificar si estamos en HTTPS o localhost
  const isSecure = window.location.protocol === 'https:' || 
                   window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1'
  
  if (!isSecure) {
    console.warn('[Notifications] Las notificaciones requieren HTTPS')
    alert('⚠️ Las notificaciones push requieren HTTPS. Por favor, accede a la app mediante HTTPS.')
    return 'unsupported'
  }

  if (Notification.permission === 'granted') {
    console.log('[Notifications] ✅ Permisos ya otorgados')
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    console.warn('[Notifications] ❌ Permisos denegados por el usuario')
    alert('❌ Los permisos de notificación están bloqueados.\n\nPara activarlos:\n1. Haz clic en el ícono 🔒 o ⓘ en la barra de direcciones\n2. Busca "Notificaciones"\n3. Cambia a "Permitir"')
    return 'denied'
  }

  try {
    console.log('[Notifications] 📢 Solicitando permisos...')
    const permission = await Notification.requestPermission()
    console.log('[Notifications] Resultado:', permission)
    return permission
  } catch (error) {
    console.error('[Notifications] Error al solicitar permisos:', error)
    alert('⚠️ Error al solicitar permisos de notificación. Por favor, recarga la página e intenta de nuevo.')
    return 'denied'
  }
}

// Enviar notificación local
export const sendLocalNotification = (title, options = {}) => {
  if (!('Notification' in window)) {
    console.warn('[Notifications] Notificaciones no soportadas')
    showToast(title, options.body, 'info')
    return null
  }

  if (Notification.permission !== 'granted') {
    console.warn('[Notifications] Permisos de notificación no otorgados. Estado actual:', Notification.permission)
    // Mostrar toast in-app si no tenemos permisos
    showToast(title, options.body || 'Notificación', 'info')
    return null
  }

  try {
    const defaultOptions = {
      icon: '/web-app-manifest-192x192.png',
      badge: '/web-app-manifest-192x192.png',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      tag: 'scolyax-notification',
      renotify: true,
      silent: false,
      image: options.image,
      ...options
    }
    
    // Nota: Actions NO se soportan en new Notification()
    // Solo funcionan con ServiceWorkerRegistration.showNotification()
    // Por eso solo las usamos en el Service Worker

    console.log('[Notifications] 📨 Enviando notificación:', title)
    const notification = new Notification(title, defaultOptions)
    
    // También mostrar toast in-app para feedback visual inmediato
    const toastType = options.toastType || 'info'
    showToast(title, options.body, toastType)
    
    // Manejar click en notificación
    notification.onclick = (event) => {
      event.preventDefault()
      window.focus()
      notification.close()
    }
    
    // Log cuando se muestra
    notification.onshow = () => {
      console.log('[Notifications] ✅ Notificación mostrada:', title)
    }
    
    // Log si hay error
    notification.onerror = (error) => {
      console.error('[Notifications] ❌ Error mostrando notificación:', error)
      // Mostrar fallback en toast si la notificación falla
      showToast(title, options.body, toastType)
    }
    
    return notification
  } catch (error) {
    console.error('[Notifications] Error creando notificación:', error)
    // Fallback: mostrar como toast si falla crear notificación
    const toastType = options.toastType || 'error'
    showToast(title, options.body || 'No se pudo enviar la notificación', toastType)
    return null
  }
}

// Mostrar notificación toast in-app
export const showToast = (title, message = '', type = 'info') => {
  // Crear contenedor si no existe
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    container.className = 'toast-container'
    document.body.appendChild(container)
  }

  // Crear elemento del toast
  const toast = document.createElement('div')
  const toastId = `toast-${Date.now()}`
  toast.id = toastId
  toast.className = `toast toast--${type}`
  
  // Emojis para cada tipo
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    celebration: '🎉'
  }
  
  const icon = icons[type] || icons.info
  
  // Si el título comienza con emoji, no duplicar el icon
  const titleHasEmoji = /^\p{Emoji}/u.test(title)
  const displayIcon = titleHasEmoji ? '' : icon
  
  toast.innerHTML = `
    <div class="toast__icon">${displayIcon}</div>
    <div class="toast__content">
      <h4 class="toast__title">${title}</h4>
      ${message ? `<p class="toast__message">${message}</p>` : ''}
    </div>
    <button class="toast__close" data-toast-id="${toastId}" aria-label="Cerrar notificación">✕</button>
    <div class="toast__progress"></div>
  `
  
  container.appendChild(toast)
  
  // Detectar si es móvil
  const isMobile = () => window.innerWidth <= 640
  
  // Duración diferente para móvil y desktop
  const autoCloseDuration = isMobile() ? 4000 : 3000
  
  // Event listener para cerrar manualmente
  const closeBtn = toast.querySelector('.toast__close')
  const closeToast = () => {
    clearTimeout(autoRemoveTimer)
    toast.style.animation = 'toastSlideOut 0.3s ease forwards'
    setTimeout(() => {
      if (toast.parentNode) toast.remove()
    }, 300)
  }
  
  closeBtn?.addEventListener('click', closeToast)
  closeBtn?.addEventListener('touchend', (e) => {
    e.preventDefault()
    closeToast()
  })
  
  // Auto-remove después del tiempo configurado
  const autoRemoveTimer = setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'toastSlideOut 0.3s ease forwards'
      setTimeout(() => toast.remove(), 300)
    }
  }, autoCloseDuration)
  
  // Permitir remover timer si se cierra manualmente
  toast._removeTimer = autoRemoveTimer
  
  // En móvil, permitir deslizar para cerrar
  if (isMobile()) {
    let startX = 0
    const handleTouchStart = (e) => {
      startX = e.touches[0].clientX
    }
    const handleTouchEnd = (e) => {
      const endX = e.changedTouches[0].clientX
      const diff = startX - endX
      // Deslizar a la derecha más de 80px cierra el toast
      if (diff > 80) {
        closeToast()
      }
    }
    toast.addEventListener('touchstart', handleTouchStart)
    toast.addEventListener('touchend', handleTouchEnd)
  }
  
  return toast
}

// Tipos de notificaciones emocionales
const NOTIFICATION_TYPES = {
  CELEBRATION: {
    emoji: '🎉',
    color: '#a9b71a',
    sound: 'celebration'
  },
  MOTIVATION: {
    emoji: '💪',
    color: '#a9b71a',
    sound: 'motivation'
  },
  REMINDER: {
    emoji: '🔔',
    color: '#60a5fa',
    sound: 'reminder'
  },
  SAD: {
    emoji: '😢',
    color: '#ef4444',
    sound: 'sad'
  },
  ACHIEVEMENT: {
    emoji: '🏆',
    color: '#f59e0b',
    sound: 'achievement'
  },
  STREAK_LOST: {
    emoji: '💔',
    color: '#f87171',
    sound: 'streak-lost'
  }
}

const NotificationCenter = ({ isOpen, onClose, session }) => {
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('scolyax.notifications')
    return saved ? JSON.parse(saved) : []
  })
  const [permission, setPermission] = useState(Notification?.permission || 'default')
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('local') // 'local' | 'scheduled'
  const [scheduledData, setScheduledData] = useState({ pending: [], sent: [] })
  const [pushStatus, setPushStatus] = useState(null)
  const [loadingScheduled, setLoadingScheduled] = useState(false)

  useEffect(() => {
    // Guardar notificaciones en localStorage
    localStorage.setItem('scolyax.notifications', JSON.stringify(notifications))
  }, [notifications])

  // Cargar notificaciones programadas cuando se abre la pestaña
  useEffect(() => {
    if (!isOpen) return
    if (activeTab === 'scheduled' && !loadingScheduled) {
      setLoadingScheduled(true)
      Promise.all([
        import('../services/pushService.js').then(m => m.getScheduledNotifications()),
        import('../services/pushService.js').then(m => m.getPushStatus()),
      ]).then(([scheduled, status]) => {
        setScheduledData(scheduled || { pending: [], sent: [] })
        setPushStatus(status)
      }).catch(() => {}).finally(() => setLoadingScheduled(false))
    }
  }, [isOpen, activeTab])

  const handleRequestPermission = useCallback(async () => {
    const result = await requestNotificationPermission()
    setPermission(result)
    
    if (result === 'granted') {
      addNotification({
        type: 'CELEBRATION',
        title: '¡Notificaciones Activadas!',
        body: 'Ahora recibirás notificaciones motivacionales y de rachas',
        timestamp: new Date().toISOString()
      })
      
      sendLocalNotification('¡Notificaciones Activadas! 🎉', {
        body: 'Te mantendremos motivado con notificaciones inteligentes'
      })

      // Suscribir a push notifications del servidor
      import('../services/pushService.js').then(({ subscribeToPush }) => {
        subscribeToPush()
      }).catch(() => {})
    }
  }, [])

  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: Date.now(),
      read: false,
      ...notification
    }
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)) // Máximo 50 notificaciones
  }, [])

  const markAsRead = useCallback((notificationId) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    setConfirmClearOpen(false)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  if (!isOpen) return null

  const NOTIF_TYPE_LABELS = {
    created: { emoji: '✅', label: 'Creada', color: '#22c55e' },
    day_before: { emoji: '📋', label: 'Día anterior', color: '#f59e0b' },
    ten_min_before: { emoji: '🔴', label: '10 min antes', color: '#ef4444' },
  }

  const formatScheduledDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="notification-center-overlay" onClick={onClose}>
      <div className="notification-center" onClick={(e) => e.stopPropagation()}>
        <div className="notification-center__header">
          <h2 className="notification-center__title">
            🔔 Notificaciones
            {unreadCount > 0 && (
              <span className="notification-center__badge">{unreadCount}</span>
            )}
          </h2>
          <button
            className="notification-center__close"
            onClick={onClose}
            type="button"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="notification-center__tabs">
          <button
            className={`notification-center__tab ${activeTab === 'local' ? 'notification-center__tab--active' : ''}`}
            onClick={() => setActiveTab('local')}
            type="button"
          >
            📨 Recientes
          </button>
          <button
            className={`notification-center__tab ${activeTab === 'scheduled' ? 'notification-center__tab--active' : ''}`}
            onClick={() => setActiveTab('scheduled')}
            type="button"
          >
            📅 Programadas
          </button>
        </div>

        {/* Solicitar permisos */}
        {permission !== 'granted' && (
          <div className="notification-center__permission-prompt">
            <p className="notification-center__permission-text">
              {permission === 'denied'
                ? '❌ Permisos denegados. Habilítalos en la configuración del navegador (icono 🔒 en la barra de direcciones).'
                : '🔔 Activa las notificaciones para recibir motivación y recordatorios'}
            </p>
            {permission !== 'denied' && (
              <button
                className="notification-center__permission-button"
                onClick={handleRequestPermission}
                type="button"
              >
                Activar Notificaciones
              </button>
            )}
          </div>
        )}

        {/* ═══ TAB: Recientes (local) ═══ */}
        {activeTab === 'local' && (
          <>
            {/* Acciones */}
            {notifications.length > 0 && (
              <div className="notification-center__actions">
                {unreadCount > 0 && (
                  <button
                    className="notification-center__action-button"
                    onClick={markAllAsRead}
                    type="button"
                  >
                    Marcar todas como leídas
                  </button>
                )}
                <button
                  className="notification-center__action-button notification-center__action-button--danger"
                  onClick={() => setConfirmClearOpen(true)}
                  type="button"
                >
                  Limpiar todo
                </button>
              </div>
            )}

            {/* Lista de notificaciones locales */}
            <div className="notification-center__list">
              {notifications.length === 0 ? (
                <div className="notification-center__empty">
                  <span className="notification-center__empty-emoji">📭</span>
                  <p className="notification-center__empty-text">No hay notificaciones</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const typeConfig = NOTIFICATION_TYPES[notif.type] || NOTIFICATION_TYPES.REMINDER
                  return (
                    <div
                      key={notif.id}
                      className={`notification-item ${notif.read ? 'notification-item--read' : 'notification-item--unread'}`}
                      onClick={() => markAsRead(notif.id)}
                      style={{ '--notif-color': typeConfig.color }}
                    >
                      <span className="notification-item__emoji">{typeConfig.emoji}</span>
                      <div className="notification-item__content">
                        <h3 className="notification-item__title">{notif.title}</h3>
                        <p className="notification-item__body">{notif.body}</p>
                        <time className="notification-item__timestamp">
                          {new Date(notif.timestamp).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </time>
                      </div>
                      {!notif.read && <div className="notification-item__unread-dot"></div>}
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* ═══ TAB: Programadas (servidor) ═══ */}
        {activeTab === 'scheduled' && (
          <div className="notification-center__scheduled">
            {/* Estado del sistema push */}
            {pushStatus && (
              <div className={`push-status-banner ${pushStatus.issues?.length > 0 ? 'push-status-banner--warning' : 'push-status-banner--ok'}`}>
                <span className="push-status-banner__icon">
                  {pushStatus.issues?.length > 0 ? '⚠️' : '✅'}
                </span>
                <div className="push-status-banner__info">
                  <strong>
                    {pushStatus.issues?.length > 0
                      ? 'Push con problemas'
                      : 'Push activo'}
                  </strong>
                  <span className="push-status-banner__detail">
                    {pushStatus.subscriptions || 0} dispositivo{pushStatus.subscriptions !== 1 ? 's' : ''} · {pushStatus.scheduled_pending || 0} pendiente{pushStatus.scheduled_pending !== 1 ? 's' : ''}
                  </span>
                  {pushStatus.issues?.length > 0 && (
                    <ul className="push-status-banner__issues">
                      {pushStatus.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Aviso de optimización de batería para Android */}
            {/Android/i.test(navigator.userAgent) && Notification.permission === 'granted' && (
              <div className="push-android-tip">
                <span className="push-android-tip__icon">🔋</span>
                <div className="push-android-tip__content">
                  <strong>Para recibir notificaciones con la app cerrada:</strong>
                  <p><strong>1. Batería de Chrome — Sin restricciones</strong></p>
                  <ol>
                    <li>Ajustes → Aplicaciones → <strong>Chrome</strong></li>
                    <li>Batería → <strong>"Sin restricciones"</strong> (o "Actividad en segundo plano: Permitir")</li>
                  </ol>
                  <p style={{marginTop: '6px'}}><strong>2. Samsung / Xiaomi / Huawei</strong></p>
                  <ol>
                    <li><strong>Samsung:</strong> Ajustes → Batería → Optimización de la batería → Chrome → No optimizar</li>
                    <li><strong>Xiaomi:</strong> Ajustes → Aplicaciones → Chrome → Ahorro de batería → Sin restricciones</li>
                    <li><strong>Huawei:</strong> Ajustes → Batería → Inicio de aplicaciones → Chrome → Gestionar manualmente → Activar todo</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Botones de acción push */}
            <div className="push-actions">
              <button
                className="push-actions__btn push-actions__btn--subscribe"
                onClick={async () => {
                  const { subscribeToPush } = await import('../services/pushService.js')
                  // force=true: elimina suscripción antigua y crea una nueva
                  const sub = await subscribeToPush(true)
                  if (sub) {
                    alert('✅ Suscripción renovada y guardada en el servidor\n\nEste dispositivo ahora está registrado. Prueba el botón "🔔 Probar Push" para verificar que llega la notificación.')
                  } else {
                    const pushErr = localStorage.getItem('scolyax.pushError')
                    alert(`❌ Error: ${pushErr || 'No se pudo suscribir'}`)
                  }
                  // Recargar estado
                  const { getPushStatus, getScheduledNotifications } = await import('../services/pushService.js')
                  setPushStatus(await getPushStatus())
                  setScheduledData(await getScheduledNotifications())
                }}
                type="button"
              >
                🔄 Resuscribir Push
              </button>
              <button
                className="push-actions__btn push-actions__btn--test"
                onClick={async () => {
                  const { sendTestPush, subscribeToPush } = await import('../services/pushService.js')
                  // Suscribir primero para asegurar que este dispositivo está registrado
                  await subscribeToPush()
                  const result = await sendTestPush()

                  if (result.status === 'error' && result.total_subs === 0) {
                    alert(
                      `❌ ${result.reason || 'Sin suscripciones guardadas'}\n\n` +
                      `Presiona "Resuscribir Push" primero para registrar este dispositivo.`
                    )
                    return
                  }

                  // Construir mensaje detallado por suscripción
                  const lines = [
                    result.sent > 0
                      ? `✅ Push enviado a ${result.sent}/${result.total_subs} dispositivo(s)`
                      : `❌ Push falló en todos los dispositivos (${result.total_subs} registrado(s))`,
                    ''
                  ]
                  if (result.results?.length) {
                    result.results.forEach((r, i) => {
                      lines.push(`${r.ok ? '✅' : '❌'} [${i + 1}] ${r.service}`)
                      lines.push(`   ${r.endpoint_prefix}`)
                    })
                    lines.push('')
                  }
                  if (result.sent > 0) {
                    lines.push('Si no apareció, ve a:\nAjustes → Apps → Chrome → Batería → Sin restricciones')
                  } else if (result.reason) {
                    lines.push(`Razón: ${result.reason}`)
                  }

                  alert(lines.join('\n'))
                }}
                type="button"
              >
                🔔 Probar Push
              </button>
            </div>

            {loadingScheduled ? (
              <div className="notification-center__empty">
                <span className="notification-center__empty-emoji">⏳</span>
                <p className="notification-center__empty-text">Cargando...</p>
              </div>
            ) : (
              <>
                {/* Pendientes */}
                {scheduledData.pending.length > 0 && (
                  <div className="scheduled-section">
                    <h3 className="scheduled-section__title">🕐 Pendientes</h3>
                    {scheduledData.pending.map((notif) => {
                      const typeInfo = NOTIF_TYPE_LABELS[notif.notification_type] || { emoji: '📌', label: notif.notification_type, color: '#c9d62f' }
                      return (
                        <div key={notif.id} className="scheduled-item">
                          <span className="scheduled-item__emoji">{typeInfo.emoji}</span>
                          <div className="scheduled-item__content">
                            <div className="scheduled-item__header">
                              <h4 className="scheduled-item__title">{notif.title}</h4>
                              <span className="scheduled-item__type-badge" style={{ background: typeInfo.color }}>
                                {typeInfo.label}
                              </span>
                            </div>
                            <p className="scheduled-item__body">{notif.body}</p>
                            <time className="scheduled-item__time">
                              📅 Se enviará: {formatScheduledDate(notif.send_at)}
                            </time>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Enviadas */}
                {scheduledData.sent.length > 0 && (
                  <div className="scheduled-section">
                    <h3 className="scheduled-section__title">✅ Enviadas</h3>
                    {scheduledData.sent.map((notif) => {
                      const typeInfo = NOTIF_TYPE_LABELS[notif.notification_type] || { emoji: '📌', label: notif.notification_type, color: '#c9d62f' }
                      return (
                        <div key={notif.id} className="scheduled-item scheduled-item--sent">
                          <span className="scheduled-item__emoji">{typeInfo.emoji}</span>
                          <div className="scheduled-item__content">
                            <div className="scheduled-item__header">
                              <h4 className="scheduled-item__title">{notif.title}</h4>
                              <span className="scheduled-item__type-badge" style={{ background: typeInfo.color, opacity: 0.7 }}>
                                {typeInfo.label}
                              </span>
                            </div>
                            <p className="scheduled-item__body">{notif.body}</p>
                            <time className="scheduled-item__time">
                              ✅ Enviada: {formatScheduledDate(notif.sent_at)}
                            </time>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {scheduledData.pending.length === 0 && scheduledData.sent.length === 0 && (
                  <div className="notification-center__empty">
                    <span className="notification-center__empty-emoji">📭</span>
                    <p className="notification-center__empty-text">No hay notificaciones programadas</p>
                    <p className="notification-center__empty-hint">
                      Se crearán automáticamente al agregar tareas o recordatorios con fecha
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        <ConfirmDialog
          isOpen={confirmClearOpen}
          onClose={() => setConfirmClearOpen(false)}
          onConfirm={clearAll}
          title="¿Limpiar notificaciones?"
          message={`¿Estás seguro de eliminar todas las notificaciones (${notifications.length})? Esta acción no se puede deshacer.`}
          confirmText="Limpiar todo"
          cancelText="Cancelar"
          type="warning"
        />
      </div>
    </div>
  )
}

export default NotificationCenter
