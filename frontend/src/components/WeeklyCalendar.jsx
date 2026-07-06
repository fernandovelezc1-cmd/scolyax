/**
 * Calendario multi-vista estilo Google Calendar.
 * Vistas: agenda, día, 3 días, semana, mes.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { parseDateForCalendar } from '../utils/dateUtils'
import ConfirmDialog from './ConfirmDialog'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const WEEKDAY_MINI = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const VIEW_OPTIONS = [
  { id: 'agenda', label: 'Agenda', icon: '📋' },
  { id: 'day', label: 'Día', icon: '📅' },
  { id: '3day', label: '3 Días', icon: '📆' },
  { id: 'week', label: 'Semana', icon: '🗓️' },
  { id: 'month', label: 'Mes', icon: '📊' }
]

const readableStatus = {
  completed: 'Completada',
  pending: 'Pendiente',
  in_progress: 'En progreso'
}

const normalizeDate = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const getStartOfWeek = (date) => {
  const target = normalizeDate(date)
  const day = target.getDay()
  const dist = (day + 6) % 7
  target.setDate(target.getDate() - dist)
  return target
}

const toMinutes = (timeValue) => {
  if (!timeValue && timeValue !== 0) return null
  const parts = String(timeValue).split(':')
  return Number(parts[0] || 0) * 60 + Number(parts[1] || 0)
}

const formatRange = (start, end) => {
  if (!start) return 'Sin hora'
  const s = String(start).slice(0, 5)
  if (!end) return s
  return `${s} – ${String(end).slice(0, 5)}`
}

const isSameDay = (d1, d2) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate()

const formatHour = (h) => {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

const getMonthGrid = (year, month) => {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startWeekday = (firstDay.getDay() + 6) % 7
  const totalDays = lastDay.getDate()
  const grid = []
  for (let i = startWeekday - 1; i >= 0; i--) {
    grid.push({ date: new Date(year, month, -i), isCurrentMonth: false })
  }
  for (let i = 1; i <= totalDays; i++) {
    grid.push({ date: new Date(year, month, i), isCurrentMonth: true })
  }
  const remaining = 42 - grid.length
  for (let i = 1; i <= remaining; i++) {
    grid.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
  }
  return grid
}

const getDateRange = (view, date) => {
  const d = normalizeDate(date)
  let start, end
  switch (view) {
    case 'day':
      start = new Date(d); end = new Date(d); end.setDate(end.getDate() + 1); break
    case '3day':
      start = new Date(d); end = new Date(d); end.setDate(end.getDate() + 3); break
    case 'week':
      start = getStartOfWeek(d); end = new Date(start); end.setDate(end.getDate() + 7); break
    case 'month':
      start = new Date(d.getFullYear(), d.getMonth(), 1)
      end = new Date(d.getFullYear(), d.getMonth() + 1, 1); break
    default:
      start = new Date(d); end = new Date(d); end.setDate(end.getDate() + 30); break
  }
  return { start, end }
}

// ─── Componente principal ────────────────────────────────────────
const WeeklyCalendar = ({ scheduleEntries = [], tasks = [], onDeleteSchedule, onOpenAddForm }) => {
  const [currentView, setCurrentView] = useState(() =>
    window.innerWidth < 768 ? 'agenda' : 'week'
  )
  const [currentDate, setCurrentDate] = useState(() => normalizeDate(new Date()))
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [popoverEvent, setPopoverEvent] = useState(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState(null)
  const [googleEvents, setGoogleEvents] = useState([])
  const [loadingGoogleEvents, setLoadingGoogleEvents] = useState(false)
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(false)
  const [calendarConnected, setCalendarConnected] = useState(() =>
    localStorage.getItem('scolyax.googleCalendarConnected') === '1'
  )

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  const viewMenuRef = useRef(null)
  const viewToggleRef = useRef(null)
  const timeGridRef = useRef(null)
  const contentRef = useRef(null)
  const touchStartRef = useRef(null)
  const popoverRef = useRef(null)
  const [viewMenuPos, setViewMenuPos] = useState({ top: 0, left: 0 })

  // ─── Detect mobile & auto-switch view on resize ───────────
  useEffect(() => {
    let resizeTimer
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const mobile = window.innerWidth < 768
        setIsMobile(mobile)
        // Auto-switch from week→3day on mobile, or 3day→week on desktop
        if (mobile && currentView === 'week') setCurrentView('3day')
        if (!mobile && currentView === '3day') setCurrentView('week')
      }, 150)
    }
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(resizeTimer) }
  }, [currentView])

  // ─── Touch swipe navigation ──────────────────────────────
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
    }
    const onTouchEnd = (e) => {
      if (!touchStartRef.current) return
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y
      const dt = Date.now() - touchStartRef.current.t
      touchStartRef.current = null
      // Require horizontal > vertical, min 60px, max 400ms
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60 && dt < 400) {
        if (dx < 0) goNext()
        else goPrev()
      }
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  })

  // Cerrar menú de vistas al hacer clic fuera
  useEffect(() => {
    if (!viewMenuOpen && !popoverEvent) return
    const handler = (e) => {
      if (viewMenuOpen) {
        const inToggle = viewToggleRef.current && viewToggleRef.current.contains(e.target)
        const inMenu = viewMenuRef.current && viewMenuRef.current.contains(e.target)
        if (!inToggle && !inMenu) setViewMenuOpen(false)
      }
      if (popoverEvent && popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPopoverEvent(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [viewMenuOpen, popoverEvent])

  // Scroll a la hora actual en vistas con grilla horaria
  useEffect(() => {
    if (!timeGridRef.current || currentView === 'agenda' || currentView === 'month') return
    const now = new Date()
    const scrollTo = Math.max(0, (now.getHours() - 1) * 60)
    setTimeout(() => {
      if (timeGridRef.current) timeGridRef.current.scrollTop = scrollTo
    }, 100)
  }, [currentView])

  // Obtener eventos de Google Calendar (solo si el usuario conectó Calendar)
  useEffect(() => {
    if (!calendarConnected) return
    const fetchGoogleEvents = async () => {
      setLoadingGoogleEvents(true)
      try {
        const token = localStorage.getItem('scolyax.sessionToken')
        if (!token) { setLoadingGoogleEvents(false); return }
        const { start, end } = getDateRange(currentView, currentDate)
        const response = await fetch(
          `${API_URL}/calendar/google/events?time_min=${start.toISOString()}&time_max=${end.toISOString()}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        if (response.ok) {
          const data = await response.json()
          setGoogleEvents(data.events || [])
          setNeedsGoogleAuth(false)
        } else if (response.status === 401) {
          setGoogleEvents([])
          setNeedsGoogleAuth(true)
          // Token expirado o inválido: desconectar calendar
          localStorage.removeItem('scolyax.googleCalendarConnected')
          setCalendarConnected(false)
        }
      } catch (error) {
        console.error('Error fetching Google Calendar:', error)
        setGoogleEvents([])
      } finally {
        setLoadingGoogleEvents(false)
      }
    }
    fetchGoogleEvents()
  }, [currentDate, currentView, calendarConnected])

  // Obtener eventos para una fecha específica
  const getEventsForDate = useCallback((targetDate) => {
    const target = normalizeDate(targetDate)
    const dayIndex = (target.getDay() + 6) % 7

    const scheduleForDay = scheduleEntries
      .filter((e) => e.day_of_week === dayIndex)
      .map((e) => ({
        id: `schedule-${e.id}`, realId: e.id, title: e.title,
        meta: e.location, notes: e.description,
        range: formatRange(e.start_time, e.end_time),
        startMinutes: toMinutes(e.start_time),
        endMinutes: toMinutes(e.end_time),
        sortOrder: toMinutes(e.start_time), variant: 'schedule', date: target
      }))

    const taskEvents = tasks
      .filter((task) => {
        if (!task.due_date) return false
        const parsed = parseDateForCalendar(task.due_date)
        if (!parsed) return false
        return isSameDay(parsed, target)
      })
      .map((task) => {
        const parsed = parseDateForCalendar(task.due_date)
        const raw = task.due_date
        const hadExplicitTime = /T/.test(String(raw)) &&
          !String(raw).match(/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.\d+)?Z)?$/)
        const timeLabel = hadExplicitTime
          ? parsed.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          : 'Sin hora'
        return {
          id: `task-${task.id}`, title: task.title, meta: task.course,
          notes: task.notes, range: timeLabel,
          startMinutes: hadExplicitTime ? toMinutes(`${parsed.getHours()}:${parsed.getMinutes()}`) : null,
          endMinutes: hadExplicitTime ? toMinutes(`${parsed.getHours()}:${parsed.getMinutes()}`) + 60 : null,
          sortOrder: hadExplicitTime ? toMinutes(`${parsed.getHours()}:${parsed.getMinutes()}`) : null,
          variant: 'task', status: task.status, date: target
        }
      })

    const googleForDay = googleEvents
      .filter((event) => {
        if (!event.start) return false
        return isSameDay(new Date(event.start), target)
      })
      .map((event) => {
        const startDate = new Date(event.start)
        const endDate = new Date(event.end)
        const hadExplicitTime = !event.all_day
        const timeLabel = hadExplicitTime
          ? `${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
          : 'Todo el día'
        return {
          id: `google-${event.id}`, title: event.summary,
          meta: event.location || '📅 Google Calendar', notes: event.description,
          range: timeLabel,
          startMinutes: hadExplicitTime ? startDate.getHours() * 60 + startDate.getMinutes() : null,
          endMinutes: hadExplicitTime ? endDate.getHours() * 60 + endDate.getMinutes() : null,
          sortOrder: hadExplicitTime ? startDate.getHours() * 60 + startDate.getMinutes() : null,
          variant: 'google', htmlLink: event.html_link, date: target
        }
      })

    // Tasks no se muestran como bloques en el calendario — solo Google Calendar events
    const filteredTasks = []

    return [...scheduleForDay, ...filteredTasks, ...googleForDay].sort((a, b) =>
      (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity)
    )
  }, [scheduleEntries, tasks, googleEvents])

  // ─── Navegación ──────────────────────────
  const goToday = () => setCurrentDate(normalizeDate(new Date()))

  const goNext = () => {
    const d = new Date(currentDate)
    switch (currentView) {
      case 'day': d.setDate(d.getDate() + 1); break
      case '3day': d.setDate(d.getDate() + 3); break
      case 'week': d.setDate(d.getDate() + 7); break
      case 'month': d.setMonth(d.getMonth() + 1); break
      default: d.setDate(d.getDate() + 7); break
    }
    setCurrentDate(d)
  }

  const goPrev = () => {
    const d = new Date(currentDate)
    switch (currentView) {
      case 'day': d.setDate(d.getDate() - 1); break
      case '3day': d.setDate(d.getDate() - 3); break
      case 'week': d.setDate(d.getDate() - 7); break
      case 'month': d.setMonth(d.getMonth() - 1); break
      default: d.setDate(d.getDate() - 7); break
    }
    setCurrentDate(d)
  }

  const getHeaderTitle = () => {
    const d = currentDate
    switch (currentView) {
      case 'day':
        return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      case '3day': {
        const end = new Date(d); end.setDate(end.getDate() + 2)
        if (d.getMonth() === end.getMonth())
          return `${d.getDate()} – ${end.getDate()} de ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
        return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${d.getFullYear()}`
      }
      case 'week': {
        const start = getStartOfWeek(d)
        const end = new Date(start); end.setDate(end.getDate() + 6)
        if (start.getMonth() === end.getMonth())
          return `${start.getDate()} – ${end.getDate()} de ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`
        return `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${start.getFullYear()}`
      }
      case 'month':
      case 'agenda':
        return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
      default: return ''
    }
  }

  const changeView = (viewId) => { setCurrentView(viewId); setViewMenuOpen(false) }

  // Google Calendar style: click event → popover, click day → navigate to day view
  const openEventPopover = (event, e) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    // Position popover near clicked element
    let top = rect.bottom + 8
    let left = rect.left + rect.width / 2 - 160
    // Keep within viewport
    if (left < 12) left = 12
    if (left + 320 > vw) left = vw - 332
    if (top + 280 > vh) top = rect.top - 280
    if (top < 12) top = 12
    setPopoverEvent(event)
    setPopoverPos({ top, left })
  }
  const closePopover = () => setPopoverEvent(null)
  const navigateToDay = (date) => {
    setCurrentDate(normalizeDate(date))
    setCurrentView('day')
    setPopoverEvent(null)
  }

  // Eliminar evento de Google Calendar
  const handleDeleteGoogleEvent = async (eventId) => {
    const token = localStorage.getItem('scolyax.sessionToken')
    if (!token) {
      alert('No autenticado. Por favor reinicia sesión.')
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/calendar/google/events/${eventId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (response.ok) {
        // Remover el evento de la lista local
        setGoogleEvents(prev => prev.filter(e => e.id !== eventId))
      } else {
        const data = await response.json()
        alert(`Error al eliminar evento: ${data.detail || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error)
      alert('Error al eliminar evento de Google Calendar')
    }
  }
  const handleConnectGoogleCalendar = () => {
    const token = localStorage.getItem('scolyax.sessionToken')
    if (!token) {
      alert('Debes iniciar sesión primero.')
      return
    }
    const nextUrl = encodeURIComponent(window.location.origin + window.location.pathname)
    window.location.href = `${API_URL}/auth/google/calendar/start?session_token=${encodeURIComponent(token)}&next=${nextUrl}`
  }

  // ─── TOOLBAR ────────────────────────────────
  const renderToolbar = () => {
    const mobileTitle = (() => {
      const d = currentDate
      switch (currentView) {
        case 'day': return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`
        case '3day': case 'week': {
          const s = currentView === 'week' ? getStartOfWeek(d) : d
          const e2 = new Date(s); e2.setDate(e2.getDate() + (currentView === 'week' ? 6 : 2))
          return s.getMonth() === e2.getMonth()
            ? `${MONTH_NAMES[s.getMonth()].slice(0, 3)} ${s.getFullYear()}`
            : `${MONTH_NAMES[s.getMonth()].slice(0, 3)} – ${MONTH_NAMES[e2.getMonth()].slice(0, 3)}`
        }
        default: return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
      }
    })()

    return (
    <div className={`gcal__toolbar ${isMobile ? 'gcal__toolbar--mobile' : ''}`}>
      <div className="gcal__toolbar-left">
        <button className="gcal__btn gcal__btn--today" onClick={goToday}>Hoy</button>
        <div className="gcal__nav-arrows">
          <button className="gcal__btn gcal__btn--nav" onClick={goPrev} aria-label="Anterior">‹</button>
          <button className="gcal__btn gcal__btn--nav" onClick={goNext} aria-label="Siguiente">›</button>
        </div>
        <h2 className="gcal__title">{isMobile ? mobileTitle : getHeaderTitle()}</h2>
      </div>
      <div className="gcal__toolbar-right">
        {onOpenAddForm && (
          <button
            className="gcal__btn gcal__btn--add"
            onClick={onOpenAddForm}
            aria-label="Crear evento"
            title="Crear evento"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        <button
          ref={viewToggleRef}
          className="gcal__btn gcal__btn--view-toggle"
          onClick={() => {
            if (!viewMenuOpen && viewToggleRef.current) {
              const r = viewToggleRef.current.getBoundingClientRect()
              const menuW = 180
              let left = r.right - menuW
              if (left < 8) left = 8
              if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8
              setViewMenuPos({ top: r.bottom + 4, left })
            }
            setViewMenuOpen(!viewMenuOpen)
          }}
          aria-expanded={viewMenuOpen}
        >
          {isMobile ? VIEW_OPTIONS.find((v) => v.id === currentView)?.icon : VIEW_OPTIONS.find((v) => v.id === currentView)?.label}
          <span className={`gcal__dropdown-arrow ${viewMenuOpen ? 'gcal__dropdown-arrow--open' : ''}`}>▾</span>
        </button>
      </div>
    </div>
    )
  }

  // ─── AGENDA VIEW ────────────────────────────────
  const renderAgendaView = () => {
    const days = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(currentDate)
      d.setDate(currentDate.getDate() + i)
      days.push(d)
    }
    const daysWithEvents = days
      .map((d) => ({ date: d, events: getEventsForDate(d) }))
      .filter((d) => d.events.length > 0)

    if (daysWithEvents.length === 0) {
      return (
        <div className="gcal__agenda">
          <div className="gcal__empty">
            <span className="gcal__empty-icon">📭</span>
            <p>No hay eventos en los próximos 30 días</p>
          </div>
        </div>
      )
    }

    return (
      <div className="gcal__agenda">
        {daysWithEvents.map(({ date, events }) => {
          const isToday = isSameDay(date, new Date())
          return (
            <div key={date.toISOString()} className="gcal__agenda-day">
              <div className={`gcal__agenda-date ${isToday ? 'gcal__agenda-date--today' : ''}`}>
                <span className="gcal__agenda-weekday">
                  {date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')}
                </span>
                <span className={`gcal__agenda-daynum ${isToday ? 'gcal__agenda-daynum--today' : ''}`}>
                  {date.getDate()}
                </span>
              </div>
              <div className="gcal__agenda-events">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={`gcal__agenda-event gcal__agenda-event--${event.variant}`}
                    onClick={(e) => openEventPopover(event, e)}
                  >
                    <div className={`gcal__agenda-dot gcal__agenda-dot--${event.variant}`} />
                    <div className="gcal__agenda-info">
                      <span className="gcal__agenda-event-title">{event.title}</span>
                      <span className="gcal__agenda-event-time">{event.range}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ─── TIME GRID (day / 3day / week) ────────────────────────────────
  const renderTimeGrid = (dates) => {
    const today = normalizeDate(new Date())
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    return (
      <div className="gcal__timegrid-wrapper">
        {/* Encabezados de columnas */}
        <div className="gcal__timegrid-header">
          <div className="gcal__timegrid-gutter" />
          {dates.map((date) => {
            const isToday = isSameDay(date, today)
            return (
              <div key={date.toISOString()} className={`gcal__tg-col-header ${isToday ? 'gcal__tg-col-header--today' : ''}`}>
                <span className="gcal__tg-weekday">{WEEKDAY_SHORT[(date.getDay() + 6) % 7]}</span>
                <span className={`gcal__tg-daynum ${isToday ? 'gcal__tg-daynum--today' : ''}`}>
                  {date.getDate()}
                </span>
              </div>
            )
          })}
        </div>

        {/* Fila todo-el-día */}
        <div className="gcal__allday-row">
          <div className="gcal__timegrid-gutter gcal__allday-label">
            <span>Todo el día</span>
          </div>
          {dates.map((date) => {
            const events = getEventsForDate(date).filter((e) => e.startMinutes === null)
            return (
              <div key={date.toISOString()} className="gcal__allday-cell">
                {events.map((e) => (
                  <div
                    key={e.id}
                    className={`gcal__allday-chip gcal__allday-chip--${e.variant}`}
                    onClick={(ev) => openEventPopover(e, ev)}
                  >
                    {e.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Cuerpo con grilla horaria */}
        <div className="gcal__timegrid-body" ref={timeGridRef}>
          <div className="gcal__timegrid-slots">
            {/* Etiquetas de hora */}
            <div className="gcal__timegrid-gutter">
              {HOURS.map((h) => (
                <div key={h} className="gcal__hour-label">
                  <span>{formatHour(h)}</span>
                </div>
              ))}
            </div>

            {/* Columnas por día */}
            {dates.map((date) => {
              const isToday = isSameDay(date, today)
              const events = getEventsForDate(date).filter((e) => e.startMinutes !== null)

              return (
                <div
                  key={date.toISOString()}
                  className={`gcal__tg-col ${isToday ? 'gcal__tg-col--today' : ''}`}
                  onClick={() => navigateToDay(date)}
                >
                  {HOURS.map((h) => (
                    <div key={h} className="gcal__hour-slot" />
                  ))}

                  {isToday && (
                    <div
                      className="gcal__now-indicator"
                      style={{ top: `${((currentHour * 60 + currentMinute) / 1440) * 100}%` }}
                    >
                      <div className="gcal__now-dot" />
                      <div className="gcal__now-line" />
                    </div>
                  )}

                  {events.map((event) => {
                    const top = ((event.startMinutes || 0) / 1440) * 100
                    const duration = (event.endMinutes || (event.startMinutes || 0) + 60) - (event.startMinutes || 0)
                    const height = Math.max((duration / 1440) * 100, 1.5)
                    return (
                      <div
                        key={event.id}
                        className={`gcal__tg-event gcal__tg-event--${event.variant}`}
                        style={{ top: `${top}%`, height: `${height}%` }}
                        title={`${event.title}\n${event.range}`}
                        onClick={(e) => openEventPopover(event, e)}
                      >
                        <span className="gcal__tg-event-title">{event.title}</span>
                        <span className="gcal__tg-event-time">{event.range}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderDayView = () => renderTimeGrid([new Date(currentDate)])

  const render3DayView = () => {
    const dates = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(currentDate); d.setDate(d.getDate() + i); return d
    })
    return renderTimeGrid(dates)
  }

  const renderWeekView = () => {
    const start = getStartOfWeek(currentDate)
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return d
    })
    return renderTimeGrid(dates)
  }

  // ─── MONTH VIEW ────────────────────────────────
  const renderMonthView = () => {
    const grid = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth())
    const today = normalizeDate(new Date())

    return (
      <div className="gcal__month">
        <div className="gcal__month-header">
          {WEEKDAY_MINI.map((d) => (
            <div key={d} className="gcal__month-weekday">{d}</div>
          ))}
        </div>
        <div className="gcal__month-grid">
          {grid.map(({ date, isCurrentMonth }, i) => {
            const isToday = isSameDay(date, today)
            const events = getEventsForDate(date)
            return (
              <div
                key={i}
                className={`gcal__month-cell ${!isCurrentMonth ? 'gcal__month-cell--outside' : ''} ${isToday ? 'gcal__month-cell--today' : ''}`}
                onClick={() => navigateToDay(date)}
              >
                <span className={`gcal__month-day ${isToday ? 'gcal__month-day--today' : ''}`}>
                  {date.getDate()}
                </span>
                <div className="gcal__month-events">
                  {events.slice(0, 3).map((event) => (
                    <div key={event.id} className={`gcal__month-event gcal__month-event--${event.variant}`}>
                      <span className="gcal__month-event-dot" />
                      <span className="gcal__month-event-title">{event.title}</span>
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className="gcal__month-more">+{events.length - 3} más</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── GOOGLE CALENDAR EVENT POPOVER ─────────────────────────────────────────
  const renderEventPopover = () => {
    if (!popoverEvent) return null
    const ev = popoverEvent
    const variantColors = { schedule: '#1a73e8', google: '#4285f4' }
    const variantIcons = { schedule: '📚', google: '📅' }
    const variantLabels = { schedule: 'Horario', google: 'Google Calendar' }

    return ReactDOM.createPortal(
      <div className="gcal__popover-overlay" onClick={closePopover}>
        <div
          className="gcal__popover"
          ref={popoverRef}
          style={{ top: popoverPos.top, left: popoverPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header bar with color */}
          <div className="gcal__popover-bar" style={{ background: variantColors[ev.variant] || '#1a73e8' }} />
          <div className="gcal__popover-header">
            <button className="gcal__popover-close" onClick={closePopover} aria-label="Cerrar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <div className="gcal__popover-actions-top">
              {(ev.variant === 'schedule' || ev.variant === 'google') && (
                <button
                  className="gcal__popover-icon-btn"
                  onClick={() => { setEventToDelete(ev); setConfirmDialogOpen(true); closePopover() }}
                  aria-label="Eliminar"
                  title="Eliminar"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              {ev.variant === 'google' && ev.htmlLink && (
                <a
                  href={ev.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gcal__popover-icon-btn"
                  title="Abrir en Google Calendar"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              )}
            </div>
          </div>
          {/* Body */}
          <div className="gcal__popover-body">
            <div className="gcal__popover-title-row">
              <span className="gcal__popover-dot" style={{ background: variantColors[ev.variant] }} />
              <h3 className="gcal__popover-title">{ev.title}</h3>
            </div>
            <div className="gcal__popover-time">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>{ev.range}</span>
            </div>
            {ev.meta && (
              <div className="gcal__popover-meta">
                <span>{variantIcons[ev.variant]} {ev.meta}</span>
              </div>
            )}
            {!ev.meta && (
              <div className="gcal__popover-meta">
                <span>{variantIcons[ev.variant]} {variantLabels[ev.variant]}</span>
              </div>
            )}
            {ev.notes && <p className="gcal__popover-notes">{ev.notes}</p>}
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // ─── RENDER PRINCIPAL ────────────────────────────────
  return (
    <section className="panel panel--calendar" data-sticker="Mi Calendario" data-icon="📅">
      {renderToolbar()}
      <div className="gcal__content" ref={contentRef}>
        {loadingGoogleEvents && <div className="gcal__loading"><span className="gcal__spinner" /> Cargando eventos…</div>}
        {currentView === 'agenda' && renderAgendaView()}
        {currentView === 'day' && renderDayView()}
        {currentView === '3day' && render3DayView()}
        {currentView === 'week' && renderWeekView()}
        {currentView === 'month' && renderMonthView()}
      </div>
      {renderEventPopover()}
      {viewMenuOpen && ReactDOM.createPortal(
        <div className="gcal__view-menu-overlay" onClick={() => setViewMenuOpen(false)}>
          <div
            className="gcal__view-menu"
            ref={viewMenuRef}
            style={{ top: viewMenuPos.top, left: viewMenuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className={`gcal__view-menu-item ${currentView === opt.id ? 'gcal__view-menu-item--active' : ''}`}
                onClick={() => changeView(opt.id)}
              >
                <span className="gcal__view-menu-icon">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => { setConfirmDialogOpen(false); setEventToDelete(null) }}
        onConfirm={() => {
          if (eventToDelete) {
            if (eventToDelete.variant === 'schedule' && onDeleteSchedule) {
              onDeleteSchedule(eventToDelete.realId)
            } else if (eventToDelete.variant === 'google') {
              const googleEventId = eventToDelete.id.replace('google-', '')
              handleDeleteGoogleEvent(googleEventId)
            }
          }
          setEventToDelete(null)
        }}
        title={eventToDelete?.variant === 'google' ? '¿Eliminar evento de Google Calendar?' : '¿Eliminar seminario?'}
        message={eventToDelete ? `¿Estás seguro de eliminar "${eventToDelete.title}"? Esta acción no se puede deshacer.` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </section>
  )
}

export default WeeklyCalendar
