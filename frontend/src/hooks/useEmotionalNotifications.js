/**
 * Hook personalizado para enviar notificaciones emocionales
 */
import { useCallback } from 'react'
import { sendLocalNotification } from '../components/NotificationCenter'

export const useEmotionalNotifications = () => {
  const sendStreakNotification = useCallback((streakDays) => {
    let title = ''
    let body = ''
    let type = 'CELEBRATION'

    // Verificar si ya se envió notificación para este día para evitar duplicados
    const today = new Date().toISOString().split('T')[0]
    const notificationKey = `streak_notif_${streakDays}_${today}`
    const sentNotifications = JSON.parse(localStorage.getItem('scolyax.sentNotifications') || '[]')
    
    if (sentNotifications.includes(notificationKey)) {
      console.log('⏭️ Notificación de racha ya enviada hoy para', streakDays, 'días')
      return
    }

    if (streakDays === 1) {
      title = '🔥 ¡Comenzaste tu racha!'
      body = 'Primer día completado. Gran inicio, sigue así mañana.'
      type = 'MOTIVATION'
    } else if (streakDays === 2) {
      title = '🔥 ¡Segundo día consecutivo!'
      body = 'Vas por buen camino. La racha está creciendo.'
      type = 'MOTIVATION'
    } else if (streakDays === 3) {
      title = '⭐ ¡3 días seguidos!'
      body = 'La consistencia es la clave. ¡Sigue así!'
      type = 'CELEBRATION'
    } else if (streakDays < 7) {
      title = `🔥 ¡${streakDays} días consecutivos!`
      body = `Excelente racha. ¡No pares ahora!`
      type = 'MOTIVATION'
    } else if (streakDays === 7) {
      title = '🎉 ¡UNA SEMANA COMPLETA!'
      body = 'Increíble disciplina. ¡Eres imparable!'
      type = 'CELEBRATION'
    } else if (streakDays === 14) {
      title = '💎 ¡DOS SEMANAS DE FUEGO!'
      body = '¡Wow! Tu compromiso es inspirador.'
      type = 'CELEBRATION'
    } else if (streakDays === 30) {
      title = '👑 ¡UN MES PERFECTO!'
      body = 'Eres oficialmente una leyenda. ¡FELICIDADES!'
      type = 'ACHIEVEMENT'
    } else if (streakDays > 30 && streakDays % 10 === 0) {
      title = `🏆 ¡${streakDays} DÍAS DE RACHA!`
      body = 'No hay quien te detenga. ¡Extraordinario!'
      type = 'ACHIEVEMENT'
    } else if (streakDays > 7) {
      title = `💪 ¡${streakDays} días sin parar!`
      body = 'Tu disciplina es admirable. ¡Continúa!'
      type = 'MOTIVATION'
    }

    if (title) {
      sendLocalNotification(title, {
        body,
        tag: `streak-${streakDays}`,
        requireInteraction: true
      })
      
      // Guardar que se envió esta notificación
      sentNotifications.push(notificationKey)
      localStorage.setItem('scolyax.sentNotifications', JSON.stringify(sentNotifications))
      console.log('✅ Notificación de racha enviada:', title)
    }
  }, [])

  const sendStreakLostNotification = useCallback((lastStreak) => {
    const title = '💔 Tu racha se rompió'
    const body = lastStreak > 7
      ? `Perdiste tu racha de ${lastStreak} días. No te rindas, puedes empezar de nuevo hoy.`
      : 'No te preocupes, todos tenemos días difíciles. ¡Vuelve más fuerte!'
    
    sendLocalNotification(title, {
      body,
      tag: 'streak-lost',
      requireInteraction: true
    })
  }, [])

  const sendMotivationNotification = useCallback(() => {
    const motivations = [
      { title: '💪 ¡Tú puedes!', body: 'Cada tarea completada es un paso hacia tus metas' },
      { title: '🎯 Mantén el enfoque', body: 'La disciplina es más fuerte que la motivación' },
      { title: '⭐ Eres increíble', body: 'Tu esfuerzo de hoy es tu éxito de mañana' },
      { title: '🚀 Sigue adelante', body: 'Los límites solo existen en tu mente' }
    ]

    const random = motivations[Math.floor(Math.random() * motivations.length)]
    sendLocalNotification(random.title, {
      body: random.body,
      tag: 'motivation'
    })
  }, [])

  return {
    sendStreakNotification,
    sendStreakLostNotification,
    sendMotivationNotification
  }
}
