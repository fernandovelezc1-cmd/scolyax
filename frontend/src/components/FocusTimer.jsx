/**
 * Temporizador Pomodoro adaptable a distintos ritmos de estudio.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import alarmSystem from '../utils/alarmSystem'
import notificationService from '../services/notificationService'


const PRESET_MINUTES = [15, 25, 45]

// Componente que controla el conteo regresivo y notifica el fin de la sesión.
const FocusTimer = ({ onSessionComplete, tasks = [], onTaskUpdate }) => {
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [secondsRemaining, setSecondsRemaining] = useState(focusMinutes * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [volume, setVolume] = useState(alarmSystem.volume || 0.3)
  const [alarmsEnabled, setAlarmsEnabled] = useState(true)
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const intervalRef = useRef(null)
  const warningTimeRef = useRef(null)

  // Inicializa el sistema de alarmas al montar el componente
  useEffect(() => {
    alarmSystem.requestNotificationPermission()
  }, [])

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          const newSeconds = prev - 1;

          // Aviso sonoro a 1 minuto restante
          const warningThreshold = 60;
          if (newSeconds === warningThreshold && !warningTimeRef.current) {
            warningTimeRef.current = newSeconds;
            // Solo sonido, sin notificación del navegador
            alarmSystem.playWarningAlarm();
          }

          // Finalización del temporizador
          if (newSeconds <= 0) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            warningTimeRef.current = null;
            
            // Alarma sonora
            alarmSystem.playCompletionAlarm();
            
            // Notificación nativa del navegador
            notificationService.notifyPomodoroEnd();
            
            // Actualizar tarea si hay una seleccionada
            if (selectedTaskId && onTaskUpdate) {
              const selectedTask = tasks.find(t => t.id === selectedTaskId);
              if (selectedTask) {
                const updatedTask = {
                  ...selectedTask,
                  pomodoros_completed: (selectedTask.pomodoros_completed || 0) + 1,
                  time_spent_minutes: (selectedTask.time_spent_minutes || 0) + focusMinutes,
                  last_worked_at: new Date().toISOString()
                };
                onTaskUpdate(selectedTaskId, updatedTask);
                
                // Si completamos todos los pomodoros estimados, preguntar si terminó
                if (updatedTask.pomodoros_completed >= selectedTask.estimated_pomodoros && 
                    selectedTask.estimated_pomodoros > 0) {
                  // Mostrar confirmación (TODO: implementar modal de confirmación)
                  const finished = confirm(`¿Completaste la tarea "${selectedTask.title}"?`);
                  if (finished && onTaskUpdate) {
                    onTaskUpdate(selectedTaskId, { ...updatedTask, status: 'completed' });
                  }
                }
              }
            }
            
            // Pasar datos de la sesión completada
            const linkedTask = selectedTaskId && tasks.find(t => t.id === selectedTaskId);
            onSessionComplete({
              duration_minutes: focusMinutes,
              topic: linkedTask?.title || 'General',
              linked_task_id: selectedTaskId
            });
            return 0;
          }

          // Resetea el aviso cuando vuelve al rango normal
          if (newSeconds > warningThreshold && warningTimeRef.current) {
            warningTimeRef.current = null;
          }

          return newSeconds;
        });
      }, 1000);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning, focusMinutes, onSessionComplete])

  useEffect(() => {
    if (!isRunning) {
      setSecondsRemaining(focusMinutes * 60)
    }
  }, [focusMinutes, isRunning])

  const minutesDisplay = String(Math.floor(secondsRemaining / 60)).padStart(2, '0')
  const secondsDisplay = String(secondsRemaining % 60).padStart(2, '0')

  // Restaura el temporizador a la duración seleccionada.
  const handleReset = () => {
    clearInterval(intervalRef.current)
    setIsRunning(false)
    setSecondsRemaining(focusMinutes * 60)
  }

  // Alterna entre iniciar y pausar el conteo.
  const handleStartPause = () => {
    if (!isRunning) {
      alarmSystem.initAudio();
      // Notificar inicio de Pomodoro
      notificationService.notifyPomodoroStart(focusMinutes);

      // Auto-cambiar tarea a "en curso" si está pendiente
      if (selectedTaskId && onTaskUpdate) {
        const task = tasks.find(t => t.id === selectedTaskId);
        if (task && task.status === 'pending') {
          onTaskUpdate(selectedTaskId, { ...task, status: 'in_progress' });
        }
      }
    }
    setIsRunning((prev) => !prev);
  }

  // Cambia rápidamente la duración usando los accesos directos.
  const handlePresetChange = (minutes) => {
    clearInterval(intervalRef.current)
    setIsRunning(false)
    setFocusMinutes(minutes)
  }

  // Permite ajustar manualmente la duración del ciclo.
  const handleCustomChange = (event) => {
    const value = Number(event.target.value)
    if (Number.isNaN(value)) return
    const safeValue = Math.max(5, Math.min(90, value))
    setFocusMinutes(safeValue)
  }

  // Garantiza que la duración personalizada se mantenga en el rango permitido.
  const handleCustomBlur = () => {
    setFocusMinutes((prev) => {
      if (!prev) {
        return 25
      }
      return Math.max(5, Math.min(90, prev))
    })
  }

  // Manejadores para control de alarmas
  const handleVolumeChange = (value) => {
    setVolume(value)
    alarmSystem.setVolume(value)
  }

  const handleAlarmsToggle = (enabled) => {
    setAlarmsEnabled(enabled)
    alarmSystem.setEnabled(enabled)
  }

  const testAlarm = (type) => {
    switch (type) {
      case 'completion':
        alarmSystem.playCompletionAlarm()
        break
      case 'warning':
        alarmSystem.playWarningAlarm()
        break
      case 'break':
        alarmSystem.playBreakAlarm()
        break
      default:
        break
    }
  }

  return (
    <section
      className="panel panel--with-sticker"
      aria-labelledby="focus-heading"
      data-sticker="Tiempo de enfoque"
      data-icon="⏰"
    >
      <header className="panel__header">
        <div>
          <h2 id="focus-heading" className="panel__title">
            Ritmo Pomodoro
          </h2>
          <p className="panel__subtitle">Configura la duración que mejor encaje con tu energía de estudio y haz pausas activas.</p>
        </div>
      </header>

      {/* Selector de tarea */}
      {tasks && tasks.length > 0 && (
        <div className="timer__task-selector">
          <label htmlFor="task-selector" className="timer__task-label">
            <span className="timer__task-icon">🎯</span>
            ¿En qué tarea estás trabajando?
          </label>
          <select
            id="task-selector"
            className="timer__task-select"
            value={selectedTaskId || ''}
            onChange={(e) => setSelectedTaskId(e.target.value ? Number(e.target.value) : null)}
            disabled={isRunning}
          >
            <option value="">Sin tarea específica</option>
            {tasks
              .filter(t => t.status !== 'completed')
              .map(task => {
                const progress = task.estimated_pomodoros > 0 
                  ? `${task.pomodoros_completed || 0}/${task.estimated_pomodoros}` 
                  : `${task.pomodoros_completed || 0}`;
                return (
                  <option key={task.id} value={task.id}>
                    {task.title} ({progress} 🍅)
                  </option>
                );
              })}
          </select>

          {/* Barra de progreso si hay tarea seleccionada */}
          {selectedTaskId && (() => {
            const selectedTask = tasks.find(t => t.id === selectedTaskId);
            if (!selectedTask) return null;
            
            const completed = selectedTask.pomodoros_completed || 0;
            const estimated = selectedTask.estimated_pomodoros || 0;
            const percentage = estimated > 0 ? (completed / estimated) * 100 : 0;
            
            return (
              <div className="timer__task-progress">
                <div className="timer__task-progress-header">
                  <span className="timer__task-progress-title">
                    {selectedTask.title}
                  </span>
                  <span className="timer__task-progress-count">
                    {completed}/{estimated || '?'} pomodoros
                  </span>
                </div>
                {estimated > 0 && (
                  <div className="timer__task-progress-bar">
                    <div 
                      className="timer__task-progress-fill" 
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                )}
                {selectedTask.time_spent_minutes > 0 && (
                  <div className="timer__task-progress-time">
                    ⏱️ Tiempo dedicado: {Math.floor(selectedTask.time_spent_minutes / 60)}h {selectedTask.time_spent_minutes % 60}min
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <div className="timer" role="group" aria-label="Temporizador de enfoque">
        <div className="timer__display" aria-live="polite" aria-atomic="true">
          <span className="timer__time">
            {minutesDisplay}:{secondsDisplay}
          </span>
        </div>
        <div className="timer__presets" role="group" aria-label="Duraciones sugeridas">
          {PRESET_MINUTES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={`pill ${focusMinutes === minutes ? 'is-active' : ''}`}
              onClick={() => handlePresetChange(minutes)}
            >
              {minutes} min
            </button>
          ))}
        </div>
        <label htmlFor="custom-duration" className="timer__label">
          Duración personalizada (5-90 min)
        </label>
        <input
          id="custom-duration"
          type="number"
          min="5"
          max="90"
          value={focusMinutes}
          onChange={handleCustomChange}
          onBlur={handleCustomBlur}
        />
        <div className="timer__actions">
          <button type="button" className="primary" onClick={handleStartPause}>
            {isRunning ? 'Pausar' : 'Iniciar'}
          </button>
          <button type="button" className="ghost-button" onClick={handleReset}>
            Reiniciar
          </button>
        </div>

        {/* Panel de Control de Alarmas */}
        <div className="timer__alarms-panel">
          <h3 className="timer__alarms-title">⏰ Configuración de Alarmas</h3>
          
          <div className="timer__alarms-section">
            <label className="timer__alarms-checkbox">
              <input
                type="checkbox"
                checked={alarmsEnabled}
                onChange={(e) => handleAlarmsToggle(e.target.checked)}
              />
              <span>Activar alarmas</span>
            </label>
          </div>

          {alarmsEnabled && (
            <>
              <div className="timer__alarms-section">
                <label className="timer__alarms-label">
                  Volumen: <span className="timer__alarms-value">{Math.round(volume * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="timer__alarms-slider"
                  style={{ '--thumb-pos': `${volume * 100}%` }}
                />
              </div>

              <div className="timer__alarms-section">
                <p className="timer__alarms-subtitle">Probar alarmas</p>
                <div className="timer__alarms-buttons">
                  <button
                    type="button"
                    className="timer__alarms-test timer__alarms-test--completion"
                    onClick={() => testAlarm('completion')}
                  >
                    Finalización
                  </button>
                  <button
                    type="button"
                    className="timer__alarms-test timer__alarms-test--warning"
                    onClick={() => testAlarm('warning')}
                  >
                    Aviso
                  </button>
                  <button
                    type="button"
                    className="timer__alarms-test timer__alarms-test--break"
                    onClick={() => testAlarm('break')}
                  >
                    Pausa
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default FocusTimer
