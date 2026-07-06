/**
 * Modal accesible que solicita el nombre para mostrar tras iniciar sesión.
 */
import React, { useEffect, useRef, useState } from 'react'

const DisplayNamePrompt = ({ isOpen, onClose, onSubmit, suggestedName }) => {
  const [value, setValue] = useState(suggestedName || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      setValue(suggestedName || '')
      return
    }
    setValue(suggestedName || '')
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 30)
    return () => clearTimeout(timer)
  }, [isOpen, suggestedName])

  if (!isOpen) {
    return null
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const normalized = value.trim()
    if (!normalized) {
      return
    }
    onSubmit?.(normalized)
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="name-prompt-title">
      <div className="modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal__content">
        <header className="modal__header">
          <h2 id="name-prompt-title" className="modal__title">
            ¿Cómo prefieres que te llamemos?
          </h2>
          <p className="modal__subtitle">
            Personaliza el saludo del tablero para que Scolyax te identifique fácilmente.
          </p>
        </header>
        <form className="modal__form" onSubmit={handleSubmit}>
          <label className="modal__label" htmlFor="display-name-input">
            <span>Nombre para mostrar</span>
            <input
              id="display-name-input"
              ref={inputRef}
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Ej. Sofía, Equipo Bioquímica, etc."
            />
          </label>
          <div className="modal__actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              Continuar luego
            </button>
            <button type="submit" className="primary">
              Guardar nombre
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DisplayNamePrompt
