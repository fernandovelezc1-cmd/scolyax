import React, { useState, useEffect, useRef } from 'react'
import Sticker from './Stickers'
import './ToolSelector.css'

const STUDY_METHODS = {
  pomodoro: { name: 'Pomodoro', icon: 'tomato', short: '25 min sprints' },
  flowtime:  { name: 'Flowtime',  icon: 'wave',  short: 'Flujo libre'    },
  '5217':    { name: '52/17',     icon: 'bolt',  short: '52 min bloques'  }
}

const TOOLS = [
  { id: 'home',         name: 'Inicio',       icon: 'home',     color: '#c9d62f', colorDark: '#c9d62f', desc: 'Tu panel principal con resumen en vivo',             benefit: 'Vista rápida de toda tu actividad' },
  { id: 'tasks',        name: 'Tareas',        icon: 'check',    color: '#a9b71a', colorDark: '#a9b71a', desc: 'Organiza y prioriza tus actividades',                benefit: 'Gestión visual de pendientes' },
  { id: 'timer',        name: 'Focus',         icon: 'flow',     color: '#3b82f6', colorDark: '#60a5fa', desc: 'Pomodoro · Flowtime · 52/17',                       benefit: '3 métodos de estudio en uno', subIcons: ['tomato','wave','bolt'] },
  { id: 'reminders',    name: 'Recordatorios', icon: 'clock',    color: '#f59e0b', colorDark: '#fbbf24', desc: 'Nunca olvides tus compromisos',                      benefit: 'Alertas inteligentes' },
  { id: 'schedule',     name: 'Horario',       icon: 'calendar', color: '#0ea5e9', colorDark: '#38bdf8', desc: 'Planifica tu semana visualmente',                    benefit: 'Vista semanal con bloques' },
  { id: 'summary',      name: 'Iris IA',       icon: 'robot',    color: '#a9b71a', colorDark: '#a9b71a', desc: 'Tu asistente académico con inteligencia artificial', benefit: 'Resúmenes y análisis al instante' },
  { id: 'achievements', name: 'Logros',        icon: 'trophy',   color: '#f97316', colorDark: '#fb923c', desc: 'Sigue tu progreso y mantén la motivación',           benefit: 'Desbloquea recompensas' },
  { id: 'crisis',       name: 'Modo Crisis',   icon: 'sos',      color: '#a9b71a', colorDark: '#dde77a', desc: 'Respira, descompón tareas y avanza',                 benefit: 'Para cuando todo se siente mucho' }
]

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7c3a']

export default function ToolSelector({
  userName,
  recommendedTools: propRecommendedTools,
  recommendedStudyMethod: propStudyMethod,
  onSelectTool,
  isDark: isDarkProp
}) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [chosen, setChosen]   = useState(null)
  const [isDark, setIsDark]   = useState(() => isDarkProp ?? false)
  const canvasRef             = useRef(null)

  const recommendedTools = (() => {
    if (propRecommendedTools && propRecommendedTools.length > 0) return propRecommendedTools
    try {
      const s = window.localStorage.getItem('scolyax.onboarding.recommendedTools')
      const p = s ? JSON.parse(s) : []
      return Array.isArray(p) ? p : []
    } catch { return [] }
  })()

  const studyMethodKey = propStudyMethod ||
    window.localStorage.getItem('scolyax.onboarding.recommendedStudyMethod') || 'pomodoro'
  const studyMethod = STUDY_METHODS[studyMethodKey] || STUDY_METHODS.pomodoro

  const recIds       = recommendedTools.filter(id => TOOLS.find(t => t.id === id))
  const otherIds     = TOOLS.map(t => t.id).filter(id => !recIds.includes(id))
  const orderedTools = [
    ...recIds.map(id => TOOLS.find(t => t.id === id)),
    ...otherIds.map(id => TOOLS.find(t => t.id === id))
  ].filter(Boolean)

  useEffect(() => {
    if (isDarkProp !== undefined) { setIsDark(isDarkProp); return }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mq.matches)
    const h = (e) => setIsDark(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [isDarkProp])

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    let w, h, stars

    const resize = () => {
      w = canvas.width  = canvas.offsetWidth
      h = canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const COUNT = isDark ? 90 : 50
    stars = Array.from({ length: COUNT }, () => ({
      x: Math.random() * (w || 1000),
      y: Math.random() * (h || 700),
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      alpha: Math.random() * 0.5 + 0.2
    }))

    const LINE_DIST = 130
    const starColor = isDark ? '45,212,191' : '14,165,164'

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      stars.forEach(s => {
        s.x += s.vx; s.y += s.vy
        if (s.x < 0) s.x = w; if (s.x > w) s.x = 0
        if (s.y < 0) s.y = h; if (s.y > h) s.y = 0
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${starColor},${s.alpha})`
        ctx.fill()
      })
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x
          const dy = stars[i].y - stars[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < LINE_DIST) {
            ctx.beginPath()
            ctx.moveTo(stars[i].x, stars[i].y)
            ctx.lineTo(stars[j].x, stars[j].y)
            ctx.strokeStyle = `rgba(${starColor},${0.07 * (1 - d / LINE_DIST)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [isDark])

  const handleSelect = (toolId) => {
    if (chosen) return
    setChosen(toolId)
    setExiting(true)
    setTimeout(() => onSelectTool(toolId), 650)
  }

  const firstName = (userName || 'Usuario').split(' ')[0]
  const hasRecs   = recIds.length > 0
  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? '¡Buenos días' : hour < 18 ? '¡Buenas tardes' : '¡Buenas noches'
  const timeIcon  = (hour >= 6 && hour < 18) ? 'sun' : 'moon'

  return (
    <div className={`tsx ${exiting ? 'tsx--out' : visible ? 'tsx--in' : ''}`}>
      <div className="tsx__shell">
        {/* Header */}
        <header className="tsx__head">
          <span className="tsx__greeting"><Sticker name={timeIcon} size={16} /> {greeting}, {firstName}!</span>
          <h1 className="tsx__title">¿Por dónde quieres empezar?</h1>
          <p className="tsx__sub">Elige una herramienta para entrar. Podrás cambiar cuando quieras desde el menú.</p>
        </header>

        {/* Recomendadas — podio destacado */}
        {hasRecs && (
          <section className="tsx__featured">
            <div className="tsx__featured-head">
              <span className="tsx__featured-badge">✦ Iris recomienda para ti</span>
              <span className="tsx__featured-note">Según tu perfil del test</span>
            </div>
            <div className="tsx__podium">
              {recIds.slice(0, 3).map((id, i) => {
                const t = TOOLS.find(x => x.id === id)
                if (!t) return null
                const color = isDark ? t.colorDark : t.color
                return (
                  <button
                    key={id}
                    className={`tsx__rec tsx__rec--${i} ${chosen === id ? 'is-chosen' : ''}`}
                    style={{ '--c': color }}
                    onClick={() => handleSelect(id)}
                    disabled={!!chosen}
                  >
                    <span className="tsx__rec-medal"><Sticker name="medal" size={22} /></span>
                    <span className="tsx__rec-icon"><Sticker name={t.subIcons ? t.subIcons[0] : t.icon} size={34} /></span>
                    <span className="tsx__rec-name">{id === 'timer' ? `Focus · ${studyMethod.name}` : t.name}</span>
                    <span className="tsx__rec-benefit">{id === 'timer' ? studyMethod.short : t.benefit}</span>
                    <span className="tsx__rec-go">{chosen === id ? '✓ Abriendo…' : 'Abrir →'}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Todas las herramientas */}
        <section className="tsx__all">
          <h2 className="tsx__all-title">{hasRecs ? 'Todas las herramientas' : 'Elige tu herramienta de inicio'}</h2>
          <div className="tsx__grid">
            {orderedTools.map((tool) => {
              const isRec = recIds.includes(tool.id)
              const isChosen = chosen === tool.id
              const color = isDark ? tool.colorDark : tool.color
              return (
                <button
                  key={tool.id}
                  className={`tsx__card ${isChosen ? 'is-chosen' : ''}`}
                  style={{ '--c': color }}
                  onClick={() => handleSelect(tool.id)}
                  disabled={!!chosen}
                >
                  {isRec && <span className="tsx__card-star" title="Recomendada">★</span>}
                  <span className="tsx__card-icon">
                    {tool.subIcons
                      ? tool.subIcons.map((ic, i) => <Sticker key={i} name={ic} size={26} />)
                      : <Sticker name={tool.icon} size={34} />}
                  </span>
                  <span className="tsx__card-name">{tool.id === 'timer' ? 'Focus' : tool.name}</span>
                  <span className="tsx__card-desc">{tool.id === 'timer' ? studyMethod.short : tool.desc}</span>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}