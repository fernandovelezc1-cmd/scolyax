/**
 * Sistema de alarmas avanzado para Pomodoro
 * Soporta múltiples tipos de alarmas y notificaciones
 */

class AlarmSystem {
  constructor() {
    this.audioContext = null;
    this.alarms = [];
    this.enabled = true;
    this.volume = 0.3;
  }

  /**
   * Inicializa el contexto de audio
   */
  async initAudio() {
    if (this.audioContext) return this.audioContext;
    
    if (typeof window === 'undefined') return null;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('No se pudo activar el contexto de audio', error);
      }
    }

    return this.audioContext;
  }

  /**
   * Toca una alarma de finalización (sonido doble moderno)
   */
  async playCompletionAlarm() {
    if (!this.enabled) return;
    
    const ctx = await this.initAudio();
    if (!ctx) return;

    // Tonos modernos: Do mayor (C5 y C6)
    const notes = [
      { frequency: 523.25, duration: 0.3, wave: 'sine' },    // Do5
      { frequency: 659.25, duration: 0.3, wave: 'sine' },    // Mi5
      { frequency: 1046.5, duration: 0.5, wave: 'sine' },    // Do6
    ];

    let start = ctx.currentTime;
    notes.forEach(({ frequency, duration, wave }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, start);
      gainNode.gain.setValueAtTime(0.0001, start);
      gainNode.gain.exponentialRampToValueAtTime(this.volume * 0.9, start + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
      
      start += duration + 0.1;
    });
  }

  /**
   * Toca una alarma de aviso (tonos modernos - tritono)
   */
  async playWarningAlarm() {
    if (!this.enabled) return;
    
    const ctx = await this.initAudio();
    if (!ctx) return;

    // Secuencia rítmica moderna: La - Si - Do
    const notes = [
      { frequency: 440, duration: 0.2 },     // La4
      { frequency: 494, duration: 0.2 },     // Si4
      { frequency: 523.25, duration: 0.3 },  // Do5
    ];

    let start = ctx.currentTime;
    notes.forEach(({ frequency, duration }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      gainNode.gain.setValueAtTime(0.0001, start);
      gainNode.gain.exponentialRampToValueAtTime(this.volume * 0.7, start + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
      
      start += duration + 0.05;
    });
  }

  /**
   * Toca una alarma de pausa recomendada (acordes suaves)
   */
  async playBreakAlarm() {
    if (!this.enabled) return;
    
    const ctx = await this.initAudio();
    if (!ctx) return;

    // Acordes Do Mayor suave: Do - Mi - Sol
    const notes = [
      { frequency: 261.63, duration: 0.4, wave: 'sine' },    // Do4
      { frequency: 329.63, duration: 0.4, wave: 'sine' },    // Mi4
      { frequency: 392, duration: 0.5, wave: 'sine' },       // Sol4
    ];

    let start = ctx.currentTime;
    notes.forEach(({ frequency, duration, wave }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, start);
      gainNode.gain.setValueAtTime(0.0001, start);
      gainNode.gain.exponentialRampToValueAtTime(this.volume * 0.5, start + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
      
      start += duration + 0.08;
    });
  }

  /**
   * Toca una secuencia personalizada de notas
   */
  async playCustomSequence(frequencies) {
    if (!this.enabled) return;
    
    const ctx = await this.initAudio();
    if (!ctx) return;

    let start = ctx.currentTime;
    frequencies.forEach(({ frequency, duration = 0.2 }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gainNode.gain.setValueAtTime(0.0001, start);
      gainNode.gain.exponentialRampToValueAtTime(this.volume, start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
      
      start += duration + 0.05;
    });
  }

  /**
   * Reproduce una notificación de navegador
   */
  showNotification(title, options = {}) {
    if (!this.enabled) return;
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '⏰',
        ...options,
      });
    }
  }

  /**
   * Solicita permiso para notificaciones
   */
  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn('Permiso de notificación denegado', error);
      }
    }
  }

  /**
   * Configura el volumen (0-1)
   */
  setVolume(level) {
    this.volume = Math.max(0, Math.min(1, level));
  }

  /**
   * Habilita/deshabilita alarmas
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Obtiene el estado de habilitación
   */
  isEnabled() {
    return this.enabled;
  }
}

// Instancia singleton
const alarmSystem = new AlarmSystem();

export default alarmSystem;
