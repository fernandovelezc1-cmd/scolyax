/**
 * Componente para solicitar permisos de notificaciones
 * Muestra un banner o modal cuando los permisos no están concedidos
 */
import React, { useState, useEffect } from 'react'
import notificationService from '../services/notificationService'
import Sticker from './Stickers'
import './NotificationPermissionBanner.css'

const NotificationPermissionBanner = ({ onPermissionGranted }) => {
  const [showBanner, setShowBanner] = useState(false)
  const [permission, setPermission] = useState('default')
  const [isRequesting, setIsRequesting] = useState(false)

  useEffect(() => {
    const currentPermission = notificationService.checkPermission()
    setPermission(currentPermission)
    
    // Mostrar banner si el permiso no ha sido concedido o denegado
    // y si el usuario no ha cerrado el banner antes (localStorage)
    const bannerDismissed = localStorage.getItem('scolyax.notificationBanner.dismissed')
    
    if (currentPermission === 'default' && !bannerDismissed) {
      // Mostrar después de 3 segundos para no ser intrusivo
      setTimeout(() => setShowBanner(true), 3000)
    }
  }, [])

  const handleRequestPermission = async () => {
    setIsRequesting(true)
    
    try {
      const newPermission = await notificationService.requestPermission()
      setPermission(newPermission)
      
      if (newPermission === 'granted') {
        setShowBanner(false)
        
        // Mostrar notificación de prueba
        notificationService.showNotification('🎉 ¡Notificaciones activadas!', {
          body: 'Ahora recibirás recordatorios y alertas importantes.',
          tag: 'welcome-notification'
        })
        
        if (onPermissionGranted) {
          onPermissionGranted()
        }
      } else if (newPermission === 'denied') {
        // El usuario denegó el permiso
        setShowBanner(false)
        localStorage.setItem('scolyax.notificationBanner.dismissed', 'true')
      }
    } catch (error) {
      console.error('Error al solicitar permisos:', error)
    } finally {
      setIsRequesting(false)
    }
  }

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('scolyax.notificationBanner.dismissed', 'true')
  }

  if (!notificationService.isSupported()) {
    return null
  }

  if (permission === 'granted' || !showBanner) {
    return null
  }

  return (
    <div className="notification-banner">
      <div className="notification-banner__container">
        <div className="notification-banner__icon"><Sticker name="bell" size={26} /></div>
        <div className="notification-banner__content">
          <h3 className="notification-banner__title">
            Activa las notificaciones
          </h3>
          <p className="notification-banner__description">
            Recibe recordatorios de tareas, alertas de Pomodoro y más directamente en tu dispositivo.
          </p>
        </div>
        <div className="notification-banner__actions">
          <button
            type="button"
            className="notification-banner__btn notification-banner__btn--primary"
            onClick={handleRequestPermission}
            disabled={isRequesting}
          >
            {isRequesting ? 'Solicitando...' : 'Activar'}
          </button>
          <button
            type="button"
            className="notification-banner__btn notification-banner__btn--secondary"
            onClick={handleDismiss}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotificationPermissionBanner
