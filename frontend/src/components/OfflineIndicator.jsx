/**
 * Componente de indicador de estado online/offline
 * Muestra una barra en la parte superior cuando no hay conexión
 */

import React from 'react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import './OfflineIndicator.css'

const OfflineIndicator = () => {
  const { isOnline, isSyncing } = useOnlineStatus()

  if (isOnline && !isSyncing) {
    return null
  }

  return (
    <div className={`offline-indicator ${isSyncing ? 'syncing' : 'offline'}`}>
      <div className="offline-indicator__content">
        {isSyncing ? (
          <>
            <span className="offline-indicator__icon">🔄</span>
            <span className="offline-indicator__text">Sincronizando datos...</span>
          </>
        ) : (
          <>
            <span className="offline-indicator__icon">🔌</span>
            <span className="offline-indicator__text">Sin conexión - Modo offline</span>
            <span className="offline-indicator__badge">Los cambios se sincronizarán automáticamente</span>
          </>
        )}
      </div>
    </div>
  )
}

export default OfflineIndicator
