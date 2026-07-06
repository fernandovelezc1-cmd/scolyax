/**
 * Component: AIToolRecommendations
 * Muestra las herramientas de gestión de tiempo recomendadas post-test por Iris
 */

import React, { useState } from 'react'
import './AIToolRecommendations.css'

export default function AIToolRecommendations({ 
  recommendation,
  onSelectTool,
  onClose
}) {
  const [selectedTool, setSelectedTool] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Definición de las 3 herramientas
  const toolDetails = {
    adaptive_learning: {
      name: '🧠 Adaptive Learning Flow',
      icon: '🧠',
      color: '#3b82f6',
      subtitle: 'Ciclos adaptativos ajustados por IA',
      description: 'La IA ajusta automáticamente tus ciclos de estudio según tu desempeño. Comienza con 40 minutos y se adapta según avances.',
      benefits: [
        '📈 Se adapta a tu ritmo individual',
        '⏱️ Duración flexible (40-90 min)',
        '🔔 Checkpoints cada 20 minutos',
        '📊 Seguimiento de mejora continua'
      ],
      bestFor: 'Personas que necesitan flexibilidad',
      sessionLength: '40-90 minutos'
    },
    deep_focus: {
      name: '⚡ Deep Focus Sprints',
      icon: '⚡',
      color: '#ef4444',
      subtitle: 'Sesiones enfocadas con breaks matemáticos',
      description: 'Ciclos de 60 minutos estructurados: 30 min enfoque + 5 min break + 30 min profundo + 10 min break.',
      benefits: [
        '🎯 Estructura clara y probada',
        '💪 Máxima concentración y productividad',
        '😴 Breaks cognitivos optimizados',
        '📝 4 checkpoints de progreso'
      ],
      bestFor: 'Personas con buena capacidad de concentración',
      sessionLength: '60 minutos fijos'
    },
    goal_tracking: {
      name: '📈 Goal Progress Tracking',
      icon: '📈',
      color: '#a9b71a',
      subtitle: 'Micro-metas con verificación visual',
      description: 'Divide tu tarea en 3-5 hitos pequeños. Cada hito requiere foto + descripción verificada por IA.',
      benefits: [
        '👁️ Visualiza progreso paso a paso',
        '📸 Evidencia fotográfica de avance',
        '🤖 Verificación de IA en cada hito',
        '💡 Recomendaciones personalizadas'
      ],
      bestFor: 'Personas que necesitan ver progreso visual',
      sessionLength: 'Duración variable según metas'
    }
  }

  const handleSelectTool = async (toolId) => {
    setSelectedTool(toolId)
    setIsLoading(true)

    try {
      // Llamar callback del padre
      await onSelectTool(toolId)
      
      // Mostrar feedback visual
      setTimeout(() => {
        setIsLoading(false)
        onClose?.()
      }, 1000)
    } catch (error) {
      setIsLoading(false)
      console.error('Error seleccionando herramienta:', error)
    }
  }

  return (
    <div className="ai-recommendations-container">
      {/* Header */}
      <div className="recommendations-header">
        <h1>🤖 Iris - Recomendación Personalizada</h1>
        <p>Basada en tu perfil de aprendizaje detectado en el test</p>
      </div>

      {/* Recomendación de Iris */}
      {recommendation && (
        <div className="iris-recommendation">
          <div className="recommendation-badge">
            <span className="iris-avatar">🪻</span>
            <h2>Herramienta Recomendada</h2>
          </div>
          
          <div 
            className="recommended-tool-highlight"
            style={{
              borderLeft: `4px solid ${toolDetails[recommendation.tool_type]?.color}`
            }}
          >
            <h3>{toolDetails[recommendation.tool_type]?.name}</h3>
            <p className="recommendation-reason">{recommendation.reasoning}</p>
            <div className="confidence-meter">
              <div className="confidence-label">
                <span>Confianza de Iris:</span>
                <span className="confidence-value">
                  {(recommendation.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="confidence-bar">
                <div 
                  className="confidence-fill"
                  style={{
                    width: `${recommendation.confidence * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid de las 3 herramientas */}
      <div className="tools-grid">
        {Object.entries(toolDetails).map(([toolId, tool]) => {
          const isRecommended = recommendation?.tool_type === toolId
          const isSelected = selectedTool === toolId
          
          return (
            <div
              key={toolId}
              className={`tool-card ${isRecommended ? 'recommended' : ''} ${isSelected ? 'selected' : ''}`}
              style={{
                '--tool-color': tool.color
              }}
            >
              {isRecommended && (
                <div className="recommended-badge-small">
                  ✓ Recomendada
                </div>
              )}

              <div className="tool-icon">{tool.icon}</div>
              <h3>{tool.name}</h3>
              <p className="tool-subtitle">{tool.subtitle}</p>
              <p className="tool-description">{tool.description}</p>

              <div className="tool-details">
                <div className="detail-item">
                  <span className="detail-label">⏱️ Duración:</span>
                  <span className="detail-value">{tool.sessionLength}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">👤 Ideal para:</span>
                  <span className="detail-value">{tool.bestFor}</span>
                </div>
              </div>

              <ul className="tool-benefits">
                {tool.benefits.map((benefit, idx) => (
                  <li key={idx}>{benefit}</li>
                ))}
              </ul>

              <button
                type="button"
                className={`btn-select ${isSelected ? 'btn-loading' : ''}`}
                onClick={() => handleSelectTool(toolId)}
                disabled={isLoading}
              >
                {isLoading && isSelected ? '⏳ Activando...' : '🚀 Seleccionar'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Tips de Iris */}
      <div className="iris-tips">
        <h3>💡 Consejos de Iris</h3>
        <ul>
          <li>Puedes cambiar de herramienta en cualquier momento desde Mis Herramientas</li>
          <li>Cada herramienta tiene checkpoints para monitorear tu progreso real</li>
          <li>Aprueba los checkpoints con fotos y descripciones detalladas</li>
          <li>Recibirás feedback personalizado después de cada checkpoint</li>
          <li>La IA ajusta sus recomendaciones según tu desempeño</li>
        </ul>
      </div>

      {/* Close button */}
      <button className="btn-close-recommendations" onClick={onClose}>
        ← Cerrar
      </button>
    </div>
  )
}
