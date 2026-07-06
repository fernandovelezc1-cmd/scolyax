/**
 * Panel de recordatorios que gestiona avisos por correo electrónico.
 */
import React, { useState, useEffect, useMemo } from 'react'
import ConfirmDialog from './ConfirmDialog'
import notificationService from '../services/notificationService'
import './ReminderModal.css'
import './ReminderList.css'
import Sticker from './Stickers'

const providerLabels = {
  google: 'Gmail',
  microsoft: 'Outlook'
}

// Componente que permite crear y revisar recordatorios sincronizados.
const ReminderList = ({ reminders = [], onAdd, onUpdate, onDelete, session }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [type, setType] = useState('task')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editScheduledAt, setEditScheduledAt] = useState('')
  const [editType, setEditType] = useState('task')
  const [editError, setEditError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [reminderToDelete, setReminderToDelete] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const isSessionActive = Boolean(session)
  const activeProvider = session?.provider || 'google'

  // Escuchar evento para abrir modal de añadir recordatorio desde empty-state
  useEffect(() => {
    const handleOpenModal = () => {
      setIsModalOpen(true)
    }
    
    document.addEventListener('openReminderModal', handleOpenModal)
    return () => document.removeEventListener('openReminderModal', handleOpenModal)
  }, [])

  // Programar notificaciones nativas para recordatorios existentes
  useEffect(() => {
    const scheduledTimeouts = []

    reminders.forEach(reminder => {
      if (reminder.scheduled_at) {
        const timeoutId = notificationService.scheduleReminder({
          id: reminder.id,
          title: reminder.title,
          scheduled_at: reminder.scheduled_at
        })
        
        if (timeoutId) {
          scheduledTimeouts.push(timeoutId)
        }
      }
    })

    // Limpiar timeouts al desmontar
    return () => {
      scheduledTimeouts.forEach(timeoutId => {
        notificationService.cancelScheduledNotification(timeoutId)
      })
    }
  }, [reminders])

  // Restablece los campos del formulario tras crear un recordatorio.
  const resetForm = () => {
    setTitle('')
    setDescription('')
    setScheduledAt('')
    setType('task')
  }

  // Envía los datos del formulario al backend o al modo offline.
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!onAdd || isSubmitting) return

    if (!isSessionActive) {
      setError('Inicia sesión con Google o Microsoft para programar avisos por correo.')
      return
    }

    if (!title.trim() || !scheduledAt) {
      setError('Indica un título y una fecha para poder agendar el recordatorio.')
      return
    }

    setError('')
    setIsSubmitting(true)

    const created = await onAdd({
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      remindAt: new Date(scheduledAt).toISOString(),
      type
    })

    setIsSubmitting(false)

    if (created) {
      resetForm()
    }
  }

  // Abre el formulario de edición con los valores actuales del recordatorio.
  const handleEditStart = (reminder) => {
    setEditingId(reminder.id)
    setEditTitle(reminder.title)
    setEditDescription(reminder.description || '')
    setEditType(reminder.type || 'task')
    const isoValue = new Date(reminder.remind_at).toISOString().slice(0, 16)
    setEditScheduledAt(isoValue)
    setEditError('')
  }

  // Cancela la edición y limpia el estado temporal.
  const handleEditCancel = () => {
    setEditingId(null)
    setEditError('')
  }

  // Elimina un recordatorio
  const handleDeleteClick = (reminder) => {
    setReminderToDelete(reminder)
    setConfirmDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (reminderToDelete && onDelete) {
      onDelete(reminderToDelete.id)
      setReminderToDelete(null)
    }
  }

  // Envía al padre los cambios solicitados sobre un recordatorio.
  const handleEditSubmit = async (event) => {
    event.preventDefault()
    if (!editingId || !onUpdate || isUpdating) return

    if (!editTitle.trim() || !editScheduledAt) {
      setEditError('Indica título y fecha para actualizar el recordatorio.')
      return
    }

    const isoDate = new Date(editScheduledAt)
    if (Number.isNaN(isoDate.getTime())) {
      setEditError('Elige una fecha y hora válidas.')
      return
    }

    setIsUpdating(true)
    const updated = await onUpdate(editingId, {
      title: editTitle.trim(),
      description: editDescription.trim() ? editDescription.trim() : null,
      remindAt: isoDate.toISOString(),
      type: editType
    })
    setIsUpdating(false)

    if (updated) {
      setEditingId(null)
      setEditError('')
    }
  }

  const formattedReminders = useMemo(() => {
    return reminders
      .slice()
      .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())
  }, [reminders])

  const nextReminder = formattedReminders[0]

  const typeMeta = (t) => t === 'task'
    ? { emoji: '📚', label: 'Tarea', tone: 'a' }
    : t === 'focus'
      ? { emoji: '⏱️', label: 'Enfoque', tone: 'b' }
      : { emoji: '🎯', label: 'Personal', tone: 'c' }

  return (
    <div className="rmd">
      {/* Header */}
      <header className="rmd__head">
        <div className="rmd__head-text">
          <h2 id="reminders-heading" className="rmd__title">Recordatorios</h2>
          <p className="rmd__subtitle">Mantén todo bajo control con avisos automáticos</p>
        </div>
        <button className="rmd__new" type="button" onClick={() => setIsModalOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Nuevo recordatorio
        </button>
      </header>

      {/* Próximo — destacado */}
      {nextReminder && (
        <div className="rmd__next">
          <div className="rmd__next-body">
            <span className="rmd__next-badge">⏰ Tu próximo aviso</span>
            <h3 className="rmd__next-title">{nextReminder.title}</h3>
            {nextReminder.description && <p className="rmd__next-desc">{nextReminder.description}</p>}
          </div>
          <div className="rmd__next-time">
            <span className="rmd__next-hour">
              {new Date(nextReminder.remind_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
            <span className="rmd__next-date">
              {new Date(nextReminder.remind_at).toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="rmd__list">
        {formattedReminders.length > 0 ? (
          formattedReminders.map((reminder, index) => {
            const m = typeMeta(reminder.type)
            return (
              <article key={reminder.id} className={`rmd__card rmd__card--${m.tone} ${index === 0 ? 'rmd__card--next' : ''}`}>
                <span className="rmd__card-icon">{m.emoji}</span>
                <div className="rmd__card-body">
                  <div className="rmd__card-top">
                    <h4 className="rmd__card-title">{reminder.title}</h4>
                    <span className="rmd__card-chip">{m.label}</span>
                  </div>
                  {reminder.description && <p className="rmd__card-desc">{reminder.description}</p>}
                  <span className="rmd__card-time">
                    📅 {new Date(reminder.remind_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {new Date(reminder.remind_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
                <div className="rmd__card-actions">
                  <button type="button" className="rmd__card-act" onClick={() => handleEditStart(reminder)} disabled={!isSessionActive} title="Editar">✏️</button>
                  <button type="button" className="rmd__card-act rmd__card-act--del" onClick={() => handleDeleteClick(reminder)} title="Eliminar">🗑️</button>
                </div>
              </article>
            )
          })
        ) : (
          <div className="rmd__empty">
            <div className="rmd__empty-icon"><Sticker name="bell" size={56} /></div>
            <h3 className="rmd__empty-title">Sin recordatorios</h3>
            <p className="rmd__empty-text">Crea tu primer aviso y no se te escapará nada.</p>
            <button className="rmd__new" type="button" onClick={() => setIsModalOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Crear recordatorio
            </button>
          </div>
        )}
      </div>

      {/* Modal de formulario */}
      {isModalOpen && (
        <div className="modal-overlay--reminder" onClick={() => {
          setIsModalOpen(false)
          setError('')
        }}>
          <div className="modal-content--reminder" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header--reminder">
              <h3 className="modal-title--reminder">
                <span className="modal-title__icon--reminder"><Sticker name="clock" size={20} /></span>
                Nuevo Recordatorio
              </h3>
              <button 
                className="modal-close--reminder" 
                onClick={() => {
                  setIsModalOpen(false)
                  setError('')
                }}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <form className="modal-form--reminder" onSubmit={(e) => {
              e.preventDefault()
              handleSubmit(e)
              if (!error && !isSubmitting) {
                setIsModalOpen(false)
              }
            }}>
              <label className="form-field--reminder">
                <span className="form-field__label--reminder">
                  <span className="form-field__icon--reminder"><Sticker name="bell" size={15} /></span>
                  Título
                </span>
                <input
                  type="text"
                  className="form-field__input--reminder"
                  value={title}
                  placeholder="Ej. Entrega del ensayo"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <div className="form-row--reminder">
                <label className="form-field--reminder">
                  <span className="form-field__label--reminder">
                    <span className="form-field__icon--reminder"><Sticker name="tag" size={15} /></span>
                    Tipo
                  </span>
                  <select
                    className="form-field__select--reminder"
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                  >
                    <option value="task">Tarea</option>
                    <option value="focus">Enfoque</option>
                    <option value="personal">Personal</option>
                  </select>
                </label>

                <label className="form-field--reminder">
                  <span className="form-field__label--reminder">
                    <span className="form-field__icon--reminder"><Sticker name="calendar" size={15} /></span>
                    Fecha y hora
                  </span>
                  <input
                    type="datetime-local"
                    className="form-field__input--reminder"
                    value={scheduledAt}
                    placeholder="Selecciona fecha y hora"
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                </label>
              </div>

              <label className="form-field--reminder">
                <span className="form-field__label--reminder">
                  <span className="form-field__icon--reminder"><Sticker name="doc" size={15} /></span>
                  Notas (opcional)
                </span>
                <textarea
                  className="form-field__textarea--reminder"
                  value={description}
                  placeholder="Detalles para recordar el contexto"
                  onChange={(event) => setDescription(event.target.value)}
                  rows="3"
                />
              </label>

              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}

              <div className="modal-actions--reminder">
                <button 
                  type="button" 
                  className="btn btn--secondary-reminder"
                  onClick={() => {
                    setIsModalOpen(false)
                    setError('')
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn--primary-reminder"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Guardando…' : <><Sticker name="check" size={15} /> Agendar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit forms - inline */}
      {formattedReminders.map((reminder) => (
        editingId === reminder.id && (
          <form key={`edit-${reminder.id}`} className="reminder-edit" onSubmit={handleEditSubmit}>
            <div className="reminder-edit__grid">
              <label className="reminder-edit__label">
                <span>Título</span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  disabled={isUpdating}
                />
              </label>
              <label className="reminder-edit__label">
                <span>Tipo</span>
                <select
                  value={editType}
                  onChange={(event) => setEditType(event.target.value)}
                  disabled={isUpdating}
                >
                  <option value="task">Tarea</option>
                  <option value="focus">Enfoque</option>
                  <option value="personal">Personal</option>
                </select>
              </label>
              <label className="reminder-edit__label">
                <span>Fecha y hora</span>
                <input
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={(event) => setEditScheduledAt(event.target.value)}
                  disabled={isUpdating}
                />
              </label>
              <label className="reminder-edit__label reminder-edit__label--wide">
                <span>Notas</span>
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  disabled={isUpdating}
                />
              </label>
            </div>
            <div className="reminder-edit__actions">
              {editError && (
                <span className="reminder-edit__error" role="alert">
                  {editError}
                </span>
              )}
              <div className="reminder-edit__buttons">
                <button type="button" className="ghost-button" onClick={handleEditCancel} disabled={isUpdating}>
                  Cancelar
                </button>
                <button type="submit" className="primary" disabled={isUpdating}>
                  {isUpdating ? 'Actualizando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </form>
        )
      ))}
      
      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="¿Eliminar recordatorio?"
        message={reminderToDelete ? `¿Estás seguro de eliminar "${reminderToDelete.title}"? Esta acción no se puede deshacer.` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  )
}

export default ReminderList
