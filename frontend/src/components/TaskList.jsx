/**
 * Lista de tareas académicas — vista lista estilo ClickUp.
 */
import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import ConfirmDialog from './ConfirmDialog'
import { ACHIEVEMENTS } from './AchievementSystem'
import './TaskModal.css'
import './TaskBoard.css'
import Sticker from './Stickers'

const STATUS_CONFIG = {
  in_progress: {
    key: 'in_progress',
    label: 'En Curso',
    color: 'var(--status-progress-color, #f59e0b)',
    bgColor: 'var(--status-progress-bg, rgba(245, 158, 11, 0.12))',
    labelColor: 'var(--status-progress-color, #f59e0b)',
    icon: <span className="tl-dot tl-dot--progress" />
  },
  pending: {
    key: 'pending',
    label: 'Pendiente',
    color: 'var(--status-pending-color, #6b7280)',
    bgColor: 'var(--status-pending-bg, rgba(107, 114, 128, 0.1))',
    labelColor: 'var(--status-pending-color, #6b7280)',
    icon: <span className="tl-dot tl-dot--pending" />
  },
  completed: {
    key: 'completed',
    label: 'Completada',
    color: 'var(--status-completed-color, #16a34a)',
    bgColor: 'var(--status-completed-bg, rgba(22, 163, 74, 0.12))',
    labelColor: 'var(--status-completed-color, #16a34a)',
    icon: <span className="tl-dot tl-dot--completed" />
  }
}

const STATUS_ORDER = ['in_progress', 'pending', 'completed']

// Componente que presenta las tareas en vista lista estilo ClickUp.
const TaskList = ({ tasks = [], onMarkComplete, onAdd, isSessionActive = true, onDelete, unlockedAchievements = [] }) => {
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [latestAchievement, setLatestAchievement] = useState(null)
  const [aiEstimate, setAiEstimate] = useState(null)
  const [isGettingEstimate, setIsGettingEstimate] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [hoveredTask, setHoveredTask] = useState(null)

  // Obtener el logro más reciente desbloqueado
  useEffect(() => {
    if (unlockedAchievements && unlockedAchievements.length > 0) {
      const latestId = unlockedAchievements[unlockedAchievements.length - 1]
      const achievement = ACHIEVEMENTS.find(a => a.id === latestId)
      setLatestAchievement(achievement)
    }
  }, [unlockedAchievements])

  // Escuchar evento para abrir modal de añadir tarea desde empty-state
  useEffect(() => {
    const handleOpenModal = () => setIsModalOpen(true)
    document.addEventListener('openTaskModal', handleOpenModal)
    return () => document.removeEventListener('openTaskModal', handleOpenModal)
  }, [])

  // Las notificaciones push de tareas próximas a vencer se gestionan
  // desde el backend (notification_scheduler) para evitar duplicados.

  const handleGetEstimate = async () => {
    if (!title.trim()) { setError('Escribe el título de la tarea para obtener una estimación'); return }
    setIsGettingEstimate(true)
    setError('')
    try {
      const sessionToken = localStorage.getItem('scolyax.sessionToken')
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')
      const response = await fetch(`${apiUrl}/tasks/estimate-pomodoros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ title: title.trim(), course, notes, due_date: dueDate || null })
      })
      if (response.ok) { setAiEstimate(await response.json()) }
      else { setError('No se pudo obtener la estimación. Intenta nuevamente.') }
    } catch (err) {
      console.error('Error al obtener estimación de pomodoros:', err)
      setError('Error de conexión al obtener la estimación.')
    } finally { setIsGettingEstimate(false) }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!onAdd || isSubmitting) return
    if (!title.trim()) { setError('Añade el título de la tarea para poder registrarla.'); return }
    setError('')
    // Cerrar modal inmediatamente (optimistic)
    const taskData = { title: title.trim(), course, dueDate, notes, estimated_pomodoros: aiEstimate ? aiEstimate.estimated_pomodoros : 0 }
    setTitle(''); setCourse(''); setDueDate(''); setNotes(''); setAiEstimate(null); setIsModalOpen(false)
    // Sincronizar en segundo plano
    onAdd(taskData)
  }

  const handleDeleteClick = (task) => { setTaskToDelete(task); setConfirmDialogOpen(true) }
  const handleDeleteConfirm = () => { if (taskToDelete && onDelete) { onDelete(taskToDelete.id); setTaskToDelete(null) } }
  const toggleGroup = (status) => setCollapsedGroups(prev => ({ ...prev, [status]: !prev[status] }))

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const modalContent = isModalOpen ? ReactDOM.createPortal(
    <div className="modal-overlay--task" onClick={() => { setIsModalOpen(false); setError('') }}>
      <div className="modal-content--task" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header--task">
              <h3 className="modal-title--task">
                <span className="modal-title__icon--task"><Sticker name="write" size={20} /></span>
                Nueva Tarea
              </h3>
              <button className="modal-close--task" onClick={() => { setIsModalOpen(false); setError('') }} aria-label="Cerrar">✕</button>
            </div>
            <form className="modal-form--task" onSubmit={handleSubmit}>
              <label className="form-field--task">
                <span className="form-field__label--task"><span className="form-field__icon--task"><Sticker name="write" size={15} /></span>Título de tarea</span>
                <input type="text" className="form-field__input--task" value={title} placeholder="Ej. Ensayo de literatura" onChange={(e) => setTitle(e.target.value)} />
              </label>
              <div className="form-row--task">
                <label className="form-field--task">
                  <span className="form-field__label--task"><span className="form-field__icon--task"><Sticker name="cap" size={15} /></span>Asignatura</span>
                  <input type="text" className="form-field__input--task" value={course} placeholder="Ej. Literatura" onChange={(e) => setCourse(e.target.value)} />
                </label>
                <label className="form-field--task">
                  <span className="form-field__label--task"><span className="form-field__icon--task"><Sticker name="calendar" size={15} /></span>Fecha de entrega</span>
                  <input type="datetime-local" className="form-field__input--task" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </label>
              </div>
              <label className="form-field--task">
                <span className="form-field__label--task"><span className="form-field__icon--task"><Sticker name="doc" size={15} /></span>Notas (opcional)</span>
                <textarea className="form-field__textarea--task" value={notes} placeholder="Indicaciones, enlaces o apoyos" onChange={(e) => setNotes(e.target.value)} rows="3" />
              </label>
              <div className="ai-estimate-section--task">
                <button type="button" className="btn--task btn--ai-estimate" onClick={handleGetEstimate} disabled={isGettingEstimate || !title.trim()}>
                  <Sticker name="spark" size={16} />{isGettingEstimate ? 'Analizando…' : '¿Cuánto tiempo tomará? (IA)'}
                </button>
              </div>
              {aiEstimate && (
                <div className="ai-estimate-result--task">
                  <div className="ai-estimate-header--task">
                    <span className="ai-estimate-icon--task"><Sticker name="spark" size={18} /></span>
                    <h4 className="ai-estimate-title--task">Iris sugiere:</h4>
                  </div>
                  <div className="ai-estimate-body--task">
                    <div className="ai-estimate-pomodoros--task">
                      <span className="pomodoro-count--task">{aiEstimate.estimated_pomodoros}</span>
                      <span className="pomodoro-label--task">{aiEstimate.estimated_pomodoros === 1 ? 'pomodoro' : 'pomodoros'} (25 min c/u)</span>
                    </div>
                    <div className="ai-estimate-confidence--task">
                      <span className="confidence-label--task">Confianza:</span>
                      <div className="confidence-bar--task"><div className="confidence-fill--task" style={{ width: `${aiEstimate.confidence * 100}%` }} /></div>
                      <span className="confidence-value--task">{(aiEstimate.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="ai-estimate-reasoning--task"><p className="reasoning-text--task">{aiEstimate.reasoning}</p></div>
                    {aiEstimate.suggestions && aiEstimate.suggestions.length > 0 && (
                      <div className="ai-estimate-suggestions--task">
                        <p className="suggestions-title--task"><Sticker name="bulb" size={15} /> Consejos:</p>
                        <ul className="suggestions-list--task">{aiEstimate.suggestions.map((s, i) => <li key={i} className="suggestion-item--task">{s}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {error && <div className="form-error--task" role="alert">{error}</div>}
              <div className="modal-actions--task">
                <button type="button" className="btn--task btn--secondary-task" onClick={() => { setIsModalOpen(false); setError('') }}>Cancelar</button>
                <button type="submit" className="btn--task btn--primary-task" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : <><Sticker name="check" size={15} /> Añadir</>}</button>
              </div>
            </form>
          </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      {modalContent}

      <div className="tk">
        {/* Header */}
        <header className="tk__head">
          <div className="tk__head-text">
            <h2 className="tk__title">Tu plan de estudio</h2>
            <p className="tk__subtitle">Organiza tus tareas por estado y avanza columna a columna</p>
          </div>
          <button className="tk__new" onClick={() => setIsModalOpen(true)} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Nueva tarea
          </button>
        </header>

        {tasks.length > 0 ? (
          <div className="tk__board">
            {STATUS_ORDER.map(statusKey => {
              const cfg = STATUS_CONFIG[statusKey]
              const groupTasks = tasks.filter(t => t.status === statusKey)
              return (
                <section key={statusKey} className={`tk__col tk__col--${statusKey}`}>
                  <div className="tk__col-head">
                    <span className="tk__col-dot" />
                    <span className="tk__col-label">{cfg.label}</span>
                    <span className="tk__col-count">{groupTasks.length}</span>
                  </div>

                  <div className="tk__col-body">
                    {groupTasks.map(task => {
                      const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'
                      return (
                        <article key={task.id} className={`tk__card ${task.status === 'completed' ? 'tk__card--done' : ''}`}>
                          <button
                            className="tk__card-check"
                            onClick={() => { if (task.status !== 'completed') onMarkComplete(task.id) }}
                            title={task.status === 'completed' ? 'Completada' : 'Marcar como completada'}
                          >
                            {task.status === 'completed' && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            )}
                          </button>
                          <div className="tk__card-body">
                            <h4 className="tk__card-title">{task.title}</h4>
                            {(task.course?.trim() || task.due_date || task.estimated_pomodoros > 0) && (
                              <div className="tk__card-meta">
                                {task.course?.trim() && <span className="tk__chip"><Sticker name="cap" size={13} /> {task.course.trim()}</span>}
                                {task.due_date && <span className={`tk__chip tk__chip--due ${overdue ? 'is-overdue' : ''}`}><Sticker name="calendar" size={13} /> {formatDate(task.due_date)}</span>}
                                {task.estimated_pomodoros > 0 && <span className="tk__chip"><Sticker name="tomato" size={13} /> {task.estimated_pomodoros}</span>}
                              </div>
                            )}
                            {task.notes && <p className="tk__card-notes">{task.notes}</p>}
                          </div>
                          {task.status === 'completed' && (
                            <button className="tk__card-del" onClick={() => handleDeleteClick(task)} title="Eliminar">
                              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4m2 0v9.33a1.33 1.33 0 01-1.34 1.34H4.67a1.33 1.33 0 01-1.34-1.34V4h9.34z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                          )}
                        </article>
                      )
                    })}
                    {groupTasks.length === 0 && <p className="tk__col-empty">Sin tareas</p>}
                    <button className="tk__col-add" onClick={() => setIsModalOpen(true)} type="button">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                      Añadir
                    </button>
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="tk__empty">
            <div className="tk__empty-icon"><Sticker name="tasks" size={56} /></div>
            <h3 className="tk__empty-title">Tu tablero está vacío</h3>
            <p className="tk__empty-text">Crea tu primera tarea y organízala por estado en el tablero.</p>
            <button className="tk__new" onClick={() => setIsModalOpen(true)} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Crear primera tarea
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="¿Eliminar tarea?"
        message={taskToDelete ? `¿Estás seguro de eliminar "${taskToDelete.title}"? Esta acción no se puede deshacer.` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </>
  )
}

export default TaskList
