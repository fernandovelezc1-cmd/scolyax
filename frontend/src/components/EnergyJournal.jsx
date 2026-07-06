/**
 * EnergyJournal – Diario de Energía post-sesión
 *
 * Modal que aparece tras completar una sesión de estudio (Pomodoro).
 * Check-in rápido con 3 niveles de energía + emoji de ánimo + nota opcional.
 * Muestra un mini-gráfico semanal de tendencia energética.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import './EnergyJournal.css'

const ENERGY_OPTIONS = [
  { level: 'low', emoji: '😴', label: 'Agotado/a', color: '#f87171' },
  { level: 'medium', emoji: '😊', label: 'Normal', color: '#fbbf24' },
  { level: 'high', emoji: '⚡', label: 'Con energía', color: '#a9b71a' },
]

const MOOD_OPTIONS = ['😌', '🤔', '😤', '🥳', '😢', '💪']

const EnergyJournal = ({
  isOpen,
  onClose,
  onSubmit,
  apiUrl,
  authenticatedFetch,
  sessionType = 'pomodoro',
  sessionDuration = 25,
}) => {
  const [selectedEnergy, setSelectedEnergy] = useState(null)
  const [selectedMood, setSelectedMood] = useState(null)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [history, setHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load recent history when modal opens
  useEffect(() => {
    if (!isOpen) return
    // Reset form
    setSelectedEnergy(null)
    setSelectedMood(null)
    setNotes('')
    setSaved(false)

    const loadHistory = async () => {
      setIsLoadingHistory(true)
      try {
        const res = await authenticatedFetch(`${apiUrl}/energy-journal?limit=7`)
        if (res.ok) {
          const data = await res.json()
          setHistory(data.entries || [])
        }
      } catch {
        // Silently fail – history is optional
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadHistory()
  }, [isOpen, apiUrl, authenticatedFetch])

  const handleSubmit = useCallback(async () => {
    if (!selectedEnergy) return

    setIsSaving(true)
    try {
      const payload = {
        energy_level: selectedEnergy,
        mood: selectedMood,
        notes: notes.trim() || null,
        session_type: sessionType,
        session_duration_minutes: sessionDuration,
      }

      const res = await authenticatedFetch(`${apiUrl}/energy-journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setSaved(true)
        if (onSubmit) onSubmit(payload)
        // Auto-close after brief feedback
        setTimeout(() => onClose(), 1200)
      }
    } catch {
      // Still close to not block user
      onClose()
    } finally {
      setIsSaving(false)
    }
  }, [selectedEnergy, selectedMood, notes, sessionType, sessionDuration, apiUrl, authenticatedFetch, onSubmit, onClose])

  // Weekly chart data
  const weekData = useMemo(() => {
    const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    const now = new Date()
    const dayOfWeek = (now.getDay() + 6) % 7 // Mon=0

    const chart = days.map((d, i) => ({
      day: d,
      value: 0,
      count: 0,
      isToday: i === dayOfWeek,
    }))

    for (const entry of history) {
      if (!entry.created_at) continue
      const date = new Date(entry.created_at)
      const idx = (date.getDay() + 6) % 7
      const val = entry.energy_level === 'high' ? 3 : entry.energy_level === 'medium' ? 2 : 1
      chart[idx].value += val
      chart[idx].count += 1
    }

    // Average
    for (const d of chart) {
      if (d.count > 0) d.value = d.value / d.count
    }

    return chart
  }, [history])

  if (!isOpen) return null

  return (
    <div className="energy-journal-overlay" onClick={onClose}>
      <div className="energy-journal-modal" onClick={e => e.stopPropagation()}>
        
        {saved ? (
          <div className="energy-journal-saved">
            <span className="energy-journal-saved-emoji">✨</span>
            <p>¡Registrado!</p>
          </div>
        ) : (
          <>
            <div className="energy-journal-header">
              <h3 className="energy-journal-title">¿Cómo te sientes?</h3>
              <p className="energy-journal-sub">Sesión completada · {sessionDuration} min</p>
            </div>

            {/* Energy level selection */}
            <div className="energy-journal-levels">
              {ENERGY_OPTIONS.map(opt => (
                <button
                  key={opt.level}
                  className={`energy-journal-level ${selectedEnergy === opt.level ? 'energy-journal-level--active' : ''}`}
                  onClick={() => setSelectedEnergy(opt.level)}
                  style={{
                    '--energy-color': opt.color,
                    '--energy-bg': `${opt.color}20`,
                  }}
                >
                  <span className="energy-journal-level-emoji">{opt.emoji}</span>
                  <span className="energy-journal-level-label">{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Mood selection (optional) */}
            {selectedEnergy && (
              <div className="energy-journal-mood-section">
                <p className="energy-journal-mood-label">Estado de ánimo (opcional)</p>
                <div className="energy-journal-mood-grid">
                  {MOOD_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      className={`energy-journal-mood-btn ${selectedMood === emoji ? 'energy-journal-mood-btn--active' : ''}`}
                      onClick={() => setSelectedMood(prev => prev === emoji ? null : emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Note (optional) */}
            {selectedEnergy && (
              <textarea
                className="energy-journal-notes"
                placeholder="Nota rápida... (opcional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                maxLength={200}
                rows={2}
              />
            )}

            {/* Weekly mini-chart */}
            {history.length > 0 && (
              <div className="energy-journal-chart">
                <p className="energy-journal-chart-label">Tu semana</p>
                <div className="energy-journal-bars">
                  {weekData.map((d, i) => (
                    <div key={i} className={`energy-journal-bar-col ${d.isToday ? 'energy-journal-bar-col--today' : ''}`}>
                      <div className="energy-journal-bar-track">
                        <div
                          className="energy-journal-bar-fill"
                          style={{
                            height: d.count > 0 ? `${(d.value / 3) * 100}%` : '0%',
                            background: d.value >= 2.5 ? '#a9b71a' : d.value >= 1.5 ? '#fbbf24' : '#f87171',
                          }}
                        />
                      </div>
                      <span className="energy-journal-bar-day">{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="energy-journal-actions">
              <button
                className="energy-journal-skip"
                onClick={onClose}
              >
                Omitir
              </button>
              <button
                className="energy-journal-submit"
                onClick={handleSubmit}
                disabled={!selectedEnergy || isSaving}
              >
                {isSaving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default EnergyJournal
