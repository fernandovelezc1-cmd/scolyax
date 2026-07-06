/**
 * LandingPage — Scolyax (dark glass / neon)
 */
import React from 'react'
import Sticker from './Stickers'
import './LandingPage.css'

const FEATURES = [
  { icon: 'robot', title: 'Iris IA', desc: 'Chat con IA, resúmenes de PDF/DOCX, análisis de sentimiento y generación de contenido.' },
  { icon: 'flow', title: 'Focus', desc: '3 técnicas: Pomodoro, Flowtime y 52/17 con checkpoints IA anti-trampas.' },
  { icon: 'sos', title: 'Modo Crisis', desc: 'Respiración guiada 4-7-8 y descomposición de tareas en micro-pasos cuando te bloqueas.' },
  { icon: 'target', title: 'Gestión de Tareas', desc: 'Tareas con prioridad, estimación IA de pomodoros y fechas límite.' },
  { icon: 'calendar', title: 'Calendario Multi-Vista', desc: 'Agenda, día, 3 días, semana y mes con integración Google Calendar.' },
  { icon: 'bell', title: 'Notificaciones Push', desc: 'Push al móvil, email y alarmas programadas: el día antes y 10 min antes.' },
  { icon: 'trophy', title: 'Gamificación', desc: 'XP, 6 niveles, 10+ logros, rachas con celebraciones y retos diarios.' },
  { icon: 'battery', title: 'Diario de Energía', desc: 'Registra tu nivel de energía y ánimo después de cada sesión de estudio.' },
  { icon: 'compass', title: 'Test Cognitivo VARK', desc: 'Perfil de aprendizaje personalizado que adapta las herramientas a tu estilo.' },
]

const STATS = [
  { value: '40%', label: 'Estudio enfocado' },
  { value: '25%', label: 'Tareas académicas' },
  { value: '20%', label: 'Descansos' },
  { value: '15%', label: 'Extra' },
]

export default function LandingPage({ onGetStarted }) {
  const scrollToFeatures = () => document.getElementById('sx-features')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="sx-land">
      <div className="sx-land__inner">
        {/* Nav */}
        <header className="sx-nav">
          <div className="sx-brand">
            <img className="sx-brand__mark" src="/scolyax-icon.svg" alt="Scolyax" />
            <span className="sx-brand__name">Scolyax</span>
          </div>
          <button type="button" className="sx-nav__cta" onClick={onGetStarted}>Iniciar sesión</button>
        </header>

        {/* Hero */}
        <section className="sx-hero">
          <div>
            <span className="sx-badge"><Sticker name="spark" size={15} /> Nueva versión 2.0 · más enfoque, menos caos</span>
            <h1 className="sx-hero__title">
              Tu sistema operativo para <span>estudiar con foco</span> y avanzar
            </h1>
            <p className="sx-hero__desc">
              Scolyax reúne IA conversacional (Iris), técnicas de estudio adaptativas, modo crisis con
              respiración guiada, gamificación y notificaciones push — pensado para mentes neurodivergentes.
            </p>
            <div className="sx-cta-row">
              <button type="button" className="sx-btn sx-btn--primary" onClick={onGetStarted}>
                Comenzar gratis <span className="sx-arrow">→</span>
              </button>
              <button type="button" className="sx-btn sx-btn--ghost" onClick={scrollToFeatures}>
                Ver características
              </button>
            </div>
            <div className="sx-stats">
              {STATS.map((s) => (
                <div key={s.label} className="sx-stat">
                  <div className="sx-stat__value">{s.value}</div>
                  <div className="sx-stat__label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mockup */}
          <div className="sx-mock">
            <div className="sx-mock__bar"><i></i><i></i><i></i></div>
            <div className="sx-mock__row">
              <div className="sx-mock__check">✓</div>
              <div className="sx-mock__txt">Estudiar Cálculo</div>
              <div className="sx-mock__xp">+10 XP</div>
            </div>
            <div className="sx-mock__row">
              <div className="sx-mock__check sx-mock__check--empty"></div>
              <div className="sx-mock__txt">Proyecto de Física</div>
            </div>
            <div className="sx-mock__row">
              <div className="sx-mock__check sx-mock__check--empty"></div>
              <div className="sx-mock__txt">Resumen de Historia</div>
            </div>
            <div className="sx-mock__streak"><Sticker name="flame" size={16} /> 12 días de racha activa</div>
          </div>
        </section>

        {/* Features */}
        <section id="sx-features" className="sx-section">
          <div className="sx-section__head">
            <h2 className="sx-section__title">Todo lo que necesitas para <span>rendir más</span></h2>
            <p className="sx-section__sub">Herramientas diseñadas para estudiantes que buscan excelencia académica.</p>
          </div>
          <div className="sx-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="sx-feat">
                <div className="sx-feat__icon"><Sticker name={f.icon} size={28} /></div>
                <h3 className="sx-feat__title">{f.title}</h3>
                <p className="sx-feat__desc">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="sx-cta">
          <h2 className="sx-cta__title">¿Listo para transformar tu productividad?</h2>
          <p className="sx-cta__sub">Únete a estudiantes que ya alcanzan sus metas con Scolyax.</p>
          <button type="button" className="sx-btn sx-btn--primary" onClick={onGetStarted}>
            Comenzar ahora — es gratis <Sticker name="rocket" size={17} />
          </button>
        </section>

        {/* Footer */}
        <footer>
          <div className="sx-foot">
            <div className="sx-brand">
              <img className="sx-brand__mark" src="/scolyax-icon.svg" alt="Scolyax" />
              <div>
                <span className="sx-brand__name">Scolyax</span>
                <p className="sx-foot__tag">Tu compañero de estudios definitivo</p>
              </div>
            </div>
            <p className="sx-foot__copy">© {new Date().getFullYear()} Scolyax. Todos los derechos reservados.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
