/**
 * AvatarSelector - Selector de avatares animados y modernos
 */
import React, { useState } from 'react'
import './AvatarSelector.css'

const AVATARS = [
  { id: '🚀', emoji: '🚀', name: 'Cohete', gradient: 'linear-gradient(135deg, #c9d62f 0%, #c8de1f 100%)' },
  { id: '🎯', emoji: '🎯', name: 'Diana', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: '⚡', emoji: '⚡', name: 'Rayo', gradient: 'linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%)' },
  { id: '🔥', emoji: '🔥', name: 'Fuego', gradient: 'linear-gradient(135deg, #ff9a56 0%, #ff5e62 100%)' },
  { id: '💎', emoji: '💎', name: 'Diamante', gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { id: '🌟', emoji: '🌟', name: 'Estrella', gradient: 'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)' },
  { id: '🎨', emoji: '🎨', name: 'Arte', gradient: 'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)' },
  { id: '🧠', emoji: '🧠', name: 'Cerebro', gradient: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
  { id: '🎮', emoji: '🎮', name: 'Gaming', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: '🏆', emoji: '🏆', name: 'Trofeo', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { id: '🌈', emoji: '🌈', name: 'Arcoíris', gradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' },
  { id: '🎪', emoji: '🎪', name: 'Circo', gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' },
  { id: '🦄', emoji: '🦄', name: 'Unicornio', gradient: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)' },
  { id: '🎭', emoji: '🎭', name: 'Teatro', gradient: 'linear-gradient(135deg, #e2ebf0 0%, #cfd9df 100%)' },
  { id: '🌺', emoji: '🌺', name: 'Flor', gradient: 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)' },
  { id: '🦋', emoji: '🦋', name: 'Mariposa', gradient: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)' },
]

// Expose gradients globally for App.jsx
if (typeof window !== 'undefined') {
  window.AVATAR_GRADIENTS = {}
  AVATARS.forEach(avatar => {
    window.AVATAR_GRADIENTS[avatar.id] = avatar.gradient
  })
}

export default function AvatarSelector({ isOpen, onClose, currentAvatar, onSelectAvatar }) {
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar)

  const handleSelect = (avatar) => {
    setSelectedAvatar(avatar.id)
  }

  const handleConfirm = () => {
    onSelectAvatar(selectedAvatar)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="avatar-selector-overlay" onClick={onClose}>
      <div className="avatar-selector" onClick={(e) => e.stopPropagation()}>
        <div className="avatar-selector__header">
          <h2 className="avatar-selector__title">
            <span className="avatar-selector__title-icon">✨</span>
            Elige tu avatar
          </h2>
          <button
            className="avatar-selector__close"
            onClick={onClose}
            type="button"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="avatar-selector__grid">
          {AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              className={`avatar-option ${selectedAvatar === avatar.id ? 'avatar-option--selected' : ''}`}
              onClick={() => handleSelect(avatar)}
              style={{ background: avatar.gradient }}
              aria-label={`Seleccionar avatar ${avatar.name}`}
            >
              <span className="avatar-option__emoji">{avatar.emoji}</span>
              <span className="avatar-option__check">✓</span>
            </button>
          ))}
        </div>

        <div className="avatar-selector__footer">
          <button
            type="button"
            className="avatar-selector__button avatar-selector__button--secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="avatar-selector__button avatar-selector__button--primary"
            onClick={handleConfirm}
          >
            <span className="avatar-selector__button-icon">✓</span>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
