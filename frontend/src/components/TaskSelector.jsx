/**
 * TaskSelector - Panel Independiente para Seleccionar Tareas
 * Se usa en todas las herramientas que requieren seleccionar una tarea
 */

import React, { useState, useRef, useEffect } from 'react'
import './TaskSelector.css'

const TaskSelector = ({ tasks = [], onTaskSelected, onCancel, selectedTaskId = null }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const selectedTask = tasks.find(t => t.id === selectedTaskId)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="task-selector">
      <div className="task-selector__content">
        <header className="task-selector__header">
          <h2 className="task-selector__title">
            <span className="task-selector__icon">🎯</span>
            ¿En qué tarea trabajarás?
          </h2>
          <p className="task-selector__subtitle">
            Selecciona una tarea para continuar con tu método de estudio
          </p>
        </header>

        <div className="task-selector__dropdown-wrapper">
          <div className="sf-dropdown" ref={dropdownRef}>
            <button
              type="button"
              className={`sf-dropdown__trigger${isDropdownOpen ? ' sf-dropdown__trigger--open' : ''}${selectedTask ? ' sf-dropdown__trigger--filled' : ''}`}
              onClick={() => setIsDropdownOpen(prev => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              aria-label="Selecciona una tarea para trabajar"
            >
              {selectedTask ? (
                <span className="sf-dropdown__value">
                  <span className="sf-dropdown__value-dot" style={{
                    background: selectedTask.priority === 'high' ? '#ef4444'
                      : selectedTask.priority === 'medium' ? '#f59e0b' : '#22c55e'
                  }} />
                  <span className="sf-dropdown__value-text">{selectedTask.title}</span>
                </span>
              ) : (
                <span className="sf-dropdown__placeholder">✨ Selecciona una tarea...</span>
              )}
              <svg className="sf-dropdown__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isDropdownOpen && (
              <ul className="sf-dropdown__menu" role="listbox">
                {tasks.filter(t => t.status !== 'completed').length === 0 ? (
                  <li className="sf-dropdown__empty">
                    <span>📭</span> No hay tareas pendientes
                  </li>
                ) : (
                  tasks.filter(t => t.status !== 'completed').map(task => (
                    <li
                      key={task.id}
                      role="option"
                      aria-selected={selectedTaskId === task.id}
                      className={`sf-dropdown__item${selectedTaskId === task.id ? ' sf-dropdown__item--selected' : ''}`}
                      onClick={() => {
                        onTaskSelected(task.id)
                        setIsDropdownOpen(false)
                      }}
                    >
                      <span className="sf-dropdown__item-dot" style={{
                        background: task.priority === 'high' ? '#ef4444'
                          : task.priority === 'medium' ? '#f59e0b' : '#22c55e'
                      }} />
                      <div className="sf-dropdown__item-body">
                        <span className="sf-dropdown__item-title">{task.title}</span>
                        {task.course && (
                          <span className="sf-dropdown__item-course">📖 {task.course}</span>
                        )}
                      </div>
                      {selectedTaskId === task.id && (
                        <span className="sf-dropdown__item-check">✓</span>
                      )}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {selectedTask && (
            <div className="task-selector__task-info">
              <h3 className="task-selector__task-name">{selectedTask.title}</h3>
              {selectedTask.course && (
                <p className="task-selector__task-course">📖 {selectedTask.course}</p>
              )}
              {selectedTask.due_date && (
                <p className="task-selector__task-due">
                  📅 Vence: {new Date(selectedTask.due_date).toLocaleDateString()}
                </p>
              )}
              {selectedTask.description && (
                <p className="task-selector__task-description">
                  {selectedTask.description}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="task-selector__actions">
          {selectedTask && (
            <button
              type="button"
              className="btn--primary"
              onClick={() => onTaskSelected(selectedTaskId)}
            >
              ✨ Continuar
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              className="btn--secondary"
              onClick={onCancel}
            >
              ← Atrás
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskSelector
