import React, { useState, useEffect, useRef } from 'react'
import './OnboardingLoader.css'

const STEPS = [
  { icon: '🔍', label: 'Analizando tu perfil...' },
  { icon: '🧪', label: 'Preparando tu test cognitivo...' },
  { icon: '🎯', label: 'Casi listo para empezar...' }
]

export default function OnboardingLoader({ userName, isFadingOut, isDark: isDarkProp }) {
  const [isDark, setIsDark]   = useState(() => isDarkProp ?? false)
  const [step, setStep]       = useState(0)
  const canvasRef             = useRef(null)

  useEffect(() => {
    if (isDarkProp !== undefined) { setIsDark(isDarkProp); return }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mq.matches)
    const h = (e) => setIsDark(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [isDarkProp])

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 800)
    const t2 = setTimeout(() => setStep(2), 1700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, w, h

    const resize = () => {
      w = canvas.width  = canvas.offsetWidth
      h = canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const COLOR = isDark ? '165,180,252' : '99,102,241'
    const COUNT = 40
    const pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * 1400, y: Math.random() * 900,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12,
      a: Math.random() * 0.4 + 0.1
    }))

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${COLOR},${p.a})`; ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [isDark])

  const first = (userName || 'Usuario').split(' ')[0]

  return (
    <div className={`ol-root ${isDark ? 'ol-dark' : 'ol-light'} ${isFadingOut ? 'ol-exit' : 'ol-enter'}`}>
      <canvas ref={canvasRef} className="ol-canvas" aria-hidden="true" />
      <div className="ol-blob ol-blob--1" />
      <div className="ol-blob ol-blob--2" />
      <div className="ol-blob ol-blob--3" />

      <div className="ol-card">
        {/* Orb */}
        <div className="ol-orb">
          <div className="ol-orb__ring ol-orb__ring--1" />
          <div className="ol-orb__ring ol-orb__ring--2" />
          <div className="ol-orb__ring ol-orb__ring--3" />
          <div className="ol-orb__core">
            <span className="ol-orb__emoji">🎓</span>
          </div>
        </div>

        {/* Text */}
        <div className="ol-text">
          <h1 className="ol-text__title">
            ¡Bienvenido{first ? `, ${first}` : ''}!
          </h1>
          <p className="ol-text__sub">
            Vamos a descubrir tu estilo cognitivo único
          </p>
        </div>

        {/* Steps */}
        <div className="ol-steps">
          {STEPS.map((s, i) => (
            <div key={i} className={`ol-step ${i <= step ? 'ol-step--active' : ''}`}
              style={{ transitionDelay: `${i * 0.12}s` }}>
              <div className="ol-step__dot">
                {i <= step ? <span className="ol-step__check">✓</span> : null}
              </div>
              <span className="ol-step__icon">{s.icon}</span>
              <span className="ol-step__label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Bar */}
        <div className="ol-bar">
          <div className="ol-bar__fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}