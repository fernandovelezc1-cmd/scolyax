/**
 * IrisResults – Pantalla de resultados después del test cognitivo
 *
 * Iris analiza las respuestas del test y muestra:
 * 1. Perfil de aprendizaje personalizado
 * 2. Áreas de mejora (3 consejos)
 * 3. Plan de estudio semanal (guardado en localStorage)
 * 4. Botón animado para ir a las herramientas recomendadas
 *
 * Se muestra UNA SOLA VEZ después de completar el test cognitivo.
 */
import React, { useEffect, useState, useRef } from 'react'
import Sticker from './Stickers'
import './IrisResults.css'

// ── Genera el análisis del perfil a partir de las respuestas ──────────────────
function generateStudyPlan(studyMethod) {
  const methods = {
    timer_pomodoro: { label: 'Pomodoro', work: 25, rest: 5, description: '25 min de enfoque + 5 min de descanso' },
    timer_flowtime: { label: 'Flow Time', work: 45, rest: 10, description: 'Trabaja mientras fluyes, descansa cuando lo necesites' },
    timer_5217: { label: '52/17', work: 52, rest: 17, description: '52 min de trabajo profundo + 17 min de recuperación' },
  }
  const m = methods[studyMethod] || methods['timer_pomodoro']

  return {
    method: m.label,
    methodDescription: m.description,
    workMinutes: m.work,
    restMinutes: m.rest,
    week: [
      { day: 'Lunes', focus: 'Organiza tus tareas de la semana', icon: 'folder' },
      { day: 'Martes', focus: 'Primera sesión de estudio profundo', icon: 'flow' },
      { day: 'Miércoles', focus: 'Revisa y consolida lo aprendido', icon: 'repeat' },
      { day: 'Jueves', focus: 'Avanza en la tarea más difícil', icon: 'bolt' },
      { day: 'Viernes', focus: 'Resumen semanal + planifica la próxima', icon: 'check' },
    ],
  }
}

function generateAnalysis(answers = [], recommendedTools = [], studyMethod = '') {
  // Contar frecuencia de herramientas seleccionadas
  const freq = {}
  answers.forEach(a => {
    ;(a.tools || []).forEach(t => { freq[t] = (freq[t] || 0) + 1 })
  })

  // Determinar perfil y áreas de mejora
  const tips = []
  let learningStyle = 'equilibrado y adaptable'
  let orientationText = 'Tu perfil muestra flexibilidad y capacidad de adaptación.'

  const highPomodoro = (freq['timer_pomodoro'] || 0) >= 3
  const highFlowtime = (freq['timer_flowtime'] || 0) >= 3
  const high5217 = (freq['timer_5217'] || 0) >= 3
  const highTasks = (freq['tasks'] || 0) >= 2
  const highReminders = (freq['reminders'] || 0) >= 2
  const highSummary = (freq['summary'] || 0) >= 2
  const highSchedule = (freq['schedule'] || 0) >= 2

  if (highPomodoro) {
    learningStyle = 'de sprints cortos con descansos frecuentes'
    orientationText = 'Rindes mejor en períodos cortos e intensos. Los descansos regulares son clave para ti.'
    tips.push('Usa el temporizador Pomodoro para dividir el estudio en bloques de 25 minutos.')
    tips.push('Elimina notificaciones del teléfono durante cada sprint de enfoque.')
  }
  if (highFlowtime) {
    learningStyle = 'de flujo libre y concentración profunda'
    orientationText = 'Necesitas largos períodos de inmersión sin interrupciones externas.'
    tips.push('Reserva bloques de tiempo ininterrumpido de al menos 45 minutos.')
    tips.push('Crea un ritual de inicio (música, ambiente, agua) para entrar en modo flow más rápido.')
  }
  if (high5217) {
    learningStyle = 'de trabajo profundo con recuperación estratégica'
    orientationText = 'Tu cerebro funciona óptimamente con ciclos largos de trabajo y descanso activo.'
    tips.push('Usa la técnica 52/17: 52 min de trabajo + 17 min de recuperación activa.')
    tips.push('Durante los 17 minutos, camina o haz algo que no requiera pantalla.')
  }
  if (highTasks || highSchedule) {
    tips.push('Crea tu lista de tareas cada noche para el día siguiente con máximo 3 prioridades.')
  }
  if (highReminders) {
    tips.push('Configura recordatorios 15 minutos antes de cada actividad importante.')
  }
  if (highSummary) {
    tips.push('Al terminar cada sesión, escribe 3 ideas clave de lo que aprendiste.')
  }

  // Garantizar exactamente 3 tips
  const defaultTips = [
    'Estudia en el mismo lugar siempre para crear un hábito de concentración.',
    'Toma descansos activos: estira, hidrate, camina 2 minutos entre bloques.',
    'Celebra cada avance, aunque sea pequeño — el progreso constante suma.',
  ]
  while (tips.length < 3) tips.push(defaultTips[tips.length])
  const finalTips = tips.slice(0, 3)

  return {
    learningStyle,
    orientationText,
    tips: finalTips,
    studyPlan: generateStudyPlan(studyMethod),
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function IrisResults({ answers = [], recommendedTools = [], studyMethod = '', userName = 'Estudiante', onContinue }) {
  const firstName = (userName || '').split(' ')[0] || 'Estudiante'
  const [visible, setVisible] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const pulseRef = useRef(null)

  // Generar análisis y guardar plan en localStorage al montar
  useEffect(() => {
    const result = generateAnalysis(answers, recommendedTools, studyMethod)
    setAnalysis(result)

    // Guardar plan de estudio en localStorage para que CrisisMode pueda accederlo
    try {
      window.localStorage.setItem(
        'scolyax.iris.studyPlan',
        JSON.stringify({
          ...result.studyPlan,
          learningStyle: result.learningStyle,
          tips: result.tips,
          generatedAt: new Date().toISOString(),
        })
      )
      window.localStorage.setItem('scolyax.iris.resultsShown', 'true')
    } catch (e) { /* silenciar errores de localStorage */ }

    // Animación de entrada
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Iniciar pulso del botón después de 1.5 s
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setPulsing(true), 1500)
    return () => clearTimeout(t)
  }, [visible])

  const handleContinue = () => {
    setVisible(false)
    setTimeout(() => onContinue?.(), 400)
  }

  if (!analysis) return null

  const { learningStyle, orientationText, tips, studyPlan } = analysis

  return (
    <div className={`srx ${visible ? 'srx--in' : ''}`}>
      <div className="srx__shell">
        {/* Header */}
        <header className="srx__head">
          <div className="srx__badge"><img src="/scolyax-icon.svg" alt="Scolyax" /></div>
          <div>
            <span className="srx__eyebrow">Perfil de estudio · listo</span>
            <h1 className="srx__title">Esto descubrí sobre ti, <span>{firstName}</span></h1>
          </div>
        </header>

        {/* Técnica recomendada — protagonista */}
        <section className="srx__method">
          <div className="srx__method-main">
            <span className="srx__method-tag">Técnica recomendada para ti</span>
            <h2 className="srx__method-name">{studyPlan.method}</h2>
            <p className="srx__method-desc">{studyPlan.methodDescription}</p>
          </div>
          <div className="srx__method-stats">
            <div className="srx__stat"><span className="srx__stat-num">{studyPlan.workMinutes}</span><span className="srx__stat-lbl">min enfoque</span></div>
            <div className="srx__stat-sep" />
            <div className="srx__stat"><span className="srx__stat-num">{studyPlan.restMinutes}</span><span className="srx__stat-lbl">min descanso</span></div>
          </div>
        </section>

        {/* Estilo de aprendizaje */}
        <div className="srx__style">
          <span className="srx__style-emoji"><Sticker name="mind" size={28} /></span>
          <div>
            <span className="srx__style-label">Aprendiz {learningStyle}</span>
            <p className="srx__style-text">{orientationText}</p>
          </div>
        </div>

        <div className="srx__cols">
          {/* Semana como timeline */}
          <section className="srx__block">
            <h3 className="srx__block-title"><Sticker name="calendar" size={18} /> Tu semana, paso a paso</h3>
            <div className="srx__week">
              {studyPlan.week.map((day, i) => (
                <div key={i} className="srx__day">
                  <div className="srx__day-rail">
                    <span className="srx__day-dot"><Sticker name={day.icon} size={20} /></span>
                    {i < studyPlan.week.length - 1 && <span className="srx__day-line" />}
                  </div>
                  <div className="srx__day-card">
                    <span className="srx__day-name">{day.day}</span>
                    <span className="srx__day-focus">{day.focus}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Consejos como tarjetas */}
          <section className="srx__block">
            <h3 className="srx__block-title"><Sticker name="bulb" size={18} /> 3 consejos a tu medida</h3>
            <div className="srx__tips">
              {tips.map((tip, i) => (
                <div key={i} className="srx__tip">
                  <span className="srx__tip-num">{i + 1}</span>
                  <p className="srx__tip-text">{tip}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* CTA */}
        <div className="srx__cta">
          <p className="srx__cta-hint">Tu plan queda guardado — podrás verlo en Modo Crisis cuando lo necesites.</p>
          <button
            ref={pulseRef}
            className={`srx__cta-btn ${pulsing ? 'srx__cta-btn--pulse' : ''}`}
            onClick={handleContinue}
          >
            Ver mis herramientas recomendadas
            <span className="srx__cta-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
