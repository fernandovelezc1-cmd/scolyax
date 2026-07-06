import React, { useState, useEffect } from 'react'
import './StreakCelebration.css'

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
 * Definición de hitos de racha con sus propiedades
 */
export const STREAK_MILESTONES = [
  {
    id: 'streak_1',
    days: 1,
    name: '¡Primer Día!',
    description: 'Comenzaste tu racha',
    emoji: '🔥',
    color: '#f97316',
    milestone: 'Enciende el fuego'
  },
  {
    id: 'streak_3',
    days: 3,
    name: 'Racha en Fuego',
    description: '3 días consecutivos',
    emoji: '🔥',
    color: '#dc2626',
    milestone: 'El fuego arde'
  },
  {
    id: 'streak_7',
    days: 7,
    name: 'Semana Dorada',
    description: '¡Una semana completa!',
    emoji: '⭐',
    color: '#eab308',
    milestone: 'Brillas como una estrella'
  },
  {
    id: 'streak_14',
    days: 14,
    name: 'Rey de la Consistencia',
    description: '2 semanas de consistencia',
    emoji: '💎',
    color: '#c9d62f',
    milestone: 'Eres una joya rara'
  },
  {
    id: 'streak_30',
    days: 30,
    name: 'Mes Perfecto',
    description: '¡Un mes completo!',
    emoji: '👑',
    color: '#f59e0b',
    milestone: 'Rey de la disciplina'
  },
  {
    id: 'streak_100',
    days: 100,
    name: 'Centenario de Fuego',
    description: '100 días de racha',
    emoji: '🏆',
    color: '#a9b71a',
    milestone: 'Eres una leyenda'
  }
]

/**
 * Componente principal de celebración de racha
 * Modal elegante con animación, emoji de racha, fuegos artificiales y confeti
 */
export default function StreakCelebration({ 
  milestone, 
  isVisible, 
  onClose,
  onRatingModalOpen  // Callback para abrir modal de calificación después de celebración
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
        // Abrir rating modal SOLO para rachas significativas (3+ días), NO para día 1
        if (onRatingModalOpen && milestone && milestone.days >= 3) {
          onRatingModalOpen({ id: `streak_${milestone.days}`, name: milestone.name })
        }
      }, 300)
    }, 5000)

    return () => clearTimeout(timer)
  }, [isVisible, onClose, onRatingModalOpen, milestone])

  if (!isVisible || !milestone) return null

  return (
    <div className={`streak-celebration ${isAnimating ? 'streak-celebration--active' : ''}`}>
      {/* Backdrop */}
      <div 
        className="streak-celebration__backdrop" 
        onClick={() => {
          setIsAnimating(false)
          setTimeout(() => {
            onClose()
            // Abrir rating modal SOLO para rachas significativas (3+ días)
            if (onRatingModalOpen && milestone && milestone.days >= 3) {
              onRatingModalOpen({ id: `streak_${milestone.days}`, name: milestone.name })
            }
          }, 300)
        }}
      />

      {/* Confeti y fuegos artificiales */}
      <Confetti />

      {/* Modal principal */}
      <div className="streak-celebration__modal">
        {/* Efecto de luz de fondo */}
        <div className="streak-celebration__glow" style={{ '--glow-color': milestone.color }} />

        {/* Contenedor del emoji de racha */}
        <div className="streak-celebration__streak-container">
          <div className="streak-celebration__streak-emoji">
            {milestone.emoji}
          </div>
          <div className="streak-celebration__streak-glow" style={{ '--glow-color': milestone.color }} />
        </div>

        {/* Líneas decorativas */}
        <div className="streak-celebration__decorative-line streak-celebration__decorative-line--top" />
        <div className="streak-celebration__decorative-line streak-celebration__decorative-line--bottom" />

        {/* Contenido de texto */}
        <div className="streak-celebration__content">
          <h1 className="streak-celebration__title">
            🔥 ¡{milestone.days} DÍAS! 🔥
          </h1>

          <div className="streak-celebration__badge" style={{
            '--badge-color': milestone.color
          }}>
            <span className="streak-celebration__streak-number">
              {milestone.emoji}
            </span>
          </div>

          <h2 className="streak-celebration__streak-name">
            {milestone.name}
          </h2>

          <p className="streak-celebration__streak-description">
            {milestone.description}
          </p>

          <div className="streak-celebration__milestone-message">
            {milestone.milestone}
          </div>

          {/* Estrellas animadas alrededor */}
          <div className="streak-celebration__stars">
            <span className="streak-celebration__star streak-celebration__star--1">⭐</span>
            <span className="streak-celebration__star streak-celebration__star--2">✨</span>
            <span className="streak-celebration__star streak-celebration__star--3">⭐</span>
          </div>

          {/* Botón para cerrar */}
          <button
            className="streak-celebration__close-button"
            onClick={() => {
              setIsAnimating(false)
              setTimeout(() => {
                onClose()
                // Abrir rating modal SOLO para rachas significativas (3+ días)
                if (onRatingModalOpen && milestone && milestone.days >= 3) {
                  onRatingModalOpen({ id: `streak_${milestone.days}`, name: milestone.name })
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
        <div className="streak-celebration__particles">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="streak-celebration__particle"
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
