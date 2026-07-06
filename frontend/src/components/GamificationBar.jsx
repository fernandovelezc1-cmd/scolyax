/**
 * GamificationBar - Barra de progreso con nivel, puntos y racha
 */
import React from 'react'

const LEVELS = [
  { level: 1, name: 'Principiante', minXP: 0, maxXP: 100, color: '#94a3b8' },
  { level: 2, name: 'Estudiante', minXP: 100, maxXP: 300, color: '#60a5fa' },
  { level: 3, name: 'Comprometido', minXP: 300, maxXP: 600, color: '#a9b71a' },
  { level: 4, name: 'Disciplinado', minXP: 600, maxXP: 1000, color: '#ec4899' },
  { level: 5, name: 'Maestro', minXP: 1000, maxXP: 2000, color: '#f59e0b' },
  { level: 6, name: 'Leyenda', minXP: 2000, maxXP: 99999, color: '#a9b71a' }
]

const getCurrentLevel = (xp) => {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) {
      return LEVELS[i]
    }
  }
  return LEVELS[0]
}

const getProgressToNextLevel = (xp, currentLevel) => {
  const { minXP, maxXP } = currentLevel
  const progress = ((xp - minXP) / (maxXP - minXP)) * 100
  return Math.min(100, Math.max(0, progress))
}

const GamificationBar = ({ xp = 0, streakDays = 0, onStreakClick }) => {
  const currentLevel = getCurrentLevel(xp)
  const progress = getProgressToNextLevel(xp, currentLevel)
  const xpToNext = currentLevel.maxXP - xp

  // Determinar estado de racha
  const getStreakEmoji = () => {
    if (streakDays === 0) return '💤'
    if (streakDays < 3) return '🔥'
    if (streakDays < 7) return '⭐'
    if (streakDays < 14) return '💎'
    if (streakDays < 30) return '👑'
    return '🏆'
  }

  const getStreakMessage = () => {
    if (streakDays === 0) return 'Comienza tu racha hoy'
    if (streakDays === 1) return '¡Primer día! Sigue así'
    if (streakDays < 7) return `${streakDays} días consecutivos`
    if (streakDays === 7) return '¡Una semana completa! 🎉'
    if (streakDays < 30) return `${streakDays} días - ¡Imparable!`
    if (streakDays === 30) return '¡UN MES PERFECTO! 🎊'
    return `${streakDays} días - ¡LEYENDA!`
  }

  return (
    <div className="gamification-bar">
      {/* Nivel y Progreso */}
      <div className="gamification-bar__level">
        <div className="gamification-bar__level-badge" style={{ backgroundColor: currentLevel.color }}>
          <span className="gamification-bar__level-number">{currentLevel.level}</span>
        </div>
        <div className="gamification-bar__level-info">
          <div className="gamification-bar__level-name">{currentLevel.name}</div>
          <div className="gamification-bar__level-xp">
            {xp} / {currentLevel.maxXP} XP
            {currentLevel.level < 6 && (
              <span className="gamification-bar__level-remaining"> (Faltan {xpToNext} XP)</span>
            )}
          </div>
        </div>
      </div>

      {/* Barra de Progreso */}
      <div className="gamification-bar__progress-container">
        <div 
          className="gamification-bar__progress-fill" 
          style={{ 
            width: `${progress}%`,
            backgroundColor: currentLevel.color
          }}
        >
          <div className="gamification-bar__progress-shine"></div>
        </div>
      </div>

      {/* Racha */}
      <button 
        className="gamification-bar__streak"
        onClick={onStreakClick}
        type="button"
        aria-label="Ver detalles de racha"
      >
        <span className="gamification-bar__streak-emoji">{getStreakEmoji()}</span>
        <div className="gamification-bar__streak-info">
          <div className="gamification-bar__streak-days">{streakDays}</div>
          <div className="gamification-bar__streak-label">{getStreakMessage()}</div>
        </div>
      </button>
    </div>
  )
}

export default GamificationBar
