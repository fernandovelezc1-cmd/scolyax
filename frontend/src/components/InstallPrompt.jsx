import React, { useEffect, useState } from 'react'
import './InstallPrompt.css'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isEdge, setIsEdge] = useState(false)
  const [isLocalhost, setIsLocalhost] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [deviceType, setDeviceType] = useState('')

  useEffect(() => {
    const hostname = window.location.hostname
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
    setIsLocalhost(isLocal)

    const userAgent = window.navigator.userAgent.toLowerCase()
    const isEdgeBrowser = userAgent.includes('edg/')
    setIsEdge(isEdgeBrowser)

    const isMobileDevice = /iphone|ipad|ipod|android|webos|blackberry|iemobile|opera mini/i.test(userAgent)
    setIsMobile(isMobileDevice)

    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      setDeviceType('ios')
    } else if (userAgent.includes('android')) {
      setDeviceType('android')
    } else {
      setDeviceType('desktop')
    }

    // Limpiar flag antiguo de localStorage si existe
    localStorage.removeItem('scolyax.installPromptDismissed')

    // Verificar si ya está instalada como PWA
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                        window.navigator.standalone ||
                        document.referrer.includes('android-app://')

    if (isInstalled) return

    // Verificar si el usuario ya cerró el banner en esta sesión
    const dismissed = sessionStorage.getItem('scolyax.installPromptDismissed')
    if (dismissed) return

    // Capturar el evento beforeinstallprompt (Chrome, Edge, Android)
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setShowPrompt(true), 500)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Fallback: mostrar instrucciones manuales si beforeinstallprompt no se dispara
    const fallbackTimeout = setTimeout(() => {
      if (!deferredPrompt && !isInstalled) {
        setShowPrompt(true)
      }
    }, isLocal ? 1000 : 2000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(fallbackTimeout)
    }
  }, [])

  const handleInstall = async () => {
    // Si hay prompt nativo disponible → instalación real PWA
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
          setTimeout(() => {
            alert('¡Instalación exitosa!\n\n' +
                  'Scolyax se instaló como aplicación en tu dispositivo.\n\n' +
                  'Busca el ícono de Scolyax en tu pantalla de inicio.')
          }, 1000)
          setShowPrompt(false)
          setDeferredPrompt(null)
        }
      } catch (error) {
        console.error('Error durante la instalación PWA:', error)
      }
      return
    }

    // Sin prompt nativo → mostrar instrucciones manuales según dispositivo
    if (isLocalhost) {
      alert('Modo desarrollo\n\n' +
            'En localhost sin HTTPS no se puede instalar la PWA.\n\n' +
            'Despliega a un servidor con HTTPS para probar la instalación.')
      return
    }

    if (deviceType === 'ios') {
      alert('Instalar Scolyax en iOS\n\n' +
            '1. Toca el botón Compartir en Safari\n\n' +
            '2. Selecciona "Agregar a pantalla de inicio"\n\n' +
            '3. Toca "Agregar"\n\n' +
            'Se creará un icono en tu pantalla de inicio.')
      return
    }

    if (deviceType === 'android') {
      alert('Instalar Scolyax en Android\n\n' +
            '1. Abre el menú (⋮) de tu navegador\n\n' +
            '2. Selecciona "Instalar aplicación" o "Agregar a pantalla de inicio"\n\n' +
            '3. Confirma la instalación\n\n' +
            'Para mejor experiencia usa Chrome.')
      return
    }

    if (isEdge) {
      alert('Instalar en Edge\n\n' +
            '1. Menú → "Aplicaciones"\n\n' +
            '2. Selecciona "Instalar Scolyax"\n\n' +
            'La app se abrirá en su propia ventana.')
      return
    }

    alert('Instalar Scolyax\n\n' +
          '1. Busca el menú de tu navegador (⋮ o ≡)\n\n' +
          '2. Selecciona "Instalar Scolyax" o "Agregar a inicio"\n\n' +
          'Navegadores compatibles: Chrome, Edge, Safari (iOS).')
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    sessionStorage.setItem('scolyax.installPromptDismissed', '1')
  }

  if (!showPrompt) return null

  const getTitle = () => {
    if (deviceType === 'ios') return 'Agrega Scolyax a tu inicio'
    return 'Instala Scolyax'
  }

  const getInstallMessage = () => {
    if (deferredPrompt) {
      return 'Tenla como app nativa: más rápida, a pantalla completa y sin pestañas.'
    }
    if (deviceType === 'ios') {
      return 'Safari → Compartir → "Agregar a pantalla de inicio"'
    }
    if (deviceType === 'android') {
      return 'Menú (⋮) → "Instalar aplicación" para tener la app completa'
    }
    if (isEdge) {
      return 'Menú → Aplicaciones → Instalar Scolyax'
    }
    return 'Toca para ver cómo instalarla según tu dispositivo'
  }

  const getButtonText = () => {
    if (deferredPrompt) return 'Instalar'
    if (isMobile) return 'Ver Cómo Instalar'
    return 'Ver Instrucciones'
  }

  return (
    <div className={`install-prompt ${deferredPrompt ? 'install-prompt--native-ready' : ''}`}>
      <div className="install-prompt__content">
        <div className="install-prompt__icon">
          <img src="/scolyax-icon.svg" alt="" />
          <span className="install-prompt__badge">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </span>
        </div>
        
        <div className="install-prompt__text">
          <h3>{getTitle()}</h3>
          <p>{getInstallMessage()}</p>
        </div>
        
        <div className="install-prompt__actions">
          <button 
            className="install-prompt__button install-prompt__button--primary"
            onClick={handleInstall}
          >
            {getButtonText()}
          </button>
          <button 
            className="install-prompt__button install-prompt__button--secondary"
            onClick={handleDismiss}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
