/**
 * AchievementSystem - Sistema de logros y badges con motivación
 */
import React, { useState, useEffect } from 'react'
import './AchievementSystem.css'

// Frases motivacionales dinámicas según progreso
const MOTIVATIONAL_QUOTES = {
  beginner: [
    "🌱 Cada pequeño paso es un progreso. ¡Tú puedes!",
    "✨ Tu esfuerzo de hoy es el éxito de mañana.",
    "🎯 Acabas de empezar. Grandes cosas vienen.",
    "💪 El éxito es un viaje, no un destino."
  ],
  intermediate: [
    "🔥 ¡Vas increíble! Tu compromiso es inspirador!",
    "🚀 Ya creciste mucho. ¡Sigue así!",
    "💡 Estás en el camino correcto. No pares.",
    "⭐ Tu consistencia es tu mayor fortaleza."
  ],
  advanced: [
    "👑 You're a champion! ¡Eres una leyenda!",
    "🏆 Lograste lo que otros solo sueñan.",
    "💎 Tu dedicación ha pagado. ¡Increíble!",
    "🌟 Eres una inspiración para otros."
  ]
}

// Retos diarios para mantener motivación
const DAILY_CHALLENGES = [
  { id: 'daily_3_tasks', name: 'Triple Logro', description: 'Completa 3 tareas hoy', emoji: '📚', reward: 5 },
  { id: 'daily_2_pomodoro', name: 'Doble Concentración', description: 'Completa 2 sesiones de Focus hoy', emoji: '📖', reward: 3 },
  { id: 'daily_early', name: 'Madrugador', description: 'Estudia antes de las 8am', emoji: '🌅', reward: 4 }
]

// Definición de todos los logros disponibles
export const ACHIEVEMENTS = [
  {
    id: 'first_task',
    name: 'Primera Tarea',
    description: 'Completa tu primera tarea',
    emoji: '🏆',
    color: '#60a5fa',
    condition: (stats) => stats.tasksCompleted >= 1,
    milestone: true
  },
  {
    id: 'week_streak',
    name: 'Semana de Fuego',
    description: '7 días de racha consecutivos',
    emoji: '🔥',
    color: '#ef4444',
    condition: (stats) => stats.streakDays >= 7,
    milestone: true
  },
  {
    id: 'month_streak',
    name: 'Mes Perfecto',
    description: '30 días de racha consecutivos',
    emoji: '⭐',
    color: '#f59e0b',
    condition: (stats) => stats.streakDays >= 30,
    milestone: true
  },
  {
    id: '100_tasks',
    name: 'Centurión',
    description: 'Completa 100 tareas',
    emoji: '🎯',
    color: '#a9b71a',
    condition: (stats) => stats.tasksCompleted >= 100,
    milestone: true
  },
  {
    id: '50_pomodoros',
    name: 'Maestro Pomodoro',
    description: 'Completa 50 sesiones de enfoque',
    emoji: '⏰',
    color: '#ec4899',
    condition: (stats) => stats.pomodoroSessions >= 50,
    milestone: true
  },
  {
    id: 'night_owl',
    name: 'Noche de Estudio',
    description: 'Estudia después de las 10pm',
    emoji: '🦉',
    color: '#c9d62f',
    condition: (stats) => stats.nightSessions >= 1
  },
  {
    id: 'early_bird',
    name: 'Madrugador',
    description: 'Estudia antes de las 7am',
    emoji: '🌅',
    color: '#a9b71a',
    condition: (stats) => stats.morningSessions >= 1
  },
  {
    id: 'triple_crown',
    name: 'Triple Corona',
    description: 'Completa tareas, recordatorios y pomodoro en un día',
    emoji: '👑',
    color: '#f59e0b',
    condition: (stats) => stats.tripleDay >= 1
  },
  {
    id: 'speed_demon',
    name: 'Demonio Veloz',
    description: 'Completa 10 tareas en un día',
    emoji: '⚡',
    color: '#facc15',
    condition: (stats) => stats.maxTasksPerDay >= 10
  },
  {
    id: 'consistency_king',
    name: 'Rey de la Consistencia',
    description: '14 días de racha consecutivos',
    emoji: '💎',
    color: '#c9d62f',
    condition: (stats) => stats.streakDays >= 14,
    milestone: true
  }
]

const AchievementBadge = ({ achievement, unlocked, onClick }) => (
  <button
    className={`gm__badge ${unlocked ? 'is-unlocked' : 'is-locked'}`}
    onClick={() => onClick(achievement)}
    type="button"
    style={{ '--c': achievement.color }}
  >
    <span className="gm__badge-emoji">{unlocked ? achievement.emoji : '🔒'}</span>
    <span className="gm__badge-name">{unlocked ? achievement.name : '???'}</span>
    {achievement.milestone && unlocked && <span className="gm__badge-tag">Hito</span>}
  </button>
)

const AchievementModal = ({ achievement, isOpen, onClose }) => {
  if (!isOpen || !achievement) return null

  return (
    <div className="gm__modal-overlay" onClick={onClose}>
      <div className="gm__modal" onClick={(e) => e.stopPropagation()} style={{ '--c': achievement.color }}>
        <button className="gm__modal-close" onClick={onClose} type="button">✕</button>
        <div className="gm__modal-emoji">{achievement.emoji}</div>
        <h3 className="gm__modal-name">{achievement.name}</h3>
        <p className="gm__modal-desc">{achievement.description}</p>
        {achievement.milestone && <span className="gm__modal-tag">★ Logro hito</span>}
      </div>
    </div>
  )
}

const AchievementSystem = ({ stats, userEmail, onAchievementUnlocked, unlockedAchievements, setParentUnlockedAchievements: setParentUnlockedAchievements, onRatingModalOpen, xp, streakDays }) => {
  // Usar props del padre para sincronización correcta
  const [selectedAchievement, setSelectedAchievement] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [motivationalQuote, setMotivationalQuote] = useState('')

  // Determinar el nivel de progreso del usuario
  const getProgressLevel = () => {
    const unlockedCount = unlockedAchievements.length
    if (unlockedCount === 0) return 'beginner'
    if (unlockedCount < 5) return 'beginner'
    if (unlockedCount < 8) return 'intermediate'
    return 'advanced'
  }

  // Mostrar frase motivacional aleatoria
  useEffect(() => {
    const level = getProgressLevel()
    const quotes = MOTIVATIONAL_QUOTES[level]
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)]
    setMotivationalQuote(randomQuote)
  }, [unlockedAchievements.length])

  // Verificar logros desbloqueados
  useEffect(() => {
    ACHIEVEMENTS.forEach((achievement) => {
      if (!unlockedAchievements.includes(achievement.id) && achievement.condition(stats)) {
        // Nuevo logro desbloqueado!
        console.log('🏆 ACHIEVEMENT UNLOCKED:', achievement.name)
        
        const newUnlocked = [...unlockedAchievements, achievement.id]
        
        // Actualizar el estado en el padre (App.jsx)
        if (setParentUnlockedAchievements) {
          setParentUnlockedAchievements(newUnlocked)
        }
        
        // También guardar en localStorage como backup
        localStorage.setItem('scolyax.achievements', JSON.stringify(newUnlocked))
        
        // Notificar al componente padre (App.jsx manejará la celebración)
        if (onAchievementUnlocked) {
          onAchievementUnlocked(achievement)
        }

        // También mostrar notificación del navegador
        showAchievementNotification(achievement)
      }
    })
  }, [stats, unlockedAchievements, onAchievementUnlocked, setParentUnlockedAchievements])

  const showAchievementNotification = (achievement) => {
    // Notificación del navegador (si tiene permiso)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`🎉 ¡Logro Desbloqueado!`, {
          body: `${achievement.emoji} ${achievement.name}: ${achievement.description}`,
          icon: '/vite.svg',
          badge: '/vite.svg',
          tag: `achievement-${achievement.id}`,
          requireInteraction: false
        })
      } catch (e) {
        console.error('Error mostrando notificación:', e)
      }
    }
  }

  const handleBadgeClick = (achievement) => {
    setSelectedAchievement(achievement)
    setIsModalOpen(true)
  }

  const unlockedCount = unlockedAchievements.length
  const totalCount = ACHIEVEMENTS.length
  const completionPercentage = Math.round((unlockedCount / totalCount) * 100)
  const progressLevel = getProgressLevel()
  const level = Math.floor((xp || 0) / 100) + 1
  const xpInLevel = (xp || 0) % 100

  return (
    <div className="gm">
      {/* Hero de gamificación */}
      <section className="gm__hero">
        <div className="gm__hero-top">
          <div className="gm__level">
            <span className="gm__level-num">{level}</span>
            <span className="gm__level-lbl">Nivel</span>
          </div>
          <div className="gm__hero-main">
            <p className="gm__quote">{motivationalQuote}</p>
            <div className="gm__xpbar">
              <div className="gm__xpbar-head"><span>Nivel {level}</span><span>{xpInLevel}/100 XP</span></div>
              <div className="gm__xpbar-track"><div className="gm__xpbar-fill" style={{ width: `${xpInLevel}%` }} /></div>
            </div>
          </div>
        </div>
        <div className="gm__stats">
          <div className="gm__stat"><span className="gm__stat-num">{xp || 0}</span><span className="gm__stat-lbl">XP total</span></div>
          <div className="gm__stat"><span className="gm__stat-num">{streakDays || 0}🔥</span><span className="gm__stat-lbl">Racha</span></div>
          <div className="gm__stat"><span className="gm__stat-num">{unlockedCount}/{totalCount}</span><span className="gm__stat-lbl">Logros</span></div>
          <div className="gm__stat"><span className="gm__stat-num">{completionPercentage}%</span><span className="gm__stat-lbl">Completado</span></div>
        </div>
      </section>

      {/* Retos de hoy */}
      <section className="gm__block">
        <h3 className="gm__block-title">📅 Retos de hoy</h3>
        <div className="gm__challenges">
          {DAILY_CHALLENGES.map((challenge) => (
            <div key={challenge.id} className="gm__challenge">
              <span className="gm__challenge-emoji">{challenge.emoji}</span>
              <div className="gm__challenge-body">
                <h4 className="gm__challenge-name">{challenge.name}</h4>
                <p className="gm__challenge-desc">{challenge.description}</p>
              </div>
              <span className="gm__challenge-reward">+{challenge.reward}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Logros */}
      <section className="gm__block">
        <div className="gm__block-head">
          <h3 className="gm__block-title">🎖️ Tus logros</h3>
          <span className="gm__block-count">{unlockedCount}/{totalCount}</span>
        </div>
        <div className="gm__badges">
          {ACHIEVEMENTS.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              unlocked={unlockedAchievements.includes(achievement.id)}
              onClick={handleBadgeClick}
            />
          ))}
        </div>
      </section>

      {/* Próximo hito */}
      {progressLevel !== 'advanced' && (
        <div className="gm__milestone">
          <span className="gm__milestone-icon">🎯</span>
          <p className="gm__milestone-text">
            {unlockedCount === 0 && '¡Desbloquea tu primer logro completando una tarea!'}
            {unlockedCount > 0 && unlockedCount < 5 && `Solo ${5 - unlockedCount} logro(s) para alcanzar nivel intermedio.`}
            {unlockedCount >= 5 && unlockedCount < 8 && `Solo ${8 - unlockedCount} logro(s) para alcanzar nivel avanzado.`}
          </p>
        </div>
      )}

      <AchievementModal
        achievement={selectedAchievement}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}

export default AchievementSystem
