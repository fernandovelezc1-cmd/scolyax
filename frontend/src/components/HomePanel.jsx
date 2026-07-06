import { useMemo, useState, useEffect } from 'react'
import './HomePanel.css'
import Sticker from './Stickers'

/**
 * HomePanel — Vista principal de inicio con resumen en vivo del dashboard.
 * Muestra tarjetas con métricas: tareas activas, recordatorios, racha, XP, logros, sesiones.
 */
const HomePanel = ({
  session,
  tasks = [],
  reminders = [],
  scheduleEntries = [],
  xp = 0,
  streakDays = 0,
  unlockedAchievements = [],
  totalTasksEverCompleted = 0,
  gamificationStats = {},
  onNavigate,
  isDarkMode = false,
}) => {
  // Derived metrics
  const metrics = useMemo(() => {
    const pendingTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'pending')
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'in_progress')
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'completed')
    const activeReminders = reminders.filter(r => !r.dismissed && !r.completed)
    const level = Math.floor(xp / 100) + 1
    const xpInLevel = xp % 100
    const pomodoroSessions = gamificationStats.pomodoroSessions || 0

    return {
      pendingTasks: pendingTasks.length,
      inProgressTasks: inProgressTasks.length,
      completedTasks: completedTasks.length,
      totalTasks: tasks.length,
      activeReminders: activeReminders.length,
      totalReminders: reminders.length,
      scheduleEvents: scheduleEntries.length,
      level,
      xp,
      xpInLevel,
      xpToNext: 100,
      streakDays,
      totalCompleted: totalTasksEverCompleted,
      achievements: unlockedAchievements.length,
      pomodoroSessions,
    }
  }, [tasks, reminders, scheduleEntries, xp, streakDays, unlockedAchievements, totalTasksEverCompleted, gamificationStats])

  // Tick cada 60 s para que el saludo se actualice al cambiar de franja horaria
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    const name = session?.display_name?.split(' ')[0] || 'Estudiante'
    if (hour < 6) return { text: `Buenas noches, ${name}`, sticker: 'moon', sub: 'Descansa bien para rendir mejor mañana' }
    if (hour < 12) return { text: `Buenos días, ${name}`, sticker: 'sun', sub: 'Un gran día para aprender algo nuevo' }
    if (hour < 18) return { text: `Buenas tardes, ${name}`, sticker: 'sun', sub: 'Sigue así, vas por buen camino' }
    return { text: `Buenas noches, ${name}`, sticker: 'moon', sub: 'Cierra el día con un último repaso' }
  }, [session, tick])

  const completionPct = metrics.totalTasks > 0
    ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100)
    : 0

  const xpPct = Math.round((metrics.xpInLevel / metrics.xpToNext) * 100)

  // Circular XP ring geometry
  const R = 52
  const CIRC = 2 * Math.PI * R
  const ringOffset = CIRC * (1 - xpPct / 100)

  const TODAY = [
    {
      id: 'tasks', label: 'Tareas activas', value: metrics.pendingTasks + metrics.inProgressTasks,
      sub: `${metrics.pendingTasks} pendientes · ${metrics.inProgressTasks} en curso`, tone: 'a', pct: completionPct,
      icon: (<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 12.5 11 15l4.5-5" /></>),
    },
    {
      id: 'reminders', label: 'Recordatorios', value: metrics.activeReminders,
      sub: metrics.activeReminders === 1 ? '1 activo' : `${metrics.activeReminders} activos`, tone: 'b',
      icon: (<><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>),
    },
    {
      id: 'calendar', label: 'Eventos', value: metrics.scheduleEvents, sub: 'en tu calendario', tone: 'c',
      icon: (<><rect x="3.5" y="5" width="17" height="16" rx="3" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" /></>),
    },
    {
      id: 'timer', label: 'Sesiones de estudio', value: metrics.pomodoroSessions, sub: 'con Focus', tone: 'd',
      icon: (<><path d="M4 5.5A2.5 2.5 0 016.5 3H12v15.5H6.5A2.5 2.5 0 004 21Z" /><path d="M20 5.5A2.5 2.5 0 0017.5 3H12v15.5h5.5A2.5 2.5 0 0120 21Z" /></>),
    },
  ]

  const QUICK = [
    { id: 'timer', label: 'Estudiar ahora', tone: 'd', icon: (<><path d="M4 5.5A2.5 2.5 0 016.5 3H12v15.5H6.5A2.5 2.5 0 004 21Z" /><path d="M20 5.5A2.5 2.5 0 0017.5 3H12v15.5h5.5A2.5 2.5 0 0120 21Z" /></>) },
    { id: 'tasks', label: 'Nueva tarea', tone: 'a', icon: (<><path d="M12 5v14M5 12h14" /></>) },
    { id: 'summary', label: 'Iris IA', tone: 'e', icon: (<><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" /></>) },
    { id: 'calendar', label: 'Mi horario', tone: 'c', icon: (<><rect x="3.5" y="5" width="17" height="16" rx="3" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" /></>) },
  ]

  return (
    <div className="dash">
      {/* ===== Columna principal ===== */}
      <div className="dash__main">
        {/* Hero saludo */}
        <section className="dash__hero">
          <div className="dash__hero-glow" aria-hidden="true" />
          <div className="dash__hero-content">
            <span className="dash__hero-emoji"><Sticker name={greeting.sticker} size={44} /></span>
            <h1 className="dash__hero-title">{greeting.text}</h1>
            <p className="dash__hero-sub">{greeting.sub}</p>
          </div>
        </section>

        {/* Resumen de hoy */}
        <section className="dash__card">
          <div className="dash__card-head">
            <h2 className="dash__card-title">Resumen de hoy</h2>
            <span className="dash__card-note">{new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          <div className="dash__today">
            {TODAY.map((r) => (
              <button key={r.id} className={`dash__row dash__row--${r.tone}`} onClick={() => onNavigate?.(r.id)} type="button">
                <span className="dash__row-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{r.icon}</svg>
                </span>
                <span className="dash__row-text">
                  <span className="dash__row-label">{r.label}</span>
                  <span className="dash__row-sub">{r.sub}</span>
                </span>
                {typeof r.pct === 'number' && metrics.totalTasks > 0 && (
                  <span className="dash__row-bar"><span style={{ width: `${r.pct}%` }} /></span>
                )}
                <span className="dash__row-value">{r.value}</span>
                <span className="dash__row-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>

        {/* Accesos rápidos */}
        <section className="dash__quick">
          {QUICK.map((q) => (
            <button key={q.label} className={`dash__quick-btn dash__quick-btn--${q.tone}`} onClick={() => onNavigate?.(q.id)} type="button">
              <span className="dash__quick-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{q.icon}</svg>
              </span>
              <span className="dash__quick-label">{q.label}</span>
            </button>
          ))}
        </section>
      </div>

      {/* ===== Rail lateral ===== */}
      <aside className="dash__side">
        {/* Anillo XP / Nivel */}
        <div className="dash__ringcard">
          <div className="dash__ring">
            <svg viewBox="0 0 120 120" className="dash__ring-svg">
              <circle cx="60" cy="60" r={R} className="dash__ring-bg" />
              <circle cx="60" cy="60" r={R} className="dash__ring-fg"
                style={{ strokeDasharray: CIRC, strokeDashoffset: ringOffset }} />
            </svg>
            <div className="dash__ring-center">
              <span className="dash__ring-lvl">Nivel</span>
              <span className="dash__ring-num">{metrics.level}</span>
            </div>
          </div>
          <p className="dash__ring-xp">{metrics.xpInLevel} / {metrics.xpToNext} XP</p>
          <p className="dash__ring-total">{metrics.xp} XP en total</p>
        </div>

        {/* Mini stats */}
        <div className="dash__minis">
          <div className="dash__mini dash__mini--streak">
            <span className="dash__mini-glyph"><Sticker name="flame" size={26} /></span>
            <span className="dash__mini-value">{metrics.streakDays}</span>
            <span className="dash__mini-label">días de racha</span>
          </div>
          <div className="dash__mini dash__mini--ach">
            <span className="dash__mini-glyph"><Sticker name="trophy" size={26} /></span>
            <span className="dash__mini-value">{metrics.achievements}</span>
            <span className="dash__mini-label">logros</span>
          </div>
        </div>

        {/* Tip */}
        <div className="dash__tip">
          <span className="dash__tip-icon"><Sticker name="bulb" size={24} /></span>
          <p className="dash__tip-text">
            {metrics.streakDays >= 7
              ? '¡Increíble! Más de una semana sin parar. ¡Eres imparable!'
              : metrics.streakDays >= 3
                ? '¡Vas muy bien! Mantén la racha para desbloquear más logros.'
                : metrics.completedTasks > 0
                  ? 'Cada tarea completada te acerca a tus metas. ¡Sigue así!'
                  : '¡Comienza tu primera tarea y construye tu racha!'}
          </p>
        </div>
      </aside>
    </div>
  )
}

export default HomePanel
