import React, { useState } from 'react';
import TTSService from '../../services/ttsService';
import './AIMessage.css';

export function AIMessage({ message }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleTTS = () => {
    if (isPlaying) {
      TTSService.stop();
      setIsPlaying(false);
    } else {
      const textContent = extractPlainText(message.content);
      TTSService.speak(textContent, 'es-ES');
      setIsPlaying(true);
    }
  };

  const extractPlainText = (content) => {
    const div = document.createElement('div');
    div.innerHTML = content;
    return div.textContent || div.innerText || '';
  };

  return (
    <div className="ai-assistant__message ai-assistant__message--assistant">
      <div className="ai-assistant__message-content">
        <div className="ai-assistant__message-text">
          {/* ...existing code... */}
        </div>
        <button
          className={`ai-assistant__btn ai-assistant__btn--audio ${isPlaying ? 'is-active' : ''}`}
          onClick={handleTTS}
          title={isPlaying ? 'Detener audio' : 'Reproducir audio'}
          aria-label={isPlaying ? 'Audio activado' : 'Audio desactivado'}
        >
          {isPlaying ? '🔊' : '🔇'}
        </button>
      </div>
    </div>
  );
}