/**
 * Servicio de notificaciones nativas del navegador
 * Gestiona permisos y envío de notificaciones push nativas
 */

class NotificationService {
  constructor() {
    this.permission = 'default'
    this.checkPermission()
  }

  /**
   * Verifica el estado actual del permiso de notificaciones
   */
  checkPermission() {
    if ('Notification' in window) {
      this.permission = Notification.permission
    }
    return this.permission
  }

  /**
   * Solicita permiso al usuario para mostrar notificaciones
   * @returns {Promise<string>} Estado del permiso: 'granted', 'denied', o 'default'
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Este navegador no soporta notificaciones')
      return 'denied'
    }

    if (this.permission === 'granted') {
      return 'granted'
    }

    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      console.log('📢 Permiso de notificaciones:', permission)
      return permission
    } catch (error) {
      console.error('Error al solicitar permiso de notificaciones:', error)
      return 'denied'
    }
  }

  /**
   * Muestra una notificación nativa
   * @param {string} title - Título de la notificación
   * @param {Object} options - Opciones de la notificación
   * @returns {Notification|null} Instancia de la notificación o null
   */
  async showNotification(title, options = {}) {
    // Verificar soporte
    if (!('Notification' in window)) {
      console.warn('Notificaciones no soportadas')
      return null
    }

    // Bloquear durante sesión de estudio activa
    if (this._sessionBlocked) {
      console.log(`🔕 Notificación bloqueada (sesión activa): ${title}`)
      return null
    }

    // Solicitar permiso si no está concedido
    if (this.permission !== 'granted') {
      const permission = await this.requestPermission()
      if (permission !== 'granted') {
        console.log('Permiso de notificaciones denegado')
        return null
      }
    }

    try {
      const defaultOptions = {
        icon: '/web-app-manifest-192x192.png',
        badge: '/web-app-manifest-192x192.png',
        vibrate: [200, 100, 200],
        requireInteraction: false,
        ...options
      }

      // Preferir Service Worker showNotification (funciona en background/móvil)
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const registration = await navigator.serviceWorker.ready
        await registration.showNotification(title, {
          ...defaultOptions,
          data: { url: '/', ...options.data },
          actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'close', title: 'Descartar' }
          ]
        })
        console.log('📢 Notificación SW mostrada:', title)
        return true
      }

      // Fallback: Notification API directa (solo foreground)
      const notification = new Notification(title, defaultOptions)

      // Event listeners
      notification.onclick = () => {
        window.focus()
        notification.close()
        if (options.onClick) {
          options.onClick()
        }
      }

      notification.onerror = (error) => {
        console.error('Error en notificación:', error)
      }

      console.log('📢 Notificación mostrada:', title)
      return notification
    } catch (error) {
      console.error('Error al mostrar notificación:', error)
      return null
    }
  }

  /**
   * Programa una notificación para un recordatorio
   * @param {Object} reminder - Objeto del recordatorio
   */
  scheduleReminder(reminder) {
    const scheduledTime = new Date(reminder.scheduled_at).getTime()
    const now = Date.now()
    const delay = scheduledTime - now

    if (delay <= 0) {
      // Si ya pasó la hora, notificar inmediatamente
      this.showNotification('⏰ Recordatorio', {
        body: reminder.title,
        tag: `reminder-${reminder.id}`,
        data: { type: 'reminder', id: reminder.id }
      })
      return null
    }

    // Programar notificación
    const timeoutId = setTimeout(() => {
      this.showNotification('⏰ Recordatorio', {
        body: reminder.title,
        tag: `reminder-${reminder.id}`,
        data: { type: 'reminder', id: reminder.id },
        requireInteraction: true
      })
    }, delay)

    console.log(`⏰ Recordatorio programado para ${new Date(scheduledTime).toLocaleString()}`)
    return timeoutId
  }

  /**
   * Cancela una notificación programada
   * @param {number} timeoutId - ID del timeout a cancelar
   */
  cancelScheduledNotification(timeoutId) {
    if (timeoutId) {
      clearTimeout(timeoutId)
      console.log('❌ Notificación cancelada')
    }
  }

  /**
   * Notifica cuando una tarea está próxima a vencer
   * @param {Object} task - Objeto de la tarea
   */
  notifyTaskDue(task) {
    this.showNotification('📋 Tarea próxima a vencer', {
      body: `${task.title} - Vence: ${new Date(task.due_date).toLocaleDateString()}`,
      tag: `task-${task.id}`,
      data: { type: 'task', id: task.id }
    })
  }

  /**
   * Notifica el inicio de una sesión de Pomodoro
   * @param {number} duration - Duración en minutos
   */
  notifyPomodoroStart(duration) {
    this.showNotification('🍅 Pomodoro iniciado', {
      body: `Sesión de ${duration} minutos comenzada. ¡Mantén el enfoque!`,
      tag: 'pomodoro-start',
      silent: false
    })
  }

  /**
   * Notifica el fin de una sesión de Pomodoro
   */
  notifyPomodoroEnd() {
    this.showNotification('🎉 ¡Pomodoro completado!', {
      body: 'Excelente trabajo. Es hora de un descanso.',
      tag: 'pomodoro-end',
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200]
    })
  }

  /**
   * Notifica el inicio de un descanso
   * @param {number} duration - Duración del descanso en minutos
   */
  notifyBreakStart(duration) {
    this.showNotification('☕ Descanso iniciado', {
      body: `Tómate ${duration} minutos para relajarte`,
      tag: 'break-start',
      silent: false
    })
  }

  /**
   * Notifica el fin de un descanso
   */
  notifyBreakEnd() {
    this.showNotification('💪 Descanso terminado', {
      body: '¡Es hora de volver al trabajo!',
      tag: 'break-end',
      requireInteraction: true
    })
  }

  /**
   * Notifica un logro desbloqueado
   * @param {Object} achievement - Objeto del logro
   */
  notifyAchievement(achievement) {
    this.showNotification('🏆 ¡Logro desbloqueado!', {
      body: achievement.title || 'Has completado un nuevo logro',
      tag: `achievement-${achievement.id}`,
      icon: '/scolyax-logo.svg',
      vibrate: [200, 100, 200, 100, 200, 100, 200]
    })
  }

  /**
   * Bloquea TODAS las notificaciones durante una sesión de estudio.
   * Intercepta window.Notification y ServiceWorker.showNotification.
   */
  blockSession() {
    if (this._sessionBlocked) return
    this._sessionBlocked = true

    // Bloquear window.Notification (tabs externas, otras webs)
    if ('Notification' in window) {
      this._OriginalNotification = window.Notification
      const noop = function () {
        return { close: () => {}, addEventListener: () => {}, removeEventListener: () => {} }
      }
      noop.permission = window.Notification.permission
      noop.requestPermission = () => Promise.resolve(window.Notification.permission)
      window.Notification = noop
    }

    // Bloquear ServiceWorker showNotification (push desde background)
    if ('serviceWorker' in navigator && typeof ServiceWorkerRegistration !== 'undefined') {
      this._origSWShow = ServiceWorkerRegistration.prototype.showNotification
      ServiceWorkerRegistration.prototype.showNotification = () => Promise.resolve()
    }

    console.log('🔕 Notificaciones bloqueadas durante sesión de estudio')
  }

  /**
   * Restaura las notificaciones al terminar la sesión.
   */
  unblockSession() {
    if (!this._sessionBlocked) return
    this._sessionBlocked = false

    if (this._OriginalNotification) {
      window.Notification = this._OriginalNotification
      this._OriginalNotification = null
    }

    if (this._origSWShow) {
      ServiceWorkerRegistration.prototype.showNotification = this._origSWShow
      this._origSWShow = null
    }

    console.log('🔔 Notificaciones restauradas')
  }

  /**
   * Indica si la sesión tiene las notificaciones bloqueadas.
   * @returns {boolean}
   */
  isSessionBlocked() {
    return !!this._sessionBlocked
  }

  /**
   * Verifica si las notificaciones están habilitadas
   * @returns {boolean}
   */
  isEnabled() {
    return this.permission === 'granted'
  }

  /**
   * Verifica si las notificaciones están soportadas
   * @returns {boolean}
   */
  isSupported() {
    return 'Notification' in window
  }
}

// Exportar instancia única (singleton)
const notificationService = new NotificationService()
export default notificationService
