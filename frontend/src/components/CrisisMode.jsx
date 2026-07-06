/**
 * CrisisMode – Botón de Pánico / Modo Crisis
 *
 * Overlay de pantalla completa que guía al estudiante a través de:
 * 1. Mensaje calmante de Iris
 * 2. Ejercicio de respiración 4-7-8
 * 3. Descomposición automática de tareas en micro-pasos de 5 min
 * 4. "Solo haz esto" – mostrar UNA sola micro-tarea a la vez
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import Sticker from './Stickers'
import './CrisisMode.css'

const BREATHING_PHASES = [
  { label: 'Inhala', duration: 4, emoji: 'wave' },
  { label: 'Sostén', duration: 7, emoji: 'pause' },
  { label: 'Exhala', duration: 8, emoji: 'wave' },
]

const IRIS_MESSAGES = [
  'Estoy aquí contigo. Todo va a estar bien. 💜',
  'Respira profundo. No tienes que hacerlo todo ahora.',
  'Vamos paso a paso. Solo una cosita a la vez.',
  'Eres más capaz de lo que crees. Confía en ti.',
  'Es normal sentirse así. Vamos a resolverlo juntos.',
]

const TRIGGER_OPTIONS = [
  { emoji: 'alert', label: 'Tengo demasiado encima' },
  { emoji: 'compass', label: 'No sé por dónde empezar' },
  { emoji: 'heart', label: 'Me siento mal' },
  { emoji: 'clock', label: 'Se me acaba el tiempo' },
  { emoji: 'ban', label: 'Estoy bloqueado/a' },
]

const CrisisMode = ({
  isOpen,
  onClose,
  tasks = [],
  apiUrl,
  authenticatedFetch,
  onCrisisResolved,
  onRetakeTest,
}) => {
  const [phase, setPhase] = useState('welcome') // welcome | trigger | breathing | tasks | done | studyplan
  const [triggerReason, setTriggerReason] = useState(null)
  const [breathingCycle, setBreathingCycle] = useState(0)
  const [breathingPhaseIndex, setBreathingPhaseIndex] = useState(0)
  const [breathingTimer, setBreathingTimer] = useState(0)
  const [totalBreathingCycles, setTotalBreathingCycles] = useState(0)
  const [microTasks, setMicroTasks] = useState([])
  const [currentMicroTaskIndex, setCurrentMicroTaskIndex] = useState(0)
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [irisMessage, setIrisMessage] = useState(IRIS_MESSAGES[0])
  const [startTime] = useState(Date.now())

  // Leer plan de estudio guardado por IrisResults
  const savedStudyPlan = React.useMemo(() => {
    try {
      const raw = window.localStorage.getItem('scolyax.iris.studyPlan')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  const breathingRef = useRef(null)
  const timerRef = useRef(null)

  // Random iris message on open
  useEffect(() => {
    if (isOpen) {
      setIrisMessage(IRIS_MESSAGES[Math.floor(Math.random() * IRIS_MESSAGES.length)])
      setPhase('welcome')
      setBreathingCycle(0)
      setBreathingPhaseIndex(0)
      setTotalBreathingCycles(0)
      setCurrentMicroTaskIndex(0)
      setMicroTasks([])
      setTriggerReason(null)
    }
  }, [isOpen])

  // Breathing exercise timer
  useEffect(() => {
    if (phase !== 'breathing') return

    const currentPhase = BREATHING_PHASES[breathingPhaseIndex]
    setBreathingTimer(currentPhase.duration)

    timerRef.current = setInterval(() => {
      setBreathingTimer(prev => {
        if (prev <= 1) {
          // Move to next phase
          clearInterval(timerRef.current)
          const nextIndex = (breathingPhaseIndex + 1) % BREATHING_PHASES.length
          if (nextIndex === 0) {
            const newCycle = breathingCycle + 1
            setBreathingCycle(newCycle)
            setTotalBreathingCycles(newCycle)
            if (newCycle >= 3) {
              // 3 cycles done, move to tasks
              setPhase('tasks')
              loadMicroTasks()
              return 0
            }
          }
          setBreathingPhaseIndex(nextIndex)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [phase, breathingPhaseIndex, breathingCycle])

  const loadMicroTasks = useCallback(async () => {
    setIsLoadingTasks(true)
    try {
      const res = await authenticatedFetch(`${apiUrl}/crisis-mode/decompose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        setMicroTasks(data.micro_tasks || [])
      } else {
        // Fallback: generate locally from tasks prop
        const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress')
        const fallback = pending.slice(0, 3).map(t => ({
          title: `Trabaja 5 min en: ${t.title}`,
          estimated_minutes: 5,
          original_task_title: t.title,
        }))
        setMicroTasks(fallback.length > 0 ? fallback : [
          { title: 'Escribe 3 cosas que necesitas hacer', estimated_minutes: 5 },
          { title: 'Elige la más fácil y empieza', estimated_minutes: 5 },
        ])
      }
    } catch {
      const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress')
      const fallback = pending.slice(0, 3).map(t => ({
        title: `Trabaja 5 min en: ${t.title}`,
        estimated_minutes: 5,
        original_task_title: t.title,
      }))
      setMicroTasks(fallback.length > 0 ? fallback : [
        { title: '📝 Escribe 3 cosas que necesitas hacer', estimated_minutes: 5 },
        { title: '🎯 Elige la más fácil y empieza', estimated_minutes: 5 },
      ])
    } finally {
      setIsLoadingTasks(false)
    }
  }, [apiUrl, authenticatedFetch, tasks])

  const handleSelectTrigger = (trigger) => {
    setTriggerReason(trigger.label)
    setPhase('breathing')
  }

  const handleSkipBreathing = () => {
    setPhase('tasks')
    loadMicroTasks()
  }

  const handleNextMicroTask = () => {
    if (currentMicroTaskIndex < microTasks.length - 1) {
      setCurrentMicroTaskIndex(prev => prev + 1)
    } else {
      setPhase('done')
    }
  }

  const handleFinish = useCallback(async () => {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000)

    // Save crisis session to backend
    try {
      await authenticatedFetch(`${apiUrl}/crisis-mode/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_reason: triggerReason,
          breathing_completed: totalBreathingCycles >= 3,
          micro_tasks_generated: microTasks.length,
          duration_seconds: durationSeconds,
          resolved: phase === 'done',
        }),
      })
    } catch {
      // Silently fail – no bloquear la UX
    }

    if (onCrisisResolved) onCrisisResolved()
    onClose()
  }, [apiUrl, authenticatedFetch, triggerReason, totalBreathingCycles, microTasks, phase, startTime, onCrisisResolved, onClose])

  if (!isOpen) return null

  const currentBreathingPhase = BREATHING_PHASES[breathingPhaseIndex]
  const breathingProgress = currentBreathingPhase
    ? ((currentBreathingPhase.duration - breathingTimer) / currentBreathingPhase.duration) * 100
    : 0

  return (
    <div className="crisis-overlay" role="dialog" aria-modal="true" aria-label="Modo Crisis">
      {/* Close button */}
      <button className="crisis-close" onClick={handleFinish} aria-label="Cerrar modo crisis">
        ✕
      </button>

      {/* ── Phase: Welcome ── */}
      {phase === 'welcome' && (
        <div className="crisis-phase crisis-welcome">
          <div className="crisis-iris-avatar"><Sticker name="heart" size={64} /></div>
          <h2 className="crisis-iris-message">{irisMessage}</h2>
          <p className="crisis-subtitle">Iris está aquí para ayudarte</p>
          <button className="crisis-primary-btn" onClick={() => setPhase('trigger')}>
            Necesito ayuda
          </button>

          {savedStudyPlan && (
            <button className="crisis-studyplan-btn" onClick={() => setPhase('studyplan')}>
<Sticker name="flow" size={16} /> Ver mi plan de estudio de Iris
            </button>
          )}

          {onRetakeTest && (
            <div className="crisis-retake-card">
              <div className="crisis-retake-logo">
                <span className="crisis-retake-icon"><Sticker name="compass" size={20} /></span>
                <span className="crisis-retake-label">Test cognitivo</span>
              </div>
              <p className="crisis-retake-desc">
                ¿Ha cambiado tu forma de estudiar? Repite el test y Iris ajustará sus recomendaciones a tu perfil actual.
              </p>
              <button className="crisis-retake-btn" onClick={onRetakeTest}>
<Sticker name="repeat" size={15} /> Repetir el test
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Phase: Study plan ── */}
      {phase === 'studyplan' && (
        <div className="crisis-phase crisis-studyplan">
          <h2 className="crisis-studyplan-title"><Sticker name="flow" size={20} /> Tu plan de estudio</h2>
          {savedStudyPlan ? (
            <>
              <div className="crisis-studyplan-method">
                <span className="crisis-studyplan-badge">{savedStudyPlan.method}</span>
                <p className="crisis-studyplan-method-desc">{savedStudyPlan.methodDescription}</p>
              </div>

              <div className="crisis-studyplan-body">
                <div className="crisis-studyplan-tips">
                  <p className="crisis-studyplan-section-label"><Sticker name="bulb" size={15} /> Mis consejos para ti</p>
                  {(savedStudyPlan.tips || []).map((tip, i) => (
                    <div key={i} className="crisis-studyplan-tip">
                      <span className="crisis-studyplan-tip-num">{i + 1}</span>
                      <span className="crisis-studyplan-tip-text">{tip}</span>
                    </div>
                  ))}
                </div>

                <div className="crisis-studyplan-week">
                  <p className="crisis-studyplan-section-label"><Sticker name="calendar" size={15} /> Plan semanal</p>
                  {(savedStudyPlan.week || []).map((day, i) => (
                    <div key={i} className="crisis-studyplan-day">
                      <span className="crisis-studyplan-day-emoji"><Sticker name={day.icon || day.emoji || 'pin'} size={18} /></span>
                      <div className="crisis-studyplan-day-info">
                        <span className="crisis-studyplan-day-name">{day.day}</span>
                        <span className="crisis-studyplan-day-focus">{day.focus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="crisis-studyplan-empty">
              Completa el test cognitivo primero para obtener tu plan personalizado.
            </p>
          )}
          <button className="crisis-primary-btn" style={{ marginTop: '12px' }} onClick={() => setPhase('welcome')}>
            ← Volver
          </button>
        </div>
      )}

      {/* ── Phase: Trigger selection ── */}
      {phase === 'trigger' && (
        <div className="crisis-phase crisis-trigger">
          <h2 className="crisis-question">¿Qué sientes ahora mismo?</h2>
          <div className="crisis-trigger-grid">
            {TRIGGER_OPTIONS.map(opt => (
              <button
                key={opt.label}
                className="crisis-trigger-btn"
                onClick={() => handleSelectTrigger(opt)}
              >
                <span className="crisis-trigger-emoji"><Sticker name={opt.emoji} size={28} /></span>
                <span className="crisis-trigger-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Phase: Breathing exercise ── */}
      {phase === 'breathing' && (
        <div className="crisis-phase crisis-breathing">
          <p className="crisis-breathing-instruction">Respiración 4-7-8</p>
          <div className="crisis-breathing-circle" ref={breathingRef}>
            <div
              className={`crisis-breathing-fill crisis-breathing-fill--${currentBreathingPhase?.label?.toLowerCase()?.normalize('NFD')?.replace(/[\u0300-\u036f]/g, '') || 'inhala'}`}
              style={{ '--progress': `${breathingProgress}%` }}
            />
            <div className="crisis-breathing-content">
              <span className="crisis-breathing-emoji"><Sticker name={currentBreathingPhase?.emoji} size={36} /></span>
              <span className="crisis-breathing-label">{currentBreathingPhase?.label}</span>
              <span className="crisis-breathing-timer">{breathingTimer}</span>
            </div>
          </div>
          <p className="crisis-breathing-cycle">
            Ciclo {breathingCycle + 1} de 3
          </p>
          <button className="crisis-skip-btn" onClick={handleSkipBreathing}>
            Saltar a mis tareas →
          </button>
        </div>
      )}

      {/* ── Phase: Micro-tasks ── */}
      {phase === 'tasks' && (
        <div className="crisis-phase crisis-tasks">
          <h2 className="crisis-tasks-title">Solo haz esto</h2>

          {isLoadingTasks ? (
            <div className="crisis-loading">
              <div className="crisis-loading-spinner" />
              <p>Preparando tu siguiente paso...</p>
            </div>
          ) : microTasks.length > 0 ? (
            <>
              <div className="crisis-micro-task-card">
                <span className="crisis-micro-task-number">
                  {currentMicroTaskIndex + 1}/{microTasks.length}
                </span>
                <p className="crisis-micro-task-title">
                  {microTasks[currentMicroTaskIndex]?.title}
                </p>
                <span className="crisis-micro-task-time">
                  ~{microTasks[currentMicroTaskIndex]?.estimated_minutes || 5} min
                </span>
              </div>

              <button className="crisis-primary-btn" onClick={handleNextMicroTask}>
                {currentMicroTaskIndex < microTasks.length - 1
                  ? <><Sticker name="check" size={15} /> ¡Hecho! Siguiente</>
                  : <><Sticker name="trophy" size={15} /> ¡Terminé todo!</>}
              </button>

              {microTasks[currentMicroTaskIndex]?.original_task_title && (
                <p className="crisis-source-task">
                  De: {microTasks[currentMicroTaskIndex].original_task_title}
                </p>
              )}
            </>
          ) : (
            <p className="crisis-no-tasks">No hay tareas pendientes. ¡Relájate!</p>
          )}
        </div>
      )}

      {/* ── Phase: Done ── */}
      {phase === 'done' && (
        <div className="crisis-phase crisis-done">
          <div className="crisis-done-emoji"><Sticker name="spark" size={68} /></div>
          <h2 className="crisis-done-title">¡Lo lograste!</h2>
          <p className="crisis-done-subtitle">
            Completaste todos los micro-pasos. Cada pequeño avance cuenta.
          </p>
          <button className="crisis-primary-btn" onClick={handleFinish}>
            Volver a Scolyax
          </button>
        </div>
      )}
    </div>
  )
}

export default CrisisMode
