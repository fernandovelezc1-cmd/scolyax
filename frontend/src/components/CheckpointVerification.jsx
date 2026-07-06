/**
 * Component: CheckpointVerification
 * Pantalla de verificación de checkpoint: foto + descripción + análisis de Iris
 */

import React, { useState, useRef } from 'react'
import './CheckpointVerification.css'

export default function CheckpointVerification({
  checkpoint,
  sessionId,
  taskTitle,
  onApproved,
  onRejected
}) {
  const [description, setDescription] = useState('')
  const [photoBase64, setPhotoBase64] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [verification, setVerification] = useState(null)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  // Manejar selección de foto desde galería
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result
        setPhotoBase64(base64)
        setPhotoPreview(base64)
      }
      reader.readAsDataURL(file)
    }
  }

  // Capturar foto con cámara
  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result
        setPhotoBase64(base64)
        setPhotoPreview(base64)
      }
      reader.readAsDataURL(file)
    }
  }

  // Enviar evidencia al backend
  const handleSubmitCheckpoint = async () => {
    if (!description.trim()) {
      alert('Por favor describe tu avance')
      return
    }

    if (!photoBase64) {
      alert('Por favor incluye una foto de tu trabajo')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/ai/checkpoint/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('scolyax.sessionToken')}`
        },
        body: JSON.stringify({
          checkpoint_id: checkpoint.id,
          session_id: sessionId,
          user_description: description,
          photo_base64: photoBase64
        })
      })

      if (!response.ok) throw new Error('Error enviando checkpoint')

      const result = await response.json()
      setVerification(result)
      setShowFeedbackModal(true)

      // Callback según si fue aprobado
      if (result.verified) {
        setTimeout(() => onApproved(result), 2000)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error enviando checkpoint. Intenta nuevamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reintentar checkpoint
  const handleRetry = () => {
    setDescription('')
    setPhotoBase64(null)
    setPhotoPreview(null)
    setVerification(null)
    setShowFeedbackModal(false)
  }

  return (
    <div className="checkpoint-container">
      {/* Header */}
      <div className="checkpoint-header">
        <div className="checkpoint-info">
          <h2>🎯 Checkpoint #{checkpoint.checkpoint_number}</h2>
          <p className="checkpoint-title">{taskTitle}</p>
        </div>
        <div className="checkpoint-timer">
          <span className="timer-icon">⏱️</span>
          <span className="timer-text">5 min para responder</span>
        </div>
      </div>

      {/* Form */}
      <div className="checkpoint-form">
        {/* Instrucciones */}
        <div className="checkpoint-instructions">
          <h3>📝 Describe tu progreso</h3>
          <p>
            Cuéntanos qué completaste en esta sesión. 
            Incluye detalles específicos del trabajo realizado.
          </p>
        </div>

        {/* Textarea */}
        <div className="form-group">
          <label htmlFor="description">Descripción de Avance</label>
          <textarea
            id="description"
            className="description-input"
            placeholder="Ej: Completé el primer ejemplo del capítulo 3, implementé la función factorial en Python, probé con 3 casos de prueba..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            disabled={isSubmitting}
          />
          <div className="character-count">
            {description.length} caracteres (mínimo: 20)
          </div>
        </div>

        {/* Photo Upload */}
        <div className="form-group">
          <label>📸 Foto de Evidencia</label>
          <p className="photo-hint">
            Toma una foto de tu trabajo, pantalla, código o libretas
          </p>

          {photoPreview ? (
            <div className="photo-preview-container">
              <img src={photoPreview} alt="Preview" className="photo-preview" />
              <button
                type="button"
                className="btn-remove-photo"
                onClick={() => {
                  setPhotoBase64(null)
                  setPhotoPreview(null)
                }}
              >
                ✕ Cambiar Foto
              </button>
            </div>
          ) : (
            <div className="photo-upload-options">
              <button
                type="button"
                className="btn-photo-option"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="icon">📁</span>
                <span className="text">Subir Foto</span>
              </button>
              <button
                type="button"
                className="btn-photo-option"
                onClick={() => cameraInputRef.current?.click()}
              >
                <span className="icon">📷</span>
                <span className="text">Capturar Foto</span>
              </button>
            </div>
          )}

          {/* File inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            style={{ display: 'none' }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraCapture}
            style={{ display: 'none' }}
          />
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            type="button"
            className="btn--primary btn--large"
            onClick={handleSubmitCheckpoint}
            disabled={isSubmitting || !description.trim() || !photoBase64}
          >
            {isSubmitting ? '⏳ Verificando...' : '✅ Enviar Evidencia'}
          </button>
          <button
            type="button"
            className="btn--secondary"
            onClick={() => {
              // Volver sin enviar (pausa)
            }}
          >
            ⏸️ Pausar Sesión
          </button>
        </div>
      </div>

      {/* Modal Feedback de Iris */}
      {showFeedbackModal && verification && (
        <div className="checkpoint-modal-overlay">
          <div className="checkpoint-modal">
            <div className={`modal-header ${verification.verified ? 'approved' : 'rejected'}`}>
              <span className="modal-avatar">🤖</span>
              <h3>Análisis de Iris</h3>
            </div>

            <div className="modal-content">
              {/* Status */}
              <div className={`verification-status ${verification.verified ? 'approved' : 'rejected'}`}>
                <span className="status-icon">
                  {verification.verified ? '✅' : '⚠️'}
                </span>
                <span className="status-text">
                  {verification.verified 
                    ? 'Checkpoint Aprobado' 
                    : 'Necesita Mejora'}
                </span>
              </div>

              {/* Confidence */}
              <div className="confidence-display">
                <div className="confidence-label">
                  <span>Confianza de análisis:</span>
                  <span className="confidence-value">
                    {(verification.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill"
                    style={{
                      width: `${verification.confidence * 100}%`
                    }}
                  />
                </div>
              </div>

              {/* Detected Elements */}
              {verification.detected_elements.length > 0 && (
                <div className="analysis-section">
                  <h4>✅ Detectado:</h4>
                  <ul className="element-list detected">
                    {verification.detected_elements.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Elements */}
              {verification.missing_elements.length > 0 && (
                <div className="analysis-section">
                  <h4>❌ Falta:</h4>
                  <ul className="element-list missing">
                    {verification.missing_elements.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Feedback */}
              <div className="ai-feedback">
                <h4>💡 Feedback de Iris:</h4>
                <p>{verification.ai_feedback}</p>
              </div>

              {/* Suggestions */}
              {verification.suggestions_for_next.length > 0 && (
                <div className="suggestions-section">
                  <h4>📋 Para el próximo checkpoint:</h4>
                  <ul className="suggestions-list">
                    {verification.suggestions_for_next.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Performance Trend */}
              <div className="performance-trend">
                <span className="trend-icon">
                  {verification.performance_trend === 'improving' && '📈'}
                  {verification.performance_trend === 'stable' && '➡️'}
                  {verification.performance_trend === 'declining' && '📉'}
                </span>
                <span className="trend-text">
                  {verification.performance_trend === 'improving' && 'Mejorando'}
                  {verification.performance_trend === 'stable' && 'Manteniendo ritmo'}
                  {verification.performance_trend === 'declining' && 'Necesita enfoque'}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions">
              {verification.verified ? (
                <button
                  type="button"
                  className="btn--primary btn--full"
                  onClick={() => {
                    setShowFeedbackModal(false)
                    onApproved(verification)
                  }}
                >
                  🎯 Continuar al Siguiente Checkpoint
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn--primary btn--full"
                    onClick={handleRetry}
                  >
                    🔄 Reintentar
                  </button>
                  <button
                    type="button"
                    className="btn--secondary"
                    onClick={() => onRejected(verification)}
                  >
                    ⏸️ Pausar Sesión
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
