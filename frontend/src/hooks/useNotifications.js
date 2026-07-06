/**
 * Hook personalizado para gestionar notificaciones
 * Facilita el uso de notificaciones en los componentes
 */
import { useEffect, useState } from 'react'
import notificationService from '../services/notificationService'

export const useNotifications = () => {
  const [permission, setPermission] = useState('default')
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported(notificationService.isSupported())
    setPermission(notificationService.checkPermission())
  }, [])

  const requestPermission = async () => {
    const newPermission = await notificationService.requestPermission()
    setPermission(newPermission)
    return newPermission
  }

  const notify = (title, options) => {
    return notificationService.showNotification(title, options)
  }

  return {
    permission,
    isSupported,
    isEnabled: permission === 'granted',
    requestPermission,
    notify,
    notifyPomodoroStart: notificationService.notifyPomodoroStart.bind(notificationService),
    notifyPomodoroEnd: notificationService.notifyPomodoroEnd.bind(notificationService),
    notifyBreakStart: notificationService.notifyBreakStart.bind(notificationService),
    notifyBreakEnd: notificationService.notifyBreakEnd.bind(notificationService),
    notifyTaskDue: notificationService.notifyTaskDue.bind(notificationService),
    notifyAchievement: notificationService.notifyAchievement.bind(notificationService),
    scheduleReminder: notificationService.scheduleReminder.bind(notificationService),
    cancelScheduledNotification: notificationService.cancelScheduledNotification.bind(notificationService)
  }
}
