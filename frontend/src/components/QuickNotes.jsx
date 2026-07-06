/**
 * Panel con sugerencias rápidas para inspirar nuevos resúmenes o tareas.
 */
import React, { useState } from 'react'

// Componente que permite guardar una nota rápida personalizada.
const QuickNotes = ({ onAdd }) => {
  const [note, setNote] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmed = note.trim()
    if (!trimmed) return
    onAdd?.(trimmed)
    setNote('')
  }

  return (
    <section className="panel panel--support" aria-labelledby="quick-actions-heading">
      <header className="panel__header panel__header--compact">
        <div>
          <h2 id="quick-actions-heading" className="panel__title">
            Ideas rápidas
          </h2>
          <p className="panel__subtitle">
            Registra una idea para retomarla en el gestor de resúmenes o en tus próximas sesiones de enfoque.
          </p>
        </div>
        <span className="panel__badge" aria-hidden="true">
          ✨
        </span>
      </header>
      <form className="quick-actions__form" onSubmit={handleSubmit}>
        <label className="quick-actions__label" htmlFor="quick-note">
          <span>Escribe una idea</span>
          <textarea
            id="quick-note"
            value={note}
            placeholder="Describe brevemente qué quieres estudiar o resumir"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button type="submit" className="quick-action quick-action--submit">
          Enviar al gestor de resúmenes
        </button>
      </form>
      <p className="quick-actions__hint">Puedes modificar el texto dentro del gestor antes de generar el resumen.</p>
    </section>
  )
}

export default QuickNotes
