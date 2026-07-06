/**
 * Hook para gestionar el estado online/offline
 * Detecta cambios de conectividad y activa sincronización
 */

import React, { useEffect, useState } from 'react'
import syncService from '../services/syncService'

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      setIsSyncing(true)
      
      try {
        await syncService.syncAll()
      } finally {
        setIsSyncing(false)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Registrar callback para sincronización
    syncService.onSyncComplete((result) => {
      setIsSyncing(false)
      if (result.success) {
        console.log('✅ Sincronización completada desde hook')
      }
    })

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, isSyncing }
}
