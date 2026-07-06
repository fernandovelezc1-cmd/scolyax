class TTSService {
  constructor() {
    this.isPlaying = false;
    this.currentUtterance = null;
  }

  /**
   * Sintetiza texto a voz usando Web Speech API
   * @param {string} text - Texto a sintetizar
   * @param {string} language - Idioma (ej: 'es-ES')
   * @returns {Promise<void>}
   */
  async speak(text, language = 'es-ES') {
    if (!('speechSynthesis' in window)) {
      console.error('Web Speech API no soportada en este navegador');
      return;
    }

    // Cancelar síntesis anterior si existe
    if (this.isPlaying) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    utterance.onstart = () => {
      this.isPlaying = true;
    };

    utterance.onend = () => {
      this.isPlaying = false;
    };

    utterance.onerror = (event) => {
      console.error('Error en TTS:', event.error);
      this.isPlaying = false;
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Detiene la síntesis de voz actual
   */
  stop() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.isPlaying = false;
    }
  }

  /**
   * Pausa la síntesis actual
   */
  pause() {
    if (window.speechSynthesis && this.isPlaying) {
      window.speechSynthesis.pause();
    }
  }

  /**
   * Reanuda la síntesis pausada
   */
  resume() {
    if (window.speechSynthesis && this.isPlaying) {
      window.speechSynthesis.resume();
    }
  }

  /**
   * Obtiene estado actual de reproducción
   */
  isCurrentlyPlaying() {
    return this.isPlaying;
  }
}

export default new TTSService();
