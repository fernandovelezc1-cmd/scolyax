/**
 * MoodEvaluator – Evaluador de estado emocional post-login
 *
 * Pantalla que aparece para usuarios RECURRENTES (que ya completaron el test)
 * ANTES de mostrar el selector de herramientas.
 * Se muestra una vez por sesión de navegador (sessionStorage).
 *
 * Flujo:
 *   1. Usuario elige su estado de ánimo (5 opciones)
 *   2. Iris responde con un mensaje personalizado + estrategia
 *   3. Botón "Continuar a mis herramientas" → onComplete()
 */
import React, { useState, useEffect } from 'react'
import './MoodEvaluator.css'

const MOODS = [
  {
    emoji: '😴',
    label: 'Cansado/a',
    value: 'tired',
    color: '#94a3b8',
    response: 'Nota que estás cansado/a. Empecemos con algo liviano y a tu ritmo. No necesitas hacer todo hoy.',
    strategy: 'Haz 1 sola tarea pequeña hoy. El movimiento crea momentum.',
    tip: '💤',
  },
  {
    emoji: '😟',
    label: 'Estresado/a',
    value: 'stressed',
    color: '#f87171',
    response: 'Entiendo el estrés. Vamos a ordenar el caos juntos, paso a paso. Respira primero.',
    strategy: 'Escribe todo lo que te preocupa y prioriza solo 2 cosas para hoy.',
    tip: '🧘',
  },
  {
    emoji: '😐',
    label: 'Normal',
    value: 'neutral',
    color: '#94a3b8',
    response: 'Un día normal es un buen punto de partida. La constancia es el superpoder del éxito.',
    strategy: 'Sigue tu plan habitual y completa al menos una tarea antes del mediodía.',
    tip: '🎯',
  },
  {
    emoji: '😊',
    label: '¡Bien!',
    value: 'good',
    color: '#a9b71a',
    response: '¡Qué buena energía! Aprovechémosla bien. Hoy puede ser un día de grandes avances.',
    strategy: 'Empieza con la tarea más difícil — estás en el mejor estado para enfrentarla.',
    tip: '🚀',
  },
  {
    emoji: '🔥',
    label: '¡Con energía!',
    value: 'energized',
    color: '#f59e0b',
    response: '¡Perfecto! Estás listo/a para producir al máximo. Vamos a aprovecharlo al 100%.',
    strategy: 'Agenda 2 sesiones de estudio hoy y ponle un timer. ¡Tú puedes con todo!',
    tip: '⚡',
  },
]

export default function MoodEvaluator({ userName = 'Estudiante', onComplete, isDark = false }) {
  const firstName = (userName || '').split(' ')[0] || 'Estudiante'
  const [visible, setVisible] = useState(false)
  const [selectedMood, setSelectedMood] = useState(null)
  const [showResponse, setShowResponse] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  const handleMoodSelect = (mood) => {
    setSelectedMood(mood)
    setTimeout(() => setShowResponse(true), 300)
  }

  const handleContinue = () => {
    // Marcar como evaluado en esta sesión
    try { sessionStorage.setItem('scolyax.moodEvaluated', 'true') } catch (e) { /* ignore */ }
    setVisible(false)
    setTimeout(() => onComplete?.(), 350)
  }

  return (
    <div className={`me-overlay ${visible ? 'me-overlay--visible' : ''} ${isDark ? '' : 'me-light'}`}>
      <div className="me-card">

        {/* ── Iris ── */}
        <div className="me-avatar-wrap">
          <div className="me-avatar">🎓</div>
          <div className="me-avatar-ring" />
        </div>

        {!showResponse ? (
          /* ── Mood picker ── */
          <>
            <h1 className="me-title">
              ¡Bienvenido/a de nuevo, <span className="me-name">{firstName}</span>! 👋
            </h1>
            <p className="me-subtitle">¿Cómo te sientes hoy?</p>

            <div className="me-moods-grid">
              {MOODS.map(mood => (
                <button
                  key={mood.value}
                  className="me-mood-btn"
                  style={{ '--mood-color': mood.color }}
                  onClick={() => handleMoodSelect(mood)}
                >
                  <span className="me-mood-emoji">{mood.emoji}</span>
                  <span className="me-mood-label">{mood.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          /* ── Iris response ── */
          <div className="me-response">
            <div className="me-response-mood">
              <span className="me-response-emoji">{selectedMood?.emoji}</span>
              <span className="me-response-mood-label">{selectedMood?.label}</span>
            </div>

            <div className="me-speech-bubble">
              <p className="me-speech-text">{selectedMood?.response}</p>
            </div>

            <div className="me-strategy-card">
              <span className="me-strategy-tip">{selectedMood?.tip}</span>
              <p className="me-strategy-text">{selectedMood?.strategy}</p>
            </div>

            <button className="me-continue-btn" onClick={handleContinue}>
              ✨ Continuar a mis herramientas
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
