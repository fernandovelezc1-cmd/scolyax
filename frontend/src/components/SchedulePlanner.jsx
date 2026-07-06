/**
 * Planificador semanal que combina formulario y calendario académico.
 */
import React, { useMemo, useState, useEffect } from 'react'
import WeeklyCalendar from './WeeklyCalendar'
import Sticker from './Stickers'
import './ScheduleModal.css'

const DAYS = [
  { value: 0, label: 'Lunes' },
  { value: 1, label: 'Martes' },
  { value: 2, label: 'Miércoles' },
  { value: 3, label: 'Jueves' },
  { value: 4, label: 'Viernes' },
  { value: 5, label: 'Sábado' },
  { value: 6, label: 'Domingo' }
]

// Formatea una cadena de tiempo HH:MM asegurando dos dígitos.
const formatTime = (value) => {
  if (!value) return ''
  const [hours, minutes] = String(value).split(':')
  return `${hours.padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}`
}

// Devuelve la etiqueta amigable para el día de la semana.
const formatDay = (day) => {
  const option = DAYS.find((item) => item.value === day)
  return option ? option.label : 'Día'
}

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

// Componente que permite crear bloques y visualizarlos en el calendario.
const SchedulePlanner = ({ schedule = [], tasks = [], onAdd, onDelete }) => {
  const [title, setTitle] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [calendarConnected, setCalendarConnected] = useState(() =>
    localStorage.getItem('scolyax.googleCalendarConnected') === '1'
  )

  // Escuchar cambios en localStorage (por si se conecta desde otra pestaña o el callback)
  useEffect(() => {
    const onStorage = () => {
      setCalendarConnected(localStorage.getItem('scolyax.googleCalendarConnected') === '1')
    }
    window.addEventListener('storage', onStorage)

    // Revisar al volver a la pestaña (en vez de cada 1s)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onStorage()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Revisar al hacer focus en la ventana (cubre caso misma pestaña)
    window.addEventListener('focus', onStorage)

    return () => {
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onStorage)
    }
  }, [])

  const handleConnectGoogleCalendar = () => {
    const token = localStorage.getItem('scolyax.sessionToken')
    if (!token) {
      alert('Debes iniciar sesión primero.')
      return
    }
    const nextUrl = encodeURIComponent(window.location.origin + window.location.pathname)
    window.location.href = `${API_URL}/auth/google/calendar/start?session_token=${encodeURIComponent(token)}&next=${nextUrl}`
  }

  // Escuchar el evento del FAB button para abrir el modal
  useEffect(() => {
    const handleOpenModal = () => {
      setIsModalOpen(true)
    }
    
    const container = document.querySelector('.schedule-container')
    if (container) {
      container.addEventListener('openScheduleModal', handleOpenModal)
      return () => container.removeEventListener('openScheduleModal', handleOpenModal)
    }
  }, [])

  const orderedEntries = useMemo(() => {
    return schedule
      .slice()
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) {
          return a.day_of_week - b.day_of_week
        }
        return String(a.start_time).localeCompare(String(b.start_time))
      })
  }, [schedule])

  // Limpia los campos del formulario después de guardar un bloque.
  const resetForm = () => {
    setTitle('')
    setDayOfWeek(0)
    setStartTime('08:00')
    setEndTime('09:00')
    setLocation('')
    setDescription('')
  }

  // Valida y envía un bloque nuevo al componente padre.
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!onAdd || isSubmitting) return

    if (!title.trim()) {
      setError('Añade el nombre de la clase o actividad para agendarla.')
      return
    }

    if (!startTime || !endTime) {
      setError('Define una hora de inicio y de fin para ubicarla en el calendario.')
      return
    }

    if (startTime >= endTime) {
      setError('La hora de fin debe ser posterior al inicio.')
      return
    }

    setError('')
    setIsSubmitting(true)

    const created = await onAdd({
      title: title.trim(),
      day_of_week: Number(dayOfWeek),
      start_time: startTime,
      end_time: endTime,
      location: location.trim() ? location.trim() : null,
      description: description.trim() ? description.trim() : null
    })

    setIsSubmitting(false)

    if (created) {
      resetForm()
      // ✅ Cerrar modal después de crear exitosamente
      setIsModalOpen(false)
    }
  }

  // Si no está conectado Google Calendar, mostrar solo el prompt
  if (!calendarConnected) {
    return (
      <div className="schedule-container">
        <div className="gcal__connect-prompt gcal__connect-prompt--full">
          <div className="gcal__connect-icon"><Sticker name="calendar" size={48} /></div>
          <h3 className="gcal__connect-title">Conecta tu Google Calendar</h3>
          <p className="gcal__connect-desc">
            Sincroniza tus eventos de Google Calendar para ver tu horario, tareas y compromisos.
          </p>
          <button className="gcal__connect-btn" onClick={handleConnectGoogleCalendar}>
            Conectar Google Calendar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="schedule-container">
      {/* Header Moderno */}
      <div className="schedule-header">
        <div className="schedule-header__content">
          <h2 id="schedule-heading" className="schedule-header__title">
            <span className="schedule-header__icon"><Sticker name="calendar" size={24} /></span>
            Tu Horario Colorido
          </h2>
          <p className="schedule-header__subtitle">
            Organiza tu tiempo y visualiza tus clases y compromisos
          </p>
        </div>
        <div className="schedule-header__stats">
          <div className="stat-card">
            <div className="stat-card__label">Total Clases</div>
            <div className="stat-card__value">{schedule.length}</div>
          </div>
        </div>
      </div>

      {/* Modal de formulario */}
      {isModalOpen && (
        <div className="modal-overlay--schedule" onClick={() => {
          setIsModalOpen(false)
          setError('')
        }}>
          <div className="modal-content--schedule" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header--schedule">
              <h3 className="modal-title--schedule">
                <span className="modal-title__icon--schedule"><Sticker name="calendar" size={20} /></span>
                Agenda tu semana
              </h3>
              <button 
                className="modal-close--schedule" 
                onClick={() => {
                  setIsModalOpen(false)
                  setError('')
                }}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <form className="modal-form--schedule" onSubmit={handleSubmit}>
              <label className="form-field--schedule">
                <span className="form-field__label--schedule">
                  <span className="form-field__icon--schedule"><Sticker name="write" size={15} /></span>
                  Título
                </span>
                <input
                  type="text"
                  className="form-field__input--schedule"
                  value={title}
                  placeholder="Seminario de investigación"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <div className="form-row--schedule">
                <label className="form-field--schedule">
                  <span className="form-field__label--schedule">
                    <span className="form-field__icon--schedule"><Sticker name="calendar" size={15} /></span>
                    Día
                  </span>
                  <select
                    className="form-field__select--schedule"
                    value={dayOfWeek}
                    onChange={(event) => setDayOfWeek(Number(event.target.value))}
                  >
                    {DAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field--schedule">
                  <span className="form-field__label--schedule">
                    <span className="form-field__icon--schedule"><Sticker name="pin" size={15} /></span>
                    Ubicación
                  </span>
                  <input
                    type="text"
                    className="form-field__input--schedule"
                    value={location}
                    placeholder="Aula 204 o virtual"
                    onChange={(event) => setLocation(event.target.value)}
                  />
                </label>
              </div>

              <div className="form-row--schedule">
                <label className="form-field--schedule">
                  <span className="form-field__label--schedule">
                    <span className="form-field__icon--schedule"><Sticker name="clock" size={15} /></span>
                    Inicio
                  </span>
                  <input
                    type="time"
                    className="form-field__input--schedule"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </label>

                <label className="form-field--schedule">
                  <span className="form-field__label--schedule">
                    <span className="form-field__icon--schedule"><Sticker name="clock" size={15} /></span>
                    Fin
                  </span>
                  <input
                    type="time"
                    className="form-field__input--schedule"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </label>
              </div>

              <label className="form-field--schedule">
                <span className="form-field__label--schedule">
                  <span className="form-field__icon--schedule"><Sticker name="doc" size={15} /></span>
                  Notas (opcional)
                </span>
                <textarea
                  className="form-field__textarea--schedule"
                  value={description}
                  placeholder="Material, preparación o apoyos"
                  onChange={(event) => setDescription(event.target.value)}
                  rows="2"
                />
              </label>

              {error && (
                <div className="form-error--schedule" role="alert">
                  {error}
                </div>
              )}

              <div className="modal-actions--schedule">
                <button 
                  type="button" 
                  className="btn--schedule btn--secondary-schedule"
                  onClick={() => {
                    setIsModalOpen(false)
                    setError('')
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn--schedule btn--primary-schedule"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Guardando…' : <><Sticker name="check" size={15} /> Guardar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="schedule-calendar-wrapper">
        <WeeklyCalendar
          scheduleEntries={schedule}
          tasks={tasks}
          onDeleteSchedule={onDelete}
          onOpenAddForm={() => setIsModalOpen(true)}
        />
      </div>
    </div>
  )
}

export default SchedulePlanner
