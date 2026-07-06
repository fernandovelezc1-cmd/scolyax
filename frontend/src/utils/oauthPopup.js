/**
 * Maneja OAuth en popup para evitar redirecciones que rompen la experiencia PWA
 */

import React, { useState } from 'react'

const POPUP_WIDTH = 500
const POPUP_HEIGHT = 700

/**
 * Abre OAuth en un popup centrado
 * @param {string} url - URL del OAuth provider
 * @param {string} providerName - Nombre del provider (google, microsoft, etc)
 * @returns {Promise<string>} - Token de sesión
 */
export function openOAuthPopup(url, providerName = 'OAuth') {
  return new Promise((resolve, reject) => {
    // Calcular posición centrada
    const left = window.screen.width / 2 - POPUP_WIDTH / 2
    const top = window.screen.height / 2 - POPUP_HEIGHT / 2

    // Abrir popup
    const popup = window.open(
      url,
      `${providerName} Login`,
      `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
    )

    if (!popup) {
      reject(new Error('No se pudo abrir la ventana de login. Verifica que no esté bloqueada por el navegador.'))
      return
    }

    // Detectar cuando el popup se cierra
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed)
        window.removeEventListener('message', messageHandler)
        reject(new Error('Login cancelado'))
      }
    }, 500)

    // Escuchar mensajes del popup
    const messageHandler = (event) => {
      // Verificar origen por seguridad
      const allowedOrigins = [
        window.location.origin,
        process.env.VITE_API_URL || 'http://localhost:8000'
      ]

      if (!allowedOrigins.includes(event.origin)) {
        console.warn('❌ Mensaje de origen no permitido:', event.origin)
        return
      }

      // Manejar respuesta de OAuth
      if (event.data.type === 'oauth-success') {
        clearInterval(checkClosed)
        window.removeEventListener('message', messageHandler)
        popup.close()
        resolve(event.data.token)
      } else if (event.data.type === 'oauth-error') {
        clearInterval(checkClosed)
        window.removeEventListener('message', messageHandler)
        popup.close()
        reject(new Error(event.data.error || 'Error en autenticación'))
      }
    }

    window.addEventListener('message', messageHandler)

    // Timeout de 5 minutos
    setTimeout(() => {
      if (!popup.closed) {
        clearInterval(checkClosed)
        window.removeEventListener('message', messageHandler)
        popup.close()
        reject(new Error('Timeout: El login tardó demasiado'))
      }
    }, 5 * 60 * 1000)
  })
}

/**
 * Para usar desde el callback de OAuth (en la página de callback)
 * Envía el resultado al opener y cierra la ventana
 */
export function sendOAuthResultToOpener(success, tokenOrError) {
  if (!window.opener) {
    console.error('❌ No se encontró ventana padre')
    return
  }

  const message = success
    ? { type: 'oauth-success', token: tokenOrError }
    : { type: 'oauth-error', error: tokenOrError }

  window.opener.postMessage(message, window.location.origin)
  
  // Cerrar popup después de enviar mensaje
  setTimeout(() => window.close(), 100)
}

/**
 * Hook para manejar OAuth en popup desde componentes React
 * @param {string} apiBaseUrl - URL base del API (opcional)
 */
export function useOAuthPopup(apiBaseUrl) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const login = async (provider, mode = 'login') => {
    setIsLoading(true)
    setError(null)

    try {
      const apiUrl = apiBaseUrl || import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const next = window.location.origin + '/'
      // Construir URL correcta con mode, next y popup
      const authUrl = `${apiUrl}/auth/${provider}/start?mode=${mode}&next=${encodeURIComponent(next)}&popup=1`
      
      console.log('🔷 OAuth popup URL:', authUrl)
      
      const token = await openOAuthPopup(authUrl, provider)
      
      setIsLoading(false)
      return token
    } catch (err) {
      setError(err.message)
      setIsLoading(false)
      throw err
    }
  }

  return { login, isLoading, error }
}
