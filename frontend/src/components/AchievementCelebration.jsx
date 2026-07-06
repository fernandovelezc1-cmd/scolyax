import React, { useState, useEffect } from 'react'
import './AchievementCelebration.css'

/**
 * Componente que genera partículas de fuegos artificiales
 */
const Confetti = () => {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    // Crear muchas partículas de confeti/fuegos artificiales
    const newParticles = []
    const particleCount = 15

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.2,
        duration: 2 + Math.random() * 1,
        emoji: ['✨', '🎉', '🎊', '⭐', '💫', '🌟'][Math.floor(Math.random() * 6)],
        angle: Math.random() * 360
      })
    }

    setParticles(newParticles)
  }, [])

  return (
    <div className="confetti-container">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="confetti-particle"
          style={{
            left: `${particle.left}%`,
            '--delay': `${particle.delay}s`,
            '--duration': `${particle.duration}s`,
            '--angle': `${particle.angle}deg`
          }}
        >
          {particle.emoji}
        </div>
      ))}
    </div>
  )
}

/**
 * Componente principal de celebración de logros
 * Modal elegante con animación, trofeo, fuegos artificiales y confeti
 */
export default function AchievementCelebration({ 
  achievement, 
  isVisible, 
  onClose,
  onCelebrationComplete  // Callback cuando la celebración termina (para Rating Modal)
}) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (!isVisible) {
      setIsAnimating(false)
      return
    }

    // Trigger animación
    setIsAnimating(true)

    // Auto-cerrar después de 5 segundos
    const timer = setTimeout(() => {
      setIsAnimating(false)
      setTimeout(() => {
        onClose()
        // Notificar que la celebración terminó (para mostrar RatingModal)
        if (onCelebrationComplete) {
          onCelebrationComplete(achievement)
        }
      }, 300)
    }, 5000)

    return () => clearTimeout(timer)
  }, [isVisible, onClose, onCelebrationComplete, achievement])
  
  if (!isVisible || !achievement) {
    return null
  }

  return (
    <div className={`achievement-celebration ${isAnimating ? 'achievement-celebration--active' : ''}`}>
      {/* Backdrop */}
      <div 
        className="achievement-celebration__backdrop" 
        onClick={() => {
          setIsAnimating(false)
          setTimeout(() => {
            onClose()
            if (onCelebrationComplete) {
              onCelebrationComplete(achievement)
            }
          }, 300)
        }}
      />

      {/* Confeti y fuegos artificiales */}
      <Confetti />

      {/* Modal principal */}
      <div className="achievement-celebration__modal">
        {/* Efecto de luz de fondo */}
        <div className="achievement-celebration__glow" />

        {/* Contenedor del trofeo */}
        <div className="achievement-celebration__trophy-container">
          <div className="achievement-celebration__trophy-emoji">
            🏆
          </div>
          <div className="achievement-celebration__trophy-glow" />
        </div>

        {/* Líneas decorativas */}
        <div className="achievement-celebration__decorative-line achievement-celebration__decorative-line--top" />
        <div className="achievement-celebration__decorative-line achievement-celebration__decorative-line--bottom" />

        {/* Contenido de texto */}
        <div className="achievement-celebration__content">
          <h1 className="achievement-celebration__title">
            🎉 ¡FELICIDADES! 🎉
          </h1>

          <div className="achievement-celebration__badge" style={{
            '--badge-color': achievement.color
          }}>
            <span className="achievement-celebration__achievement-emoji">
              {achievement.emoji}
            </span>
          </div>

          <h2 className="achievement-celebration__achievement-name">
            {achievement.name}
          </h2>

          <p className="achievement-celebration__achievement-description">
            {achievement.description}
          </p>

          {/* Estrellas animadas alrededor */}
          <div className="achievement-celebration__stars">
            <span className="achievement-celebration__star achievement-celebration__star--1">⭐</span>
            <span className="achievement-celebration__star achievement-celebration__star--2">✨</span>
            <span className="achievement-celebration__star achievement-celebration__star--3">⭐</span>
          </div>

          {/* Botón para cerrar */}
          <button
            className="achievement-celebration__close-button"
            onClick={() => {
              setIsAnimating(false)
              setTimeout(() => {
                onClose()
                // Notificar que la celebración terminó (para mostrar RatingModal)
                if (onCelebrationComplete) {
                  onCelebrationComplete(achievement)
                }
              }, 300)
            }}
            type="button"
            aria-label="Cerrar celebración"
          >
            Continuar
          </button>
        </div>

        {/* Efectos de partículas pequeñas */}
        <div className="achievement-celebration__particles">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="achievement-celebration__particle"
              style={{
                '--particle-index': i,
                '--particle-delay': `${i * 0.08}s`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
