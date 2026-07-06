import React, { useEffect, useState } from 'react'
import './LoadingBar.css'

/**
 * Barra de carga personalizada que reemplaza la barra del navegador
 * Se activa automáticamente durante navegación y peticiones
 */
export default function LoadingBar({ isLoading }) {
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isLoading) {
      setIsVisible(true)
      setProgress(0)
      
      // Simular progreso realista
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev // Se queda en 90% hasta que termine
          return prev + Math.random() * 10
        })
      }, 200)

      return () => clearInterval(interval)
    } else {
      // Completar la barra
      setProgress(100)
      
      // Ocultar después de la animación
      setTimeout(() => {
        setIsVisible(false)
        setProgress(0)
      }, 400)
    }
  }, [isLoading])

  if (!isVisible) return null

  return (
    <div className="loading-bar">
      <div 
        className="loading-bar__fill" 
        style={{ 
          width: `${progress}%`,
          transition: progress === 100 ? 'width 0.3s ease' : 'width 0.2s ease-out'
        }}
      />
    </div>
  )
}
