/**
 * AuthGateway.jsx — Scolyax (dark glass login)
 * Mantiene toda la lógica de detección de backend y login OAuth Google/Microsoft.
 */
import React, { useEffect, useState } from 'react'
import { useOAuthPopup } from '../utils/oauthPopup'
import Sticker from './Stickers'
import './AuthGateway.css'

const providerCopy = {
  google: { title: 'Google' },
  microsoft: { title: 'Microsoft' },
}

export default function AuthGateway({ isDarkMode = false, onToggleDarkMode = () => {} }) {

  // v6.7.7: Usar producción directamente, auto-detect solo en desarrollo
  const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
  const productionUrl = (import.meta.env.VITE_API_URL || 'https://scolyax-production.up.railway.app').replace(/\/+$/, '')

  const initialCandidates = isProduction
    ? [productionUrl]  // En producción, usar Railway directamente
    : [
        'http://localhost:8000',
        'http://127.0.0.1:8000',
        import.meta?.env?.VITE_apiBase || '',
        import.meta?.env?.VITE_API_URL || '',
        localStorage.getItem('scolyax-api-base') || '',
        productionUrl,
      ].filter(Boolean)

  const [apiBase, setApiBase] = useState(isProduction ? productionUrl : 'http://localhost:8000')
  const [isBackendReachable, setIsBackendReachable] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [pendingKey, setPendingKey] = useState(null)
  const [feedback, setFeedback] = useState('')

  // OAuth popup hook - pasar apiBase
  const { login: oauthLogin, isLoading: isOAuthLoading, error: oauthError } = useOAuthPopup(apiBase)

  async function ping(base){
    const url = `${base.replace(/\/+$/,'')}/health`
    try{
      const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 1500) // ⚡ Reducido de 3s a 1.5s
      const res = await fetch(url, {
        method:'GET',
        credentials:'omit',
        mode:'cors',
        headers: {
          'Accept': 'application/json'
        },
        signal: ctrl.signal
      })
      clearTimeout(t)
      return res.ok || res.status === 200
    }catch(e){
      console.log(`❌ Ping failed for ${base}: ${e.message}`)
      return false
    }
  }

  async function detectReachableBase(candidates){
    console.time('⏱️ Backend detection')

    // En producción, asumir que Railway está disponible SIN ping
    if (isProduction) {
      setIsBackendReachable(true)
      setApiBase(productionUrl)
      localStorage.setItem('scolyax-api-base', productionUrl)
      console.timeEnd('⏱️ Backend detection')
      return
    }

    // En desarrollo, hacer auto-detection EN PARALELO (no secuencial)
    console.log('🔍 Checking backends in parallel:', candidates.length)
    const results = await Promise.allSettled(
      candidates.map(async (base) => {
        const isReachable = await ping(base)
        return { base, isReachable }
      })
    )

    // Usar el primer backend que responda
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.isReachable) {
        const base = result.value.base
        console.log('✅ Found reachable backend:', base)
        localStorage.setItem('scolyax-api-base', base)
        setIsBackendReachable(true)
        setApiBase(base)
        console.timeEnd('⏱️ Backend detection')
        return
      }
    }

    console.timeEnd('⏱️ Backend detection')
    setIsBackendReachable(false)
  }

  useEffect(() => { detectReachableBase(initialCandidates) }, [])

  function buildAuthUrl(provider, mode){
    try{
      const base = (apiBase || 'http://localhost:8000').replace(/\/+$/,'')
      const next = window.location.origin + '/'
      const url = `${base}/auth/${provider}/start?mode=${mode}&next=${encodeURIComponent(next)}`
      console.log(`🔗 Auth URL for ${provider}: ${url}`)
      return url
    }catch(_){
      return `/auth/${provider}/start?mode=${mode}&next=${encodeURIComponent('/')}`
    }
  }
  function handleAction(provider, mode) {
    async function executeLogin() {
      console.time(`⏱️ OAuth ${provider} login`)
      console.log('🔵 Starting OAuth login for', provider)

      try {
        setIsLoading(true)
        setPendingKey(`${provider}-${mode}`)
        setFeedback('')

        console.time('⏱️ OAuth popup open')
        const token = await oauthLogin(provider, mode)
        console.timeEnd('⏱️ OAuth popup open')

        console.log('✅ Token recibido del popup:', token ? token.substring(0, 20) + '...' : 'null')

        // Guardar token en localStorage
        if (token) {
          window.localStorage.setItem('scolyax.sessionToken', token)
          console.log('💾 Token saved to localStorage')
        }

        console.timeEnd(`⏱️ OAuth ${provider} login`)

        // Recargar para que App.jsx detecte el token
        console.log('🔄 Reloading to apply session...')
        window.location.href = '/'
      } catch (e) {
        console.timeEnd(`⏱️ OAuth ${provider} login`)
        console.error('❌ OAuth error:', e.message)
        setIsLoading(false)
        setPendingKey(null)
        setFeedback(e?.message || String(e))
      }
    }

    executeLogin()
  }

  function handleOffline() {
    try {
      localStorage.setItem('scolyax-demo', '1')
      window.location.href = '/'
    } catch (_) {}
  }

  return (
    <>
      <div className="sx-auth-bg" aria-hidden="true" />
      <div className="sx-auth">
        <div className="sx-auth__brand">
          <img className="sx-auth__mark" src="/scolyax-icon.svg" alt="Scolyax" />
          <div>
            <span className="sx-auth__name">Scolyax</span>
            <span className="sx-auth__tagline">Tu asistente académico inteligente</span>
          </div>
        </div>

        <h1 className="sx-auth__title">Bienvenido de vuelta</h1>
        <p className="sx-auth__subtitle">Inicia sesión para acceder a tu tablero personalizado.</p>

        {!isBackendReachable && (
          <div className="sx-alert" role="status">
            <span aria-hidden="true">⚠️</span>
            <div>
              <strong className="sx-alert__title">Backend no disponible</strong>
              <p className="sx-alert__text">Puedes explorar en modo demostración mientras reconectamos.</p>
            </div>
          </div>
        )}

        <div className="sx-auth__providers">
          {['google', 'microsoft'].map((provider) => {
            const copy = providerCopy[provider]
            const isLoadingProvider = pendingKey === `${provider}-login`
            return (
              <a
                key={provider}
                href={buildAuthUrl(provider, 'login')}
                className={`sx-prov ${isLoadingProvider ? 'sx-prov--loading' : ''}`}
                onClick={() => { setIsLoading(true); setPendingKey(`${provider}-login`) }}
                aria-busy={isLoadingProvider}
              >
                <span className="sx-prov__icon">
                  {provider === 'google' && (
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {provider === 'microsoft' && (
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="#F25022" d="M1 1h10v10H1z"/>
                      <path fill="#00A4EF" d="M13 1h10v10H13z"/>
                      <path fill="#7FBA00" d="M1 13h10v10H1z"/>
                      <path fill="#FFB900" d="M13 13h10v10H13z"/>
                    </svg>
                  )}
                </span>
                <span className="sx-prov__text">
                  {isLoadingProvider ? 'Redirigiendo...' : `Continuar con ${copy.title}`}
                </span>
                {isLoadingProvider && <span className="sx-spin" aria-hidden="true" />}
              </a>
            )
          })}
        </div>

        {!isBackendReachable && (
          <button type="button" className="sx-demo" onClick={handleOffline}>
            🎮 Explorar en modo demostración
          </button>
        )}

        {feedback && (
          <div className="sx-feedback" role="status">
            <span aria-hidden="true">ℹ️</span>
            <span>{feedback}</span>
          </div>
        )}

        <div className="sx-auth__divider">Acceso seguro</div>

        <div className="sx-auth__benefits">
          <span className="sx-benefit"><Sticker name="repeat" size={14} /> Sincronización automática</span>
          <span className="sx-benefit"><Sticker name="shield" size={14} /> 100% privado</span>
          <span className="sx-benefit"><Sticker name="bolt" size={14} /> Acceso instantáneo</span>
        </div>

        <footer className="sx-auth__footer">
          Al continuar, aceptas nuestros <a href="#">términos de servicio</a> y <a href="#">política de privacidad</a>.
        </footer>
      </div>
    </>
  )
}
