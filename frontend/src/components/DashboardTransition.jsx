import React, { useEffect, useState, useRef } from 'react'
import Sticker from './Stickers'
import './DashboardTransition.css'

export default function DashboardTransition({ userName, toolName, toolIcon, isDark: isDarkProp }) {
  const [isDark, setIsDark] = useState(() => isDarkProp ?? false)
  const [progress, setProgress] = useState(0)
  const canvasRef = useRef(null)

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

  // Progress 0 → 100 over 1.3s
  useEffect(() => {
    let p = 0
    const tick = setInterval(() => {
      p += Math.random() * 12 + 6
      if (p >= 100) { p = 100; clearInterval(tick) }
      setProgress(Math.min(p, 100))
    }, 90)
    return () => clearInterval(tick)
  }, [])

  // Canvas constellation
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
    const COUNT = 50
    const color = isDark ? '180,180,255' : '99,102,241'
    const pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * 1400, y: Math.random() * 900,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.13, vy: (Math.random() - 0.5) * 0.13,
      a: Math.random() * 0.4 + 0.12
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
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 110) {
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = `rgba(${color},${0.055 * (1 - d / 110)})`
            ctx.lineWidth = 0.5; ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [isDark])

  const firstName = userName?.split(' ')[0] || 'estudiante'

  return (
    <div className={`dt-root ${isDark ? 'dt-dark' : 'dt-light'}`}>
      <canvas ref={canvasRef} className="dt-canvas" aria-hidden="true" />

      <div className="dt-blob dt-blob--1" />
      <div className="dt-blob dt-blob--2" />
      <div className="dt-blob dt-blob--3" />

      <div className="dt-card">
        {/* Orb */}
        <div className="dt-orb">
          <div className="dt-orb__ring dt-orb__ring--1" />
          <div className="dt-orb__ring dt-orb__ring--2" />
          <div className="dt-orb__core">
            <span className="dt-orb__emoji"><Sticker name={toolIcon || 'rocket'} size={46} /></span>
          </div>
        </div>

        {/* Text */}
        <div className="dt-text">
          <h2 className="dt-text__title">Abriendo {toolName || 'Dashboard'}</h2>
          <p className="dt-text__sub">¡Tu espacio está listo, {firstName}!</p>
        </div>

        {/* Progress */}
        <div className="dt-progress">
          <div className="dt-progress__track">
            <div className="dt-progress__fill" style={{ width: `${progress}%` }}>
              <div className="dt-progress__glow" />
            </div>
          </div>
          <div className="dt-progress__pct">{Math.round(progress)}%</div>
        </div>

        {/* Dots */}
        <div className="dt-dots" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <span key={i} className="dt-dots__dot" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    </div>
  )
}