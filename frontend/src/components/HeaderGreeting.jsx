/**
 * Encabezado principal que presenta la marca y las métricas del tablero.
 */
import React from 'react'
import ProfileMenu from './ProfileMenu'

// Componente que muestra el saludo personalizado y los indicadores clave.
const HeaderGreeting = ({ stats, session, onLogout, isDarkMode, onToggleDarkMode, onNotificationClick }) => {
  const greetingName = session?.display_name ? session.display_name.split(' ')[0] : 'explorador'
  const providerHint = session
    ? session.provider === 'google'
      ? 'Los avisos se enviarán a Gmail con la información de tus recordatorios.'
      : 'Tus avisos se enviarán a Outlook con los detalles configurados.'
    : 'Inicia con Google o Microsoft para activar los avisos por correo.'

  return (
    <header className="overview" aria-labelledby="welcome-heading">
      <div className="overview__topbar">
        <div className="overview__brand">
          <div className="brand-icon" aria-hidden="true">
            CC
          </div>
          <div className="overview__intro">
            <p className="overview__eyebrow">Tu agenda universitaria</p>
            <h1 id="welcome-heading" className="overview__title">
              Scolyax
            </h1>
            <p className="overview__description">
              Hola {greetingName}, organiza tu semana con un calendario semanal, recordatorios por correo y resúmenes que
              puedes escuchar en voz alta cuando lo necesites.
            </p>
            <p className="overview__helper" aria-live="polite">
              {providerHint}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Notification Bell Button */}
          {session && onNotificationClick && (
            <button
              type="button"
              onClick={onNotificationClick}
              className="notification-bell-button"
              aria-label="Abrir centro de notificaciones"
              title="Notificaciones"
            >
              <span className="notification-bell-icon">🔔</span>
            </button>
          )}
          <ProfileMenu
            session={session}
            onLogout={onLogout}
            isDarkMode={isDarkMode}
            onToggleDarkMode={onToggleDarkMode}
          />
        </div>
      </div>
      <div className="overview__stickers" aria-hidden="true">
        <span className="sticker sticker--pulse">Pomodoro flexible</span>
        <span className="sticker sticker--accent">Recordatorios por correo</span>
        <span className="sticker sticker--outline">Audio + resúmenes claros</span>
      </div>
      <div className="overview__metrics" role="list" aria-label="Indicadores de progreso">
        <article className="metric" role="listitem">
          <span className="metric__label">Tareas completadas</span>
          <strong className="metric__value">{stats.tasks_completed}</strong>
          <span className="metric__hint">{stats.focus_hours} h de enfoque</span>
        </article>
        <article className="metric" role="listitem">
          <span className="metric__label">Hábitos activos</span>
          <strong className="metric__value">{stats.milestones_completed}</strong>
          <span className="metric__hint">{stats.streak_days} días en racha</span>
        </article>
        <article className="metric" role="listitem">
          <span className="metric__label">Recordatorios próximos</span>
          <strong className="metric__value">{stats.upcoming_reminders}</strong>
          <span className="metric__hint">Notificaciones programadas</span>
        </article>
      </div>
    </header>
  )
}

export default HeaderGreeting
