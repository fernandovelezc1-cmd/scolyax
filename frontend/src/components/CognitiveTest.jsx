import React, { useState } from 'react'
import Sticker from './Stickers'
import './CognitiveTest.css'

const QUESTIONS = [
  // === PREGUNTAS GENERALES (perfil de herramientas) ===
  {
    id: 1,
    iris: '¿Cómo te sientes al organizar tus actividades del día?',
    options: [
      { text: 'Me cuesta priorizar, todo parece urgente', tools: ['tasks', 'reminders'] },
      { text: 'Me va bien si tengo bloques de tiempo fijos', tools: ['timer_5217', 'schedule'] },
      { text: 'Prefiero algo flexible que se adapte a mi ritmo', tools: ['timer_flowtime', 'summary'] }
    ]
  },
  {
    id: 2,
    iris: '¿Qué te distrae más cuando estudias o trabajas?',
    options: [
      { text: 'Me cuesta mantener la atención más de 20 minutos', tools: ['timer_pomodoro', 'timer_pomodoro'] },
      { text: 'Olvido lo que tenía que hacer a continuación', tools: ['reminders', 'schedule'] },
      { text: 'Me satura la cantidad de información', tools: ['summary', 'tasks'] }
    ]
  },
  {
    id: 3,
    iris: '¿Qué tipo de sesión de estudio te funciona mejor?',
    options: [
      { text: 'Sesiones cortas con pausas frecuentes', tools: ['timer_pomodoro', 'timer_pomodoro'] },
      { text: 'Seguir un horario visual con bloques claros', tools: ['schedule', 'tasks'] },
      { text: 'Con recordatorios que me mantengan enfocado/a', tools: ['reminders', 'tasks'] }
    ]
  },
  {
    id: 4,
    iris: '¿Cómo procesas mejor la información nueva?',
    options: [
      { text: 'Necesito ver resúmenes y esquemas visuales', tools: ['summary', 'tasks'] },
      { text: 'Me ayuda escuchar y repetir en voz alta', tools: ['summary', 'reminders'] },
      { text: 'Aprendo mejor si lo hago de forma práctica', tools: ['timer_flowtime', 'timer_flowtime'] }
    ]
  },
  {
    id: 5,
    iris: '¿Qué te motiva a seguir estudiando?',
    options: [
      { text: 'Ver mi racha y logros, me engancha como un juego', tools: ['achievements', 'crisis'] },
      { text: 'Sentir que avanzo al completar mi lista del día', tools: ['tasks', 'schedule'] },
      { text: 'Mejorar mi capacidad de concentración real', tools: ['timer_5217', 'timer_5217'] }
    ]
  },
  {
    id: 6,
    iris: '¿Qué problema te gustaría resolver primero?',
    options: [
      { text: 'Organizar mis pendientes y no olvidar entregas', tools: ['tasks', 'reminders'] },
      { text: 'Estudiar de forma más eficiente sin agotarme', tools: ['timer_pomodoro', 'timer_5217'] },
      { text: 'Entender mejor textos largos y contenido complejo', tools: ['summary', 'tasks'] }
    ]
  },
  // === PREGUNTAS DE PERFIL COGNITIVO (diferenciación Study Flow) ===
  {
    id: 7,
    iris: '¿Cuánto tiempo puedes mantener la concentración sin un descanso?',
    options: [
      { text: 'Menos de 25 minutos, necesito pausas frecuentes', tools: ['timer_pomodoro', 'timer_pomodoro'] },
      { text: 'Depende del tema — a veces me sumerjo por horas', tools: ['timer_flowtime', 'timer_flowtime'] },
      { text: 'Alrededor de 45-60 minutos con un buen descanso después', tools: ['timer_5217', 'timer_5217'] }
    ]
  },
  {
    id: 8,
    iris: '¿Cómo prefieres tomar tus descansos al estudiar?',
    options: [
      { text: 'Pausas cortas y frecuentes (cada 25 minutos)', tools: ['timer_pomodoro', 'timer_pomodoro'] },
      { text: 'Descanso cuando siento que lo necesito, sin reloj', tools: ['timer_flowtime', 'timer_flowtime'] },
      { text: 'Descansos más largos pero menos frecuentes (cada hora)', tools: ['timer_5217', 'timer_5217'] }
    ]
  },
  {
    id: 9,
    iris: '¿Qué pasa cuando estás muy concentrado/a en algo?',
    options: [
      { text: 'Es raro que me pase, me distraigo fácilmente', tools: ['timer_pomodoro', 'reminders'] },
      { text: 'Me molesta que me interrumpan, quiero seguir en flow', tools: ['timer_flowtime', 'timer_flowtime'] },
      { text: 'Puedo mantenerlo un buen rato si sé que viene un descanso', tools: ['timer_5217', 'timer_5217'] }
    ]
  },
  {
    id: 10,
    iris: '¿Cómo divides una tarea grande o un proyecto largo?',
    options: [
      { text: 'En micro-tareas que puedo completar en pocos minutos', tools: ['timer_pomodoro', 'tasks'] },
      { text: 'Me sumerjo hasta donde pueda y luego descanso', tools: ['timer_flowtime', 'timer_flowtime'] },
      { text: 'En bloques de trabajo de casi una hora con descansos planificados', tools: ['timer_5217', 'schedule'] }
    ]
  },
  {
    id: 11,
    iris: '¿Qué ritmo de trabajo te describe mejor?',
    options: [
      { text: 'Sprint corto → pausa → sprint → pausa (constante)', tools: ['timer_pomodoro', 'timer_pomodoro'] },
      { text: 'Flujo libre: trabajo mientras estoy inspirado/a', tools: ['timer_flowtime', 'timer_flowtime'] },
      { text: 'Maratón controlado: bloques largos con recuperación', tools: ['timer_5217', 'timer_5217'] }
    ]
  },
  {
    id: 12,
    iris: '¿Cómo te sientes cuando suena un temporizador mientras estudias?',
    options: [
      { text: 'Aliviado/a — necesitaba esa pausa', tools: ['timer_pomodoro', 'timer_pomodoro'] },
      { text: 'Frustrado/a — prefiero decidir yo cuándo parar', tools: ['timer_flowtime', 'timer_flowtime'] },
      { text: 'Bien, si sucede después de un buen rato de trabajo', tools: ['timer_5217', 'timer_5217'] }
    ]
  }
]

export default function CognitiveTest({ onComplete, userName, isDark = false }) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState([])
  const [selectedOption, setSelectedOption] = useState(null)
  const [isAnimating, setIsAnimating] = useState(false)

  const handleAnswer = (option) => {
    setSelectedOption(option)
    
    setTimeout(() => {
      setIsAnimating(true)
      
      setTimeout(() => {
        const newAnswers = [...answers, option]
        setAnswers(newAnswers)
        
        if (currentQuestion < QUESTIONS.length - 1) {
          setCurrentQuestion(currentQuestion + 1)
          setSelectedOption(null)
          setIsAnimating(false)
        } else {
          // Calcular puntuación por herramienta (incluye timer_pomodoro, timer_flowtime, timer_5217)
          const toolScores = {}
          newAnswers.forEach(answer => {
            answer.tools.forEach(tool => {
              toolScores[tool] = (toolScores[tool] || 0) + 1
            })
          })
          
          // Calcular puntuación de cada método de Study Flow
          const timerPomodoro = toolScores['timer_pomodoro'] || 0
          const timerFlowtime = toolScores['timer_flowtime'] || 0
          const timer5217 = toolScores['timer_5217'] || 0
          
          // Determinar qué método de Study Flow recomienda Iris
          let recommendedStudyMethod = 'pomodoro' // default
          if (timerFlowtime >= timerPomodoro && timerFlowtime >= timer5217) {
            recommendedStudyMethod = 'flowtime'
          } else if (timer5217 >= timerPomodoro && timer5217 >= timerFlowtime) {
            recommendedStudyMethod = '5217'
          }
          
          // Mergear timer_* en un solo 'timer' para la recomendación general
          const generalScores = {}
          Object.entries(toolScores).forEach(([tool, score]) => {
            if (tool.startsWith('timer_')) {
              generalScores['timer'] = (generalScores['timer'] || 0) + score
            } else {
              generalScores[tool] = score
            }
          })
          
          // Obtener top 3 herramientas generales
          const recommended = Object.entries(generalScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([tool]) => tool)
          
          onComplete(recommended, recommendedStudyMethod, newAnswers)
        }
      }, 300)
    }, 500)
  }

  const total = QUESTIONS.length
  const progress = ((currentQuestion + 1) / total) * 100
  const firstName = (userName || 'Usuario').split(' ')[0]
  const q = QUESTIONS[currentQuestion]

  return (
    <div className="ct">
      <div className="ct__shell">
        {/* Left rail — Iris + malla de progreso */}
        <aside className="ct__rail">
          <div className="ct__brand">
            <img className="ct__brand-mark" src="/scolyax-icon.svg" alt="Scolyax" />
            <span className="ct__brand-name">Scolyax</span>
          </div>

          <div className="ct__intro">
            <h1 className="ct__intro-title">Iris quiere conocerte</h1>
            <p className="ct__intro-sub">
              {firstName}, responde para recomendarte las herramientas ideales para tu forma de estudiar.
            </p>
          </div>

          <ol className="ct__steps" aria-hidden="true">
            {QUESTIONS.map((item, i) => (
              <li
                key={item.id}
                className={`ct__step ${i < currentQuestion ? 'is-done' : ''} ${i === currentQuestion ? 'is-current' : ''}`}
              >
                <span className="ct__step-dot">{i < currentQuestion ? '✓' : i + 1}</span>
              </li>
            ))}
          </ol>

          <div className="ct__rail-foot">
            <div className="ct__count">Pregunta {currentQuestion + 1} <span>/ {total}</span></div>
            <div className="ct__bar"><div className="ct__bar-fill" style={{ width: `${progress}%` }} /></div>
          </div>
        </aside>

        {/* Right — pregunta actual */}
        <main className={`ct__main ${isAnimating ? 'is-leaving' : ''}`}>
          <span className="ct__q-index">Pregunta {currentQuestion + 1} de {total}</span>
          <h2 className="ct__question">{q.iris}</h2>

          <div className="ct__options">
            {q.options.map((option, index) => (
              <button
                key={index}
                className={`ct__option ${selectedOption === option ? 'is-selected' : ''}`}
                onClick={() => handleAnswer(option)}
                disabled={selectedOption !== null}
              >
                <span className="ct__option-badge">{String.fromCharCode(65 + index)}</span>
                <span className="ct__option-text">{option.text}</span>
                <span className="ct__option-mark">{selectedOption === option ? '✓' : ''}</span>
              </button>
            ))}
          </div>

          <p className="ct__hint"><Sticker name="bulb" size={15} /> No hay respuestas correctas ni incorrectas — solo quiero entender cómo estudias mejor.</p>
        </main>
      </div>
    </div>
  )
}
