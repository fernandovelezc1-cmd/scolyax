/**
 * Background Alarm System
 * Ejecuta alarmas en segundo plano incluso si el navegador no está enfocado
 */

class BackgroundAlarmSystem {
  constructor() {
    this.audioContext = null
    this.oscillators = []
    this.gainNodes = []
    this.isPlayingAlarm = false
    this.alarmIntervalId = null
  }

  // Inicializar Web Audio API
  initAudioContext() {
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      this.audioContext = new AudioContext()
    }
    return this.audioContext
  }

  // Generar alarma en segundo plano (patrón de beeps repetitivos)
  playBackgroundAlarm(duration = 5000) {
    try {
      const ctx = this.initAudioContext()
      this.stopAlarm() // Detener cualquier alarma anterior
      
      this.isPlayingAlarm = true
      const startTime = Date.now()
      
      this.alarmIntervalId = setInterval(() => {
        if (Date.now() - startTime > duration) {
          this.stopAlarm()
          return
        }

        // Crear un oscilador para el beep
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        
        osc.type = 'sine'
        osc.frequency.value = 880 // La nota A5 (880 Hz)
        
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
        
        osc.connect(gain)
        gain.connect(ctx.destination)
        
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.1)
        
        this.oscillators.push(osc)
        this.gainNodes.push(gain)
      }, 200) // Beep cada 200ms
    } catch (error) {
      console.error('Error en Background Alarm:', error)
      // Fallback: usar notificación del navegador
      this.fallbackNotification()
    }
  }

  // Parar alarma
  stopAlarm() {
    if (this.alarmIntervalId) {
      clearInterval(this.alarmIntervalId)
      this.alarmIntervalId = null
    }
    this.oscillators.forEach(osc => {
      try {
        osc.stop()
      } catch (e) {}
    })
    this.gainNodes.forEach(gain => {
      try {
        gain.disconnect()
      } catch (e) {}
    })
    this.oscillators = []
    this.gainNodes = []
    this.isPlayingAlarm = false
  }

  // Notificación de navegador (fallback)
  fallbackNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('⏰ ¡Pomodoro Completado!', {
        body: 'Tu sesión de enfoque ha terminado. ¡Tomante un descanso!',
        icon: '🍅',
        tag: 'pomodoro-alert',
        requireInteraction: true
      })
    }
  }

  // Reproducir sonido de finalización simple
  playCompletionSound() {
    try {
      const ctx = this.initAudioContext()
      
      // Sonido ascendente de 2 tonos
      const notes = [
        { freq: 523, duration: 150 }, // C5
        { freq: 659, duration: 150 }  // E5
      ]
      
      let timeOffset = ctx.currentTime
      
      notes.forEach(({ freq, duration }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        
        osc.type = 'sine'
        osc.frequency.value = freq
        
        gain.gain.setValueAtTime(0.2, timeOffset)
        gain.gain.exponentialRampToValueAtTime(0.01, timeOffset + duration / 1000)
        
        osc.connect(gain)
        gain.connect(ctx.destination)
        
        osc.start(timeOffset)
        osc.stop(timeOffset + duration / 1000)
        
        timeOffset += duration / 1000
      })
    } catch (error) {
      console.error('Error en completion sound:', error)
    }
  }
}

const backgroundAlarmSystem = new BackgroundAlarmSystem()

export default backgroundAlarmSystem
