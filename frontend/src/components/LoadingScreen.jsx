import React, { useEffect, useState, useRef } from 'react'
import './LoadingScreen.css'

const MESSAGES = [
  'Sincronizando tus datos...',
  'Cargando herramientas personalizadas...',
  'Preparando tu dashboard...',
  'Aplicando tu perfil cognitivo...',
  'Casi listo...'
]

export default function LoadingScreen({ isVisible, onLoadingComplete, isDark: isDarkProp }) {
  const [progress, setProgress]   = useState(0)
  const [msgIdx, setMsgIdx]       = useState(0)
  const [isDark, setIsDark]       = useState(() => isDarkProp ?? false)
  const [leaving, setLeaving]     = useState(false)
  const canvasRef                 = useRef(null)

  // Sync with app's isDark prop; fall back to prefers-color-scheme if not provided
  useEffect(() => {
    if (isDarkProp !== undefined) {
      setIsDark(isDarkProp)
      return
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mq.matches)
    const h = (e) => setIsDark(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [isDarkProp])

  // Progress
  useEffect(() => {
    if (!isVisible) { setProgress(0); setMsgIdx(0); setLeaving(false); return }

    let p = 0
    const tick = setInterval(() => {
      p += p < 50 ? Math.random() * 18 + 4 : Math.random() * 7 + 2
      if (p >= 90) { p = 90; clearInterval(tick) }
      setProgress(Math.min(p, 90))
      setMsgIdx(Math.min(Math.floor(p / 22), MESSAGES.length - 1))
    }, 280)

    const done = setTimeout(() => {
      setProgress(100)
      setMsgIdx(MESSAGES.length - 1)
      setTimeout(() => {
        setLeaving(true)
        setTimeout(() => { if (onLoadingComplete) onLoadingComplete() }, 600)
      }, 350)
    }, 2000)

    return () => { clearInterval(tick); clearTimeout(done) }
  }, [isVisible, onLoadingComplete])

  // Canvas particles
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isVisible) return
    const ctx = canvas.getContext('2d')
    let raf, w, h

    const resize = () => {
      w = canvas.width  = canvas.offsetWidth
      h = canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const COUNT = 55
    const color = isDark ? '45,212,191' : '14,165,164'
    const pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * 1400, y: Math.random() * 900,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
      a: Math.random() * 0.45 + 0.15
    }))

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${color},${p.a})`; ctx.fill()
      })
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const d = Math.sqrt(dx*dx + dy*dy)
          if (d < 120) {
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = `rgba(${color},${0.06*(1-d/120)})`
            ctx.lineWidth = 0.5; ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [isVisible, isDark])

  if (!isVisible) return null

  const pct = Math.round(progress)

  return (
    <div className={`ls-root ${isDark ? 'ls-dark' : 'ls-light'} ${leaving ? 'ls-leaving' : 'ls-enter'}`}>
      <canvas ref={canvasRef} className="ls-canvas" aria-hidden="true" />

      <div className="ls-blob ls-blob--1" />
      <div className="ls-blob ls-blob--2" />

      <div className="ls-card">
        {/* Animated logo */}
        <div className="ls-logo">
          <svg className="ls-logo__ring" viewBox="0 0 120 120" fill="none" aria-hidden="true">
            <circle cx="60" cy="60" r="54" strokeWidth="2" strokeDasharray="340" strokeDashoffset={340 - (340 * progress / 100)} strokeLinecap="round" />
          </svg>
          <div className="ls-logo__inner">
            <img className="ls-logo__mark" src="/scolyax-icon.svg" alt="Scolyax" />
          </div>
        </div>

        {/* Brand */}
        <div className="ls-brand">
          <h1 className="ls-brand__name">Scolyax</h1>
          <p className="ls-brand__tagline">Tu espacio de estudio inteligente</p>
        </div>

        {/* Progress bar */}
        <div className="ls-progress">
          <div className="ls-progress__track">
            <div className="ls-progress__fill" style={{ width: `${progress}%` }}>
              <div className="ls-progress__glow" />
            </div>
          </div>
          <div className="ls-progress__footer">
            <span className="ls-progress__msg">{MESSAGES[msgIdx]}</span>
            <span className="ls-progress__pct">{pct}%</span>
          </div>
        </div>

        {/* Dots */}
        <div className="ls-dots" aria-hidden="true">
          {[0,1,2].map(i => <span key={i} className="ls-dots__dot" style={{ animationDelay: `${i*0.2}s` }} />)}
        </div>
      </div>
    </div>
  )
}