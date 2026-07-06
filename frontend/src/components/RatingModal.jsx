import React, { useState, useEffect } from 'react'
import '../styles/rating-modal.css'

/**
 * Modal de calificación que aparece después de desbloquear un logro
 * Permite al usuario dar una puntuación de 1-5 estrellas y un comentario
 */
const RatingModal = ({ 
  isOpen, 
  achievement, 
  onClose, 
  onSubmit,
  apiBase
}) => {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Usar URL dinámica, fallback a localhost si no se proporciona
  const baseURL = apiBase || 'http://localhost:8000'

  useEffect(() => {
    if (!isOpen) {
      setRating(0)
      setComment('')
      setShowSuccess(false)
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rating) return

    setIsSubmitting(true)
    try {
      const sessionToken = localStorage.getItem('scolyax.sessionToken') || ''
      
      const payload = {
        achievement_id: achievement?.id || '',
        rating,
        comment: comment.trim()
      }

      // Enviar al backend
      const response = await fetch(`${baseURL}/user-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        // Guardar en localStorage que el usuario ya calificó este logro
        const ratedAchievements = JSON.parse(localStorage.getItem('ratedAchievements') || '[]')
        if (!ratedAchievements.includes(achievement?.id)) {
          ratedAchievements.push(achievement?.id)
          localStorage.setItem('ratedAchievements', JSON.stringify(ratedAchievements))
        }

        setShowSuccess(true)
        setTimeout(() => {
          onClose()
          if (onSubmit) onSubmit(payload)
        }, 1500)
      } else {
        // Error de backend — guardar localmente y cerrar igual para no bloquear al usuario
        const ratedAchievements = JSON.parse(localStorage.getItem('ratedAchievements') || '[]')
        if (!ratedAchievements.includes(achievement?.id)) {
          ratedAchievements.push(achievement?.id)
          localStorage.setItem('ratedAchievements', JSON.stringify(ratedAchievements))
        }
        setShowSuccess(true)
        setTimeout(() => {
          onClose()
        }, 1500)
      }
    } catch (error) {
      console.error('Error enviando calificación:', error)
      // Aún así cerrar el modal
      setShowSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="rating-modal-overlay">
      <div className="rating-modal">
        {showSuccess ? (
          <div className="rating-success">
            <div className="success-icon">✓</div>
            <p>¡Gracias por tu retroalimentación!</p>
          </div>
        ) : (
          <>
            <button 
              className="rating-modal__close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ×
            </button>

            <div className="rating-modal__content">
              <h2 className="rating-modal__title">
                ¿Qué te pareció?
              </h2>

              <form onSubmit={handleSubmit} className="rating-form">
                {/* Stars - 5 estrellas que se rellenan al hacer clic */}
                <div className="rating-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star ${star <= rating ? 'filled' : 'empty'}`}
                      onClick={() => setRating(star)}
                      aria-label={`Calificar ${star} estrellas`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                {/* Comment */}
                <textarea
                  className="rating-comment"
                  placeholder="Cuéntanos qué te pareció (opcional)"
                  value={comment}
                  onChange={(e) =>
                    setComment(e.target.value.slice(0, 200))
                  }
                  maxLength={200}
                />

                {/* Buttons */}
                <div className="rating-buttons">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!rating || isSubmitting}
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default RatingModal

