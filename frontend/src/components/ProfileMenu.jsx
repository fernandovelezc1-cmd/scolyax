/**
 * Menú de perfil que permite cambiar el tema y cerrar sesión.
 */
import React, { useEffect, useRef, useState } from 'react'

const providerLabels = {
  google: 'Gmail',
  microsoft: 'Outlook'
}

// Componente que gestiona el menú desplegable de la persona autenticada.
const ProfileMenu = ({ session, onLogout, isDarkMode, onToggleDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  // Escucha clics externos y la tecla Escape para cerrar el menú.
  useEffect(() => {
    if (!isOpen) return

    const handleClickAway = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickAway)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  if (!session) {
    return (
      <div className="profile-menu profile-menu--placeholder" aria-hidden="true">
        <span className="profile-menu__avatar">👋</span>
      </div>
    )
  }

  const initials = session.display_name
    ? session.display_name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'CC'

  const toggleMenu = () => setIsOpen((prev) => !prev)

  // Cierra el panel y notifica al componente padre que cierre la sesión.
  const handleLogout = () => {
    setIsOpen(false)
    onLogout?.()
  }

  // Dispara el cambio de modo claro/oscuro desde el menú.
  const handleToggleTheme = () => {
    onToggleDarkMode?.()
  }

  return (
    <div className={`profile-menu ${isOpen ? 'is-open' : ''}`} ref={menuRef}>
      <button
        type="button"
        className="profile-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggleMenu}
      >
        <span className="profile-menu__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="profile-menu__name">{session.display_name}</span>
      </button>
      {isOpen && (
        <div className="profile-menu__panel" role="menu">
          <div className="profile-menu__header">
            <p className="profile-menu__title">{session.display_name}</p>
            <p className="profile-menu__email">{session.email}</p>
            <span className="profile-menu__badge">
              Notificaciones vía {providerLabels[session.provider] || 'correo'}
            </span>
          </div>
          <div className="profile-menu__actions">
            <button type="button" role="menuitem" onClick={handleToggleTheme}>
              Cambiar a modo {isDarkMode ? 'claro' : 'oscuro'}
            </button>
            <button type="button" role="menuitem" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileMenu
