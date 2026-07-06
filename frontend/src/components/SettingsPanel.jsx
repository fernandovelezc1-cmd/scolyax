import React, { useState } from 'react'
import Sticker from './Stickers'
import '../settings-panel.css'

/**
 * Panel de configuración con control de modo oscuro/claro y gestión de cuenta.
 * - Modo automático: cambia según hora del día (18:00–05:59 oscuro)
 * - Modo manual: el usuario elige oscuro o claro
 * - Eliminación de cuenta: borra todos los datos del usuario de la BD
 */
export default function SettingsPanel({ isOpen, onClose, themeMode, onThemeModeChange, isDarkMode, onLogout }) {
  if (!isOpen) return null

  const isAuto = themeMode === 'auto'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')
      const response = await fetch(`${API_URL}/account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('scolyax.sessionToken')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        // Limpiar sesión y logout
        localStorage.removeItem('scolyax.sessionToken')
        localStorage.removeItem('scolyax.user')
        localStorage.removeItem('scolyax.stats')
        alert('Cuenta eliminada correctamente. Todos tus datos han sido borrados.')
        onLogout?.()
      } else if (response.status === 401) {
        alert('Sesión expirada. Inicia sesión nuevamente.')
        onLogout?.()
      } else {
        alert('Error al eliminar la cuenta. Intenta nuevamente.')
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Error de conexión. Intenta nuevamente.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      onClose()
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-panel__header">
          <h2 className="settings-panel__title">
            <span className="settings-panel__title-icon"><Sticker name="gear" size={22} /></span>
            Configuración
          </h2>
          <button className="settings-panel__close" onClick={onClose} aria-label="Cerrar configuración">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Apariencia */}
        <div className="settings-section">
          <h3 className="settings-section__title">Apariencia</h3>

          {/* Auto mode toggle */}
          <div className="settings-auto-toggle">
            <div className="settings-auto-toggle__info">
              <span className="settings-auto-toggle__label">Modo automático</span>
              <span className="settings-auto-toggle__desc">
                Cambia según la hora del día (oscuro de 6pm a 6am)
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isAuto}
              className={`settings-switch ${isAuto ? 'settings-switch--on' : ''}`}
              onClick={() => onThemeModeChange(isAuto ? (isDarkMode ? 'dark' : 'light') : 'auto')}
            >
              <span className="settings-switch__thumb" />
            </button>
          </div>

          {/* Manual mode cards */}
          <div className={`settings-theme-cards ${isAuto ? 'settings-theme-cards--disabled' : ''}`}>
            {/* Light mode card */}
            <button
              type="button"
              className={`settings-theme-card settings-theme-card--light ${themeMode === 'light' ? 'settings-theme-card--active' : ''}`}
              disabled={isAuto}
              onClick={() => onThemeModeChange('light')}
              aria-label="Modo claro"
            >
              <div className="settings-theme-card__preview settings-theme-card__preview--light">
                <div className="preview-header">
                  <div className="preview-greeting">
                    <span className="preview-icon"><Sticker name="sun" size={18} /></span>
                    <div className="preview-text-group">
                      <span className="preview-title">Buenos días</span>
                      <span className="preview-subtitle">Empieza con energía</span>
                    </div>
                  </div>
                </div>
                <div className="preview-stats">
                  <div className="preview-stat"><span className="preview-stat-value">Nv. 2</span><span className="preview-stat-label">NIVEL</span></div>
                  <div className="preview-stat"><span className="preview-stat-value">120</span><span className="preview-stat-label">XP</span></div>
                </div>
                <div className="preview-stats">
                  <div className="preview-stat"><span className="preview-stat-value">4 <Sticker name="flame" size={12} /></span><span className="preview-stat-label">RACHA</span></div>
                  <div className="preview-stat"><span className="preview-stat-value">1 <Sticker name="trophy" size={12} /></span><span className="preview-stat-label">LOGROS</span></div>
                </div>
              </div>
              <span className="settings-theme-card__label">Claro</span>
              {themeMode === 'light' && <span className="settings-theme-card__check">✓</span>}
            </button>

            {/* Dark mode card */}
            <button
              type="button"
              className={`settings-theme-card settings-theme-card--dark ${themeMode === 'dark' ? 'settings-theme-card--active' : ''}`}
              disabled={isAuto}
              onClick={() => onThemeModeChange('dark')}
              aria-label="Modo oscuro"
            >
              <div className="settings-theme-card__preview settings-theme-card__preview--dark">
                <div className="preview-header">
                  <div className="preview-greeting">
                    <span className="preview-icon"><Sticker name="moon" size={18} /></span>
                    <div className="preview-text-group">
                      <span className="preview-title">Buenas noches</span>
                      <span className="preview-subtitle">Cierra el día con un repaso</span>
                    </div>
                  </div>
                </div>
                <div className="preview-stats">
                  <div className="preview-stat"><span className="preview-stat-value">Nv. 2</span><span className="preview-stat-label">NIVEL</span></div>
                  <div className="preview-stat"><span className="preview-stat-value">120</span><span className="preview-stat-label">XP</span></div>
                </div>
                <div className="preview-stats">
                  <div className="preview-stat"><span className="preview-stat-value">4 <Sticker name="flame" size={12} /></span><span className="preview-stat-label">RACHA</span></div>
                  <div className="preview-stat"><span className="preview-stat-value">1 <Sticker name="trophy" size={12} /></span><span className="preview-stat-label">LOGROS</span></div>
                </div>
              </div>
              <span className="settings-theme-card__label">Oscuro</span>
              {themeMode === 'dark' && <span className="settings-theme-card__check">✓</span>}
            </button>
          </div>
        </div>

        {/* Sección Cuenta */}
        <div className="settings-section">
          <h3 className="settings-section__title">Cuenta</h3>
          <div className="settings-account">
            <div className="settings-account__info">
              <span className="settings-account__label"><Sticker name="alert" size={14} /> Zona de peligro</span>
              <span className="settings-account__desc">
                Eliminar tu cuenta borrará permanentemente todos tus datos de Scolyax, incluyendo tareas, recordatorios, logros y estadísticas. Esta acción es irreversible.
              </span>
            </div>
            <button
              type="button"
              className="settings-delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Eliminar cuenta"
            >
<Sticker name="trash" size={15} /> Eliminar mi cuenta
            </button>
          </div>
        </div>

        {/* Modal de confirmación */}
        {showDeleteConfirm && (
          <div className="settings-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-confirm-content">
              <h3 className="settings-confirm__title"><Sticker name="alert" size={20} /> Eliminar cuenta permanentemente</h3>
              <p className="settings-confirm__message">
                Estás a punto de eliminar tu cuenta de Scolyax. Esta acción:
              </p>
              <ul className="settings-confirm__list">
                <li><Sticker name="trash" size={15} /> Eliminará todas tus tareas y recordatorios</li>
                <li><Sticker name="trophy" size={15} /> Borrará tus estadísticas y logros</li>
                <li><Sticker name="game" size={15} /> Perderás tu nivel, XP y racha</li>
                <li><Sticker name="ban" size={15} /> No se puede deshacer esta acción</li>
              </ul>
              <p className="settings-confirm__warning">
                ¿Realmente deseas continuar? Escribe tu email para confirmar:
              </p>
              <div className="settings-confirm__actions">
                <button
                  type="button"
                  className="settings-confirm-btn settings-confirm-btn--cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="settings-confirm-btn settings-confirm-btn--delete"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Eliminando…' : <><Sticker name="trash" size={15} /> Sí, eliminar para siempre</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
