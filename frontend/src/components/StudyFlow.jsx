/**
 * StudyFlow v2 - Sistema Avanzado de Gestión del Tiempo
 * 3 Métodos: Pomodoro | Flowtime | 52/17
 * Anti-cheat · AI Checkpoints · Monitoreo constante
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import alarmSystem from '../utils/alarmSystem'
import backgroundAlarmSystem from '../utils/backgroundAlarmSystem'
import notificationService from '../services/notificationService'
import Sticker from './Stickers'
import './StudyFlow.css'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

/* ─── Métodos de estudio ─── */
const STUDY_METHODS = [
  {
    id: 'pomodoro',
    name: 'Pomodoro',
    icon: 'tomato',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
    description: 'Sesiones cortas + descansos frecuentes',
    details: '25 min trabajo · 5 min descanso · Ideal para TDAH',
    workMinutes: 25,
    breakMinutes: 5,
    benefit: 'Máxima disciplina',
    tag: 'Popular'
  },
  {
    id: 'flowtime',
    name: 'Flowtime',
    icon: 'wave',
    color: '#c9d62f',
    gradient: 'linear-gradient(135deg, #c9d62f, #0891b2)',
    description: 'Flujo libre hasta que pierdas concentración',
    details: 'Sin límite fijo · Tú decides cuándo parar',
    workMinutes: null, // Flexible - count UP
    breakMinutes: null,
    benefit: 'Máxima flexibilidad',
    tag: 'Adaptativo'
  },
  {
    id: '52-17',
    name: '52/17',
    icon: 'bolt',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    description: '52 min de sprint + 17 min de descanso total',
    details: '52 min estudio intensivo · 17 min descanso largo',
    workMinutes: 52,
    breakMinutes: 17,
    benefit: 'Máxima productividad',
    tag: 'Científico'
  }
]

/* ─── Distraction platforms monitored by the extension ─── */
const DISTRACTION_PLATFORMS = [
  // Streaming
  { id: 'netflix',     name: 'Netflix',       domain: 'netflix.com',        emoji: 'film', category: 'Streaming' },
  { id: 'primevideo',  name: 'Prime Video',   domain: 'primevideo.com',     emoji: 'film', category: 'Streaming' },
  { id: 'disneyplus',  name: 'Disney+',       domain: 'disneyplus.com',     emoji: 'film', category: 'Streaming' },
  { id: 'hbomax',      name: 'HBO Max',        domain: 'hbomax.com',         emoji: 'film', category: 'Streaming' },
  { id: 'max',         name: 'Max',            domain: 'max.com',            emoji: 'film', category: 'Streaming' },
  { id: 'appletv',     name: 'Apple TV+',     domain: 'tv.apple.com',       emoji: 'film', category: 'Streaming' },
  { id: 'paramount',   name: 'Paramount+',    domain: 'paramountplus.com',  emoji: 'film', category: 'Streaming' },
  { id: 'starplus',    name: 'Star+',         domain: 'starplus.com',       emoji: 'film', category: 'Streaming' },
  // Video
  { id: 'youtube',     name: 'YouTube',       domain: 'youtube.com',        emoji: 'tv', category: 'Video' },
  { id: 'dailymotion', name: 'Dailymotion',   domain: 'dailymotion.com',    emoji: 'tv', category: 'Video' },
  { id: 'vimeo',       name: 'Vimeo',         domain: 'vimeo.com',          emoji: 'tv', category: 'Video' },
  // En vivo
  { id: 'twitch',      name: 'Twitch',        domain: 'twitch.tv',          emoji: 'game', category: 'En vivo' },
  { id: 'kick',        name: 'Kick',          domain: 'kick.com',           emoji: 'game', category: 'En vivo' },
  // Música
  { id: 'spotify',     name: 'Spotify',       domain: 'open.spotify.com',   emoji: 'music', category: 'Música' },
  { id: 'deezer',      name: 'Deezer',        domain: 'deezer.com',         emoji: 'music', category: 'Música' },
  { id: 'soundcloud',  name: 'SoundCloud',    domain: 'soundcloud.com',     emoji: 'music', category: 'Música' },
  // Redes sociales
  { id: 'facebook',    name: 'Facebook',      domain: 'facebook.com',       emoji: 'phone', category: 'Redes' },
  { id: 'instagram',   name: 'Instagram',     domain: 'instagram.com',      emoji: 'phone', category: 'Redes' },
  { id: 'tiktok',      name: 'TikTok',        domain: 'tiktok.com',         emoji: 'phone', category: 'Redes' },
  { id: 'twitter',     name: 'X (Twitter)',   domain: 'twitter.com',        emoji: 'phone', category: 'Redes' },
  { id: 'x',           name: 'X.com',         domain: '//x.com',            emoji: 'phone', category: 'Redes' },
  { id: 'snapchat',    name: 'Snapchat',      domain: 'snapchat.com',       emoji: 'phone', category: 'Redes' },
]
const PLATFORM_CATEGORIES = ['Streaming', 'Video', 'En vivo', 'Música', 'Redes']

/* ─── Helpers ─── */
const fmt = (s) => {
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('scolyax.sessionToken')}`,
  'Content-Type': 'application/json'
})

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */
const StudyFlow = ({ onSessionComplete, tasks = [], onTaskUpdate, initialMethod = null }) => {
  // ─── Core states ───
  const [phase, setPhase] = useState('select-task') // select-task | select-method | planning | running | break | checkpoint | completed
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [taskSearch, setTaskSearch] = useState('')

  // ─── Timer states ───
  const [timeRemaining, setTimeRemaining] = useState(null)  // countdown (pomodoro, 52/17)
  const [timeElapsed, setTimeElapsed] = useState(0)          // count-up (flowtime)
  const [isRunning, setIsRunning] = useState(false)
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(null)

  // ─── AI Estimation ───
  const [estimatedTime, setEstimatedTime] = useState(null)
  const [estimateReasoning, setEstimateReasoning] = useState('')
  const [estimateSuggestions, setEstimateSuggestions] = useState([])
  const [recommendedMethod, setRecommendedMethod] = useState(null)
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false)

  // ─── Anti-cheat ───
  const [focusWarnings, setFocusWarnings] = useState(0)
  const [tabSwitchLog, setTabSwitchLog] = useState([])
  const [isPausedByAntiCheat, setIsPausedByAntiCheat] = useState(false)
  const [lastAwaySeconds, setLastAwaySeconds] = useState(0)
  // Platform config (persists across sessions)
  const [enabledPlatforms, setEnabledPlatforms] = useState(
    () => new Set(DISTRACTION_PLATFORMS.map(p => p.id))
  )
  const [showPlatformConfig, setShowPlatformConfig] = useState(false)
  const [extensionDetected, setExtensionDetected] = useState(false)
  const [detectedPlatformName, setDetectedPlatformName] = useState('')

  // ─── Checkpoints ───
  const [checkpointActive, setCheckpointActive] = useState(false)
  const [checkpointResponse, setCheckpointResponse] = useState('')
  const [checkpointCount, setCheckpointCount] = useState(0)
  const [checkpointFeedback, setCheckpointFeedback] = useState(null)
  const [isVerifyingCheckpoint, setIsVerifyingCheckpoint] = useState(false)
  const [checkpointBlocked, setCheckpointBlocked] = useState(false)
  const [checkpointPhoto, setCheckpointPhoto] = useState(null)

  // ─── Session stats ───
  const [sessionPoints, setSessionPoints] = useState(0)
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const [totalFocusTime, setTotalFocusTime] = useState(0)

  // ─── Refs ───
  const intervalRef = useRef(null)
  const breakIntervalRef = useRef(null)
  const checkpointTimerRef = useRef(null)
  const sessionIdRef = useRef(null)
  const photoInputRef = useRef(null)
  const tabHiddenAtRef = useRef(null)
  const awayTimerRef = useRef(null)
  const extensionDetectedRef = useRef(false)
  const enabledPlatformsRef = useRef(enabledPlatforms)

  const selectedTask = tasks.find(t => t.id === selectedTaskId)
  const pendingTasks = tasks.filter(t => t.status !== 'completed')

  // Iris's recommended study method (from onboarding test or initialMethod prop)
  const _SM_MAP = { pomodoro: 'pomodoro', flowtime: 'flowtime', '5217': '52-17' }
  const _irisKey = initialMethod
    ? (_SM_MAP[initialMethod] || initialMethod)
    : (_SM_MAP[localStorage.getItem('scolyax.onboarding.recommendedStudyMethod')] || null)
  const irisRecMethod = _irisKey ? STUDY_METHODS.find(m => m.id === _irisKey) : null

  // ─── Extension session signals ───
  const notifyExtensionSessionStart = useCallback((method) => {
    const blockedDomains = DISTRACTION_PLATFORMS
      .filter(p => enabledPlatformsRef.current.has(p.id))
      .map(p => p.domain)
    window.postMessage({
      source: 'scolyax-app',
      type: 'SESSION_START',
      blockedDomains,
      methodName: method?.name || ''
    }, '*')
  }, [])

  const notifyExtensionSessionEnd = useCallback(() => {
    window.postMessage({ source: 'scolyax-app', type: 'SESSION_END' }, '*')
  }, [])

  // ═══════════════════════════════════════════
  // ANTI-CHEAT: Time-based tab visibility detection
  //   < 15s  → ignored (quick reference check)
  //   15–60s → micro-distraction counter, no pause
  //   > 60s  → full pause + overlay
  // ═══════════════════════════════════════════
  const QUICK_CHECK_MS = 15_000
  const DISTRACTION_MS = 60_000

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isRunning || phase !== 'running') return

      if (document.hidden) {
        // Record departure time and schedule delayed anti-cheat
        tabHiddenAtRef.current = Date.now()
        clearTimeout(awayTimerRef.current)

        awayTimerRef.current = setTimeout(() => {
          if (!document.hidden) return // user came back in time
          const awaySeconds = Math.round((Date.now() - tabHiddenAtRef.current) / 1000)
          const timestamp = new Date().toISOString()
          // Track as long distraction silently (no pause, no modal)
          setFocusWarnings(prev => prev + 1)
          setTabSwitchLog(prev => [...prev, { time: timestamp, type: 'long_distraction', duration_s: awaySeconds }])
        }, DISTRACTION_MS)

      } else {
        // User returned — measure how long they were away
        const awayMs = tabHiddenAtRef.current ? Date.now() - tabHiddenAtRef.current : 0
        clearTimeout(awayTimerRef.current)
        awayTimerRef.current = null
        tabHiddenAtRef.current = null

        if (awayMs >= QUICK_CHECK_MS && awayMs < DISTRACTION_MS) {
          // Micro-distraction: count it but keep session running
          const awaySeconds = Math.round(awayMs / 1000)
          setFocusWarnings(prev => prev + 1)
          setTabSwitchLog(prev => [...prev, { time: new Date().toISOString(), type: 'micro_distraction', duration_s: awaySeconds }])
          notificationService.notify(
            '⚠️ Micro-distracción detectada',
            `Estuviste ${awaySeconds}s fuera. ¡Vuelve a tu tarea!`
          )
        }
        // < QUICK_CHECK_MS: fully ignored
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimeout(awayTimerRef.current)
    }
  }, [isRunning, phase, focusWarnings, selectedTask])

  // ═══════════════════════════════════════════
  // EXTENSION: Keep refs in sync + message bridge
  // ═══════════════════════════════════════════

  // Keep refs up-to-date so extension message handler can read them without stale closures
  useEffect(() => { enabledPlatformsRef.current = enabledPlatforms }, [enabledPlatforms])
  useEffect(() => { extensionDetectedRef.current = extensionDetected }, [extensionDetected])

  // Ping extension on mount so it can announce itself even if already loaded
  useEffect(() => {
    window.postMessage({ source: 'scolyax-app', type: 'SCOLYAX_PING' }, '*')
  }, [])

  // Listen for messages relayed by the content script
  useEffect(() => {
    const handleExtMessage = (event) => {
      if (event.data?.source !== 'scolyax-extension') return

      // Extension announced itself
      if (event.data.type === 'SCOLYAX_EXTENSION_READY') {
        setExtensionDetected(true)
        extensionDetectedRef.current = true
        return
      }

      if (event.data.type !== 'SCOLYAX_TAB_SWITCHED') return
      if (!isRunning || phase !== 'running') return

      const url = event.data.url || ''
      const matched = DISTRACTION_PLATFORMS.find(
        p => enabledPlatformsRef.current.has(p.id) && url.includes(p.domain)
      )

      if (matched) {
        // Blocked platform detected → trigger anti-cheat immediately
        clearTimeout(awayTimerRef.current)
        awayTimerRef.current = null
        setDetectedPlatformName(matched.name)
        setLastAwaySeconds(0)
        setIsRunning(false)
        setIsPausedByAntiCheat(true)
        const timestamp = new Date().toISOString()
        setFocusWarnings(prev => prev + 1)
        setTabSwitchLog(prev => [...prev, {
          time: timestamp, type: 'blocked_platform', platform: matched.id, url
        }])
        alarmSystem.playWarningAlarm()
        notificationService.notify(
          '🚨 ¡Distracción detectada!',
          `Iris detectó actividad en ${matched.name}.`
        )
        fetch(`${API_URL}/ai/focus-alert`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            session_id: sessionIdRef.current,
            event_type: 'blocked_platform',
            timestamp,
            warning_count: focusWarnings + 1,
            task_title: selectedTask?.title || 'Unknown',
            platform: matched.name
          })
        }).catch(() => {})
      } else if (extensionDetectedRef.current) {
        // Extension present + URL is NOT blocked → cancel the fallback timer
        // (user is on a legitimate work tab)
        clearTimeout(awayTimerRef.current)
        awayTimerRef.current = null
        tabHiddenAtRef.current = null
      }
    }

    window.addEventListener('message', handleExtMessage)
    return () => window.removeEventListener('message', handleExtMessage)
  }, [isRunning, phase, focusWarnings, selectedTask])

  // ═══════════════════════════════════════════
  // MAIN TIMER (countdown for pomodoro/52-17, count-up for flowtime)
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (!isRunning || phase !== 'running') return

    intervalRef.current = setInterval(() => {
      if (selectedMethod?.id === 'flowtime') {
        // Count UP
        setTimeElapsed(prev => prev + 1)
        setTotalFocusTime(prev => prev + 1)
      } else {
        // Count DOWN
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current)
            handleWorkComplete()
            return 0
          }
          if (prev === 300) {
            alarmSystem.playWarningAlarm()
            notificationService.notify('⏱️ 5 minutos restantes', '¡Ya casi terminas!')
          }
          setTotalFocusTime(p => p + 1)
          return prev - 1
        })
      }
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [isRunning, phase, selectedMethod])

  // ═══════════════════════════════════════════
  // BREAK TIMER
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (phase !== 'break' || breakTimeRemaining === null || breakTimeRemaining <= 0) return

    breakIntervalRef.current = setInterval(() => {
      setBreakTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(breakIntervalRef.current)
          alarmSystem.playCompletionAlarm()
          notificationService.notify('✅ Descanso terminado', '¡Es hora de volver al trabajo!')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(breakIntervalRef.current)
  }, [phase, breakTimeRemaining])

  // ═══════════════════════════════════════════
  // RANDOM AI CHECKPOINTS
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (!isRunning || phase !== 'running') return

    // Schedule next checkpoint in 8-15 minutes (random)
    const minDelay = 8 * 60 * 1000
    const maxDelay = 15 * 60 * 1000
    const delay = Math.random() * (maxDelay - minDelay) + minDelay

    checkpointTimerRef.current = setTimeout(() => {
      setIsRunning(false)
      setCheckpointActive(true)
      setPhase('checkpoint')
      alarmSystem.playWarningAlarm()
      notificationService.notify('🎓 Checkpoint de Iris', 'Demuestra tu progreso para continuar')
    }, delay)

    return () => clearTimeout(checkpointTimerRef.current)
  }, [isRunning, phase, checkpointCount])

  // ═══════════════════════════════════════════
  // AI ESTIMATE + METHOD RECOMMENDATION
  // ═══════════════════════════════════════════
  const getAIEstimate = async () => {
    if (!selectedTaskId) return
    setIsLoadingEstimate(true)

    try {
      const response = await fetch(`${API_URL}/tasks/${selectedTaskId}/estimate-time`, {
        headers: getAuthHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        setEstimatedTime(data.estimated_minutes)
        setEstimateReasoning(data.reasoning || '')
        setEstimateSuggestions(data.suggestions || [])

        // Recommend method based on estimated time
        if (data.estimated_minutes <= 30) {
          setRecommendedMethod('pomodoro')
        } else if (data.estimated_minutes <= 60) {
          setRecommendedMethod('52-17')
        } else {
          setRecommendedMethod('flowtime')
        }
      } else {
        // Fallback
        setEstimatedTime(45)
        setEstimateReasoning('Estimación por defecto basada en complejidad media')
        setEstimateSuggestions(['Ajusta el tiempo según tu experiencia'])
        setRecommendedMethod('pomodoro')
      }
    } catch (err) {
      console.error('AI Estimate error:', err)
      setEstimatedTime(45)
      setEstimateReasoning('Sin conexión con IA. Estimación estándar aplicada.')
      setEstimateSuggestions(['Verifica tu conexión para recomendaciones personalizadas'])
      setRecommendedMethod('pomodoro')
    } finally {
      setIsLoadingEstimate(false)
    }
  }

  // ═══════════════════════════════════════════
  // SESSION CONTROL
  // ═══════════════════════════════════════════
  const handleStartSession = () => {
    sessionIdRef.current = `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    if (selectedMethod.id === 'flowtime') {
      setTimeElapsed(0)
    } else {
      setTimeRemaining(selectedMethod.workMinutes * 60)
    }

    // Auto-cambiar tarea a "en curso" si está pendiente
    if (selectedTask && selectedTask.status === 'pending' && onTaskUpdate) {
      onTaskUpdate(selectedTaskId, { ...selectedTask, status: 'in_progress' })
    }

    setPhase('running')
    setIsRunning(true)
    setCheckpointCount(0)
    setSessionPoints(0)
    setFocusWarnings(0)
    setTabSwitchLog([])
    setTotalFocusTime(0)
    setIsPausedByAntiCheat(false)
    notificationService.blockSession()
    notifyExtensionSessionStart(selectedMethod)
  }

  const handleWorkComplete = () => {
    notificationService.unblockSession()
    setIsRunning(false)
    backgroundAlarmSystem.playBackgroundAlarm(5000)

    if (selectedMethod.id === 'pomodoro') {
      setPomodoroCount(prev => prev + 1)
      setBreakTimeRemaining(selectedMethod.breakMinutes * 60)
      setPhase('break')
      notificationService.notify('🍅 ¡Pomodoro completado!', 'Toma un descanso de 5 minutos')
    } else if (selectedMethod.id === '52-17') {
      setBreakTimeRemaining(selectedMethod.breakMinutes * 60)
      setPhase('break')
      notificationService.notify('⚡ ¡Sprint completado!', 'Descanso de 17 minutos')
    }
  }

  const handleFlowtimeStop = () => {
    notificationService.unblockSession()
    setIsRunning(false)
    // Calculate suggested break: 1 min per 5 min worked
    const suggestedBreak = Math.max(5, Math.floor(timeElapsed / 300)) * 60
    setBreakTimeRemaining(suggestedBreak)
    setPhase('break')
    notificationService.notify('🌊 Flujo detenido', `Descanso sugerido: ${Math.floor(suggestedBreak / 60)} min`)
  }

  const handleResumeFromBreak = () => {
    clearInterval(breakIntervalRef.current)
    setBreakTimeRemaining(null)
    notificationService.blockSession()

    if (selectedMethod.id === 'flowtime') {
      setTimeElapsed(0)
      setPhase('running')
      setIsRunning(true)
    } else {
      setTimeRemaining(selectedMethod.workMinutes * 60)
      setPhase('running')
      setIsRunning(true)
    }
  }

  const handleResumeFromAntiCheat = () => {
    setIsPausedByAntiCheat(false)
    setDetectedPlatformName('')
    setIsRunning(true)
  }

  const handlePause = () => setIsRunning(false)
  const handleResume = () => setIsRunning(true)

  // ═══════════════════════════════════════════
  // CHECKPOINT HANDLER
  // ═══════════════════════════════════════════
  const handleSubmitCheckpoint = async () => {
    if (!checkpointResponse.trim() && !checkpointPhoto) return
    setIsVerifyingCheckpoint(true)

    try {
      const body = {
        checkpoint_id: `cp_${sessionIdRef.current}_${checkpointCount + 1}`,
        session_id: sessionIdRef.current,
        user_description: checkpointResponse,
        user_email: '', // Backend resolves from token
        photo_base64: checkpointPhoto || null
      }

      const response = await fetch(`${API_URL}/ai/checkpoint/submit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const data = await response.json()
        setCheckpointFeedback(data)

        if (data.verified) {
          setCheckpointCount(prev => prev + 1)
          setSessionPoints(prev => prev + 30)
          setCheckpointBlocked(false)
          notificationService.notify('✅ Checkpoint aprobado', data.ai_feedback || '+30 puntos')
        } else {
          setCheckpointBlocked(true)
          notificationService.notify('❌ Progreso insuficiente', data.ai_feedback || 'Iris necesita más evidencia')
        }
      } else {
        // Backend error - approve with local check
        handleLocalCheckpointVerification()
      }
    } catch (err) {
      console.error('Checkpoint submit error:', err)
      handleLocalCheckpointVerification()
    } finally {
      setIsVerifyingCheckpoint(false)
    }
  }

  const handleLocalCheckpointVerification = () => {
    const isValid = checkpointResponse.trim().length >= 20
    if (isValid) {
      setCheckpointCount(prev => prev + 1)
      setSessionPoints(prev => prev + 20)
      setCheckpointBlocked(false)
      setCheckpointFeedback({
        verified: true,
        ai_feedback: 'Respuesta aceptada (verificación local). ¡Sigue así!',
        suggestions_for_next: ['Intenta ser aún más específico en el próximo checkpoint']
      })
    } else {
      setCheckpointBlocked(true)
      setCheckpointFeedback({
        verified: false,
        ai_feedback: 'Tu respuesta es muy corta. Describe con detalle qué has avanzado.',
        suggestions_for_next: ['Menciona específicamente qué completaste', 'Incluye números: páginas leídas, problemas resueltos, etc.']
      })
    }
  }

  const handleContinueAfterCheckpoint = () => {
    setCheckpointActive(false)
    setCheckpointResponse('')
    setCheckpointPhoto(null)
    setCheckpointFeedback(null)
    setCheckpointBlocked(false)
    setPhase('running')
    setIsRunning(true)
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCheckpointPhoto(reader.result)
    reader.readAsDataURL(file)
  }

  // ═══════════════════════════════════════════
  // SESSION COMPLETE
  // ═══════════════════════════════════════════
  const handleFinishSession = () => {
    setIsRunning(false)
    clearInterval(intervalRef.current)
    clearTimeout(checkpointTimerRef.current)

    const focusMinutes = Math.floor(totalFocusTime / 60)
    let finalPoints = sessionPoints + 100

    if (focusWarnings === 0) finalPoints += 50 // Perfect focus bonus
    if (checkpointCount >= 2) finalPoints += 30  // Checkpoint bonus
    if (focusMinutes >= 45) finalPoints += 40    // Endurance bonus

    setSessionPoints(finalPoints)
    setPhase('completed')

    // Update task
    if (selectedTask && onTaskUpdate) {
      onTaskUpdate(selectedTaskId, {
        ...selectedTask,
        pomodoros_completed: (selectedTask.pomodoros_completed || 0) + (selectedMethod.id === 'pomodoro' ? pomodoroCount : 1),
        time_spent_minutes: (selectedTask.time_spent_minutes || 0) + focusMinutes,
        last_worked_at: new Date().toISOString()
      })
    }

    backgroundAlarmSystem.playCompletionSound()
    notificationService.notifyPomodoroEnd()
    notifyExtensionSessionEnd()
    if (onSessionComplete) {
      onSessionComplete({
        duration_minutes: focusMinutes,
        topic: selectedTask?.title || selectedMethod?.label || 'General',
        linked_task_id: selectedTaskId
      })
    }
  }

  // ═══════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════
  const handleReset = () => {
    notificationService.unblockSession()
    notifyExtensionSessionEnd()
    clearInterval(intervalRef.current)
    clearInterval(breakIntervalRef.current)
    clearTimeout(checkpointTimerRef.current)
    clearTimeout(awayTimerRef.current)
    awayTimerRef.current = null
    tabHiddenAtRef.current = null
    setPhase('select-task')
    setSelectedTaskId(null)
    setSelectedMethod(null)
    setIsRunning(false)
    setTimeRemaining(null)
    setTimeElapsed(0)
    setBreakTimeRemaining(null)
    setEstimatedTime(null)
    setEstimateReasoning('')
    setEstimateSuggestions([])
    setRecommendedMethod(null)
    setIsLoadingEstimate(false)
    setFocusWarnings(0)
    setTabSwitchLog([])
    setIsPausedByAntiCheat(false)
    setLastAwaySeconds(0)
    setDetectedPlatformName('')
    setCheckpointActive(false)
    setCheckpointResponse('')
    setCheckpointCount(0)
    setCheckpointFeedback(null)
    setCheckpointBlocked(false)
    setCheckpointPhoto(null)
    setSessionPoints(0)
    setPomodoroCount(0)
    setTotalFocusTime(0)
    setIsVerifyingCheckpoint(false)
  }

  // Quick-start: start a session immediately without selecting a task
  const handleQuickStart = (method) => {
    sessionIdRef.current = `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setSelectedMethod(method)
    setSelectedTaskId(null)
    if (method.id === 'flowtime') {
      setTimeElapsed(0)
      setTimeRemaining(null)
    } else {
      setTimeRemaining(method.workMinutes * 60)
      setTimeElapsed(0)
    }
    setPhase('running')
    setIsRunning(true)
    setCheckpointCount(0)
    setSessionPoints(0)
    setFocusWarnings(0)
    setTabSwitchLog([])
    setTotalFocusTime(0)
    setIsPausedByAntiCheat(false)
    notificationService.blockSession()
    notifyExtensionSessionStart(method)
  }

  // Filtered tasks
  const filteredTasks = pendingTasks.filter(t =>
    t.title?.toLowerCase().includes(taskSearch.toLowerCase()) ||
    t.course?.toLowerCase().includes(taskSearch.toLowerCase())
  )

  // ═══════════════════════════════════════════
  //  R E N D E R
  // ═══════════════════════════════════════════
  return (
    <div className="sf">
      {/* ─────── PHASE 1: SELECT TASK / QUICK START ─────── */}
      {phase === 'select-task' && (
        <div className="sf__phase sf__select-task">
          <div className="sf__phase-header">
            <div className="sf__phase-icon"><Sticker name="clock" size={40} /></div>
            <h2 className="sf__phase-title">Focus</h2>
            <p className="sf__phase-desc">Elige cómo quieres estudiar hoy</p>
          </div>

          {/* ── Quick-start (free mode – no task required) ── */}
          <div className="sf__quickstart-section">
            <div className="sf__section-label"><Sticker name="bolt" size={15} /> Inicio rápido — sin tarea</div>
            <div className="sf__qmethod-grid">
              {STUDY_METHODS.map(method => (
                <button
                  key={method.id}
                  className={`sf__qmethod-card ${irisRecMethod?.id === method.id ? 'is-iris-rec' : ''}`}
                  onClick={() => handleQuickStart(method)}
                  style={{ '--m-color': method.color, '--m-gradient': method.gradient }}
                >
                  {irisRecMethod?.id === method.id && (
                    <div className="sf__qmethod-iris-badge"><Sticker name="spark" size={13} /> Iris recomienda</div>
                  )}
                  <div className="sf__qmethod-icon-wrap">
                    <span className="sf__qmethod-icon"><Sticker name={method.icon} size={32} /></span>
                  </div>
                  <h3 className="sf__qmethod-name">{method.name}</h3>
                  <p className="sf__qmethod-details">{method.details}</p>
                  <div className="sf__qmethod-cta">Iniciar →</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Anti-distraction config for quick-start ── */}
          <div className="sf__platform-config sf__platform-config--compact">
            <button
              className="sf__platform-config-header"
              onClick={() => setShowPlatformConfig(v => !v)}
            >
              <div className="sf__platform-config-title">
                <span><Sticker name="shield" size={16} /> Anti-distracción</span>
                {extensionDetected
                  ? <span className="sf__ext-badge sf__ext-badge--on"><Sticker name="check" size={13} /> Extensión activa</span>
                  : <span className="sf__ext-badge sf__ext-badge--off"><Sticker name="alert" size={13} /> Sin extensión</span>
                }
              </div>
              <span className="sf__platform-config-summary">
                {enabledPlatforms.size} bloqueada{enabledPlatforms.size !== 1 ? 's' : ''}
              </span>
              <span className="sf__platform-config-chevron">{showPlatformConfig ? '▲' : '▼'}</span>
            </button>

            {showPlatformConfig && (
              <div className="sf__platform-list">
                {!extensionDetected && (
                  <div className="sf__ext-notice">
                    <Sticker name="alert" size={14} /> Sin la extensión, el anti-cheat detecta por tiempo (60s de inactividad).{' '}
                    <a href="https://chromewebstore.google.com/detail/djapikklcmfeldpdbfejodnhdfpbjbaj" target="_blank" rel="noreferrer">
                      Instalar extensión en Chrome →
                    </a>
                  </div>
                )}
                <div className="sf__platform-actions">
                  <button onClick={() => setEnabledPlatforms(new Set(DISTRACTION_PLATFORMS.map(p => p.id)))}>
                    Seleccionar todo
                  </button>
                  <button onClick={() => setEnabledPlatforms(new Set())}>
                    Deseleccionar todo
                  </button>
                </div>
                {PLATFORM_CATEGORIES.map(cat => {
                  const catPlatforms = DISTRACTION_PLATFORMS.filter(p => p.category === cat)
                  const allEnabled = catPlatforms.every(p => enabledPlatforms.has(p.id))
                  const catEmoji = catPlatforms[0]?.emoji
                  return (
                    <div key={cat} className="sf__platform-category">
                      <div className="sf__platform-cat-header">
                        <span><Sticker name={catEmoji} size={15} /> {cat}</span>
                        <button onClick={() => setEnabledPlatforms(prev => {
                          const next = new Set(prev)
                          catPlatforms.forEach(p => allEnabled ? next.delete(p.id) : next.add(p.id))
                          return next
                        })}>
                          {allEnabled ? 'Desactivar todos' : 'Activar todos'}
                        </button>
                      </div>
                      <div className="sf__platform-chips">
                        {catPlatforms.map(platform => (
                          <button
                            key={platform.id}
                            className={`sf__platform-chip ${enabledPlatforms.has(platform.id) ? 'is-enabled' : ''}`}
                            onClick={() => setEnabledPlatforms(prev => {
                              const next = new Set(prev)
                              next.has(platform.id) ? next.delete(platform.id) : next.add(platform.id)
                              return next
                            })}
                          >
                            <Sticker name={platform.emoji} size={14} /> {platform.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="sf__section-divider">
            <span>o vincula con una tarea</span>
          </div>

          {/* ── Task search + list ── */}
          <div className="sf__search-bar">
            <span className="sf__search-icon"><Sticker name="research" size={17} /></span>
            <input
              type="text"
              className="sf__search-input"
              placeholder="Buscar tarea por nombre o materia..."
              value={taskSearch}
              onChange={e => setTaskSearch(e.target.value)}
            />
          </div>

          <div className="sf__task-list">
            {filteredTasks.length === 0 ? (
              <div className="sf__empty">
                <span className="sf__empty-icon"><Sticker name="doc" size={40} /></span>
                <p>No hay tareas pendientes. ¡Crea una primero!</p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <button
                  key={task.id}
                  className={`sf__task-card ${selectedTaskId === task.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="sf__task-priority" style={{
                    background: task.priority === 'high' ? '#ef4444'
                      : task.priority === 'medium' ? '#f59e0b' : '#22c55e'
                  }} />
                  <div className="sf__task-info">
                    <span className="sf__task-title">{task.title}</span>
                    <div className="sf__task-meta">
                      {task.course && <span className="sf__task-course"><Sticker name="cap" size={13} /> {task.course}</span>}
                      {task.due_date && (
                        <span className="sf__task-due">
                          <Sticker name="calendar" size={13} /> {new Date(task.due_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedTaskId === task.id && <span className="sf__task-check">✓</span>}
                </button>
              ))
            )}
          </div>

          {selectedTaskId && (
            <div className="sf__action-bar">
              <button className="sf__btn sf__btn--ai" onClick={getAIEstimate} disabled={isLoadingEstimate}>
                <Sticker name="spark" size={16} />{isLoadingEstimate ? ' Consultando a Iris…' : ' ¿Cuánto tiempo tomará? (IA)'}
              </button>

              {estimatedTime && (
                <div className="sf__ai-result">
                  <div className="sf__ai-estimate">
                    <div className="sf__ai-time">
                      <span className="sf__ai-time-value">{estimatedTime}</span>
                      <span className="sf__ai-time-label">min estimados</span>
                    </div>
                    {estimateReasoning && <p className="sf__ai-reasoning">{estimateReasoning}</p>}
                    {estimateSuggestions.length > 0 && (
                      <div className="sf__ai-suggestions">
                        {estimateSuggestions.map((s, i) => (
                          <span key={i} className="sf__ai-suggestion">{s}</span>
                        ))}
                      </div>
                    )}
                    {recommendedMethod && (
                      <div className="sf__ai-recommendation">
                        <span className="sf__ai-rec-label"><Sticker name="spark" size={14} /> Iris recomienda:</span>
                        <span className="sf__ai-rec-method">
                          <Sticker name={STUDY_METHODS.find(m => m.id === recommendedMethod)?.icon} size={15} />{' '}
                          {STUDY_METHODS.find(m => m.id === recommendedMethod)?.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                className="sf__btn sf__btn--primary sf__btn--lg"
                onClick={() => setPhase('select-method')}
              >
                Continuar con tarea →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─────── PHASE 2: SELECT METHOD ─────── */}
      {phase === 'select-method' && (
        <div className="sf__phase sf__select-method">
          <div className="sf__phase-header">
            <button className="sf__back-btn" onClick={() => setPhase('select-task')}>
              ← Cambiar tarea
            </button>
            <div className="sf__phase-icon"><Sticker name="clock" size={40} /></div>
            <h2 className="sf__phase-title">Elige tu método de estudio</h2>
            <p className="sf__phase-desc">
              Tarea: <strong>{selectedTask?.title}</strong>
            </p>
          </div>

          <div className="sf__methods-grid">
            {STUDY_METHODS.map(method => (
              <button
                key={method.id}
                className={`sf__method-card ${selectedMethod?.id === method.id ? 'is-selected' : ''} ${recommendedMethod === method.id ? 'is-recommended' : ''}`}
                onClick={() => setSelectedMethod(method)}
                style={{ '--method-color': method.color }}
              >
                {recommendedMethod === method.id && (
                  <div className="sf__method-rec-badge"><Sticker name="spark" size={13} /> Recomendado</div>
                )}
                <span className="sf__method-tag">{method.tag}</span>
                <div className="sf__method-icon-wrap" style={{ background: method.gradient }}>
                  <span className="sf__method-icon"><Sticker name={method.icon} size={28} /></span>
                </div>
                <h3 className="sf__method-name">{method.name}</h3>
                <p className="sf__method-desc">{method.description}</p>
                <span className="sf__method-details">{method.details}</span>
                <span className="sf__method-benefit">{method.benefit}</span>
                {selectedMethod?.id === method.id && (
                  <div className="sf__method-check">✓</div>
                )}
              </button>
            ))}
          </div>

          {/* ─── Anti-distraction platform config ─── */}
          <div className="sf__platform-config">
            <button
              className="sf__platform-config-header"
              onClick={() => setShowPlatformConfig(v => !v)}
            >
              <div className="sf__platform-config-title">
                <span><Sticker name="shield" size={16} /> Anti-distracción</span>
                {extensionDetected
                  ? <span className="sf__ext-badge sf__ext-badge--on"><Sticker name="check" size={13} /> Extensión activa</span>
                  : <span className="sf__ext-badge sf__ext-badge--off"><Sticker name="alert" size={13} /> Sin extensión</span>
                }
              </div>
              <span className="sf__platform-config-summary">
                {enabledPlatforms.size} plataforma{enabledPlatforms.size !== 1 ? 's' : ''} bloqueada{enabledPlatforms.size !== 1 ? 's' : ''}
              </span>
              <span className="sf__platform-config-chevron">{showPlatformConfig ? '▲' : '▼'}</span>
            </button>

            {showPlatformConfig && (
              <div className="sf__platform-list">
                {!extensionDetected && (
                  <div className="sf__ext-notice">
                    <Sticker name="alert" size={14} /> Sin la extensión, el anti-cheat detecta por tiempo (60s de inactividad).{' '}
                    <a href="https://chromewebstore.google.com/detail/djapikklcmfeldpdbfejodnhdfpbjbaj" target="_blank" rel="noreferrer">
                      Instalar extensión en Chrome →
                    </a>
                  </div>
                )}
                <div className="sf__platform-actions">
                  <button onClick={() => setEnabledPlatforms(new Set(DISTRACTION_PLATFORMS.map(p => p.id)))}>
                    Seleccionar todo
                  </button>
                  <button onClick={() => setEnabledPlatforms(new Set())}>
                    Deseleccionar todo
                  </button>
                </div>
                {PLATFORM_CATEGORIES.map(cat => {
                  const catPlatforms = DISTRACTION_PLATFORMS.filter(p => p.category === cat)
                  const allEnabled = catPlatforms.every(p => enabledPlatforms.has(p.id))
                  const catEmoji = catPlatforms[0]?.emoji
                  return (
                    <div key={cat} className="sf__platform-category">
                      <div className="sf__platform-cat-header">
                        <span><Sticker name={catEmoji} size={15} /> {cat}</span>
                        <button onClick={() => setEnabledPlatforms(prev => {
                          const next = new Set(prev)
                          catPlatforms.forEach(p => allEnabled ? next.delete(p.id) : next.add(p.id))
                          return next
                        })}>
                          {allEnabled ? 'Desactivar todos' : 'Activar todos'}
                        </button>
                      </div>
                      <div className="sf__platform-chips">
                        {catPlatforms.map(platform => (
                          <button
                            key={platform.id}
                            className={`sf__platform-chip ${enabledPlatforms.has(platform.id) ? 'is-enabled' : ''}`}
                            onClick={() => setEnabledPlatforms(prev => {
                              const next = new Set(prev)
                              next.has(platform.id) ? next.delete(platform.id) : next.add(platform.id)
                              return next
                            })}
                          >
                            <Sticker name={platform.emoji} size={14} /> {platform.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {selectedMethod && (
            <div className="sf__action-bar">
              <div className="sf__session-summary">
                <div className="sf__summary-item">
                  <span className="sf__summary-label">Tarea</span>
                  <span className="sf__summary-value">{selectedTask?.title}</span>
                </div>
                <div className="sf__summary-item">
                  <span className="sf__summary-label">Método</span>
                  <span className="sf__summary-value"><Sticker name={selectedMethod.icon} size={15} /> {selectedMethod.name}</span>
                </div>
                {estimatedTime && (
                  <div className="sf__summary-item">
                    <span className="sf__summary-label">Tiempo IA</span>
                    <span className="sf__summary-value">{estimatedTime} min</span>
                  </div>
                )}
              </div>
              <button className="sf__btn sf__btn--primary sf__btn--lg sf__btn--glow" onClick={handleStartSession}>
                <Sticker name="rocket" size={17} /> Iniciar Sesión
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─────── PHASE 3: RUNNING SESSION ─────── */}
      {phase === 'running' && (
        <div className="sf__phase sf__running" style={{ '--accent': selectedMethod?.color }}>
          {/* Anti-cheat overlay */}
          {isPausedByAntiCheat && (
            <div className="sf__anticheat-overlay">
              <div className="sf__anticheat-modal">
                <div className="sf__anticheat-icon"><Sticker name="alert" size={42} /></div>
                <h3>Sesión Pausada</h3>
                <p>Iris detectó que abriste una plataforma bloqueada.</p>
                <div className="sf__anticheat-platform"><Sticker name="ban" size={15} /> {detectedPlatformName}</div>
                <div className="sf__anticheat-stats">
                  <span><Sticker name="alert" size={14} /> Advertencias: {focusWarnings}</span>
                  {focusWarnings >= 3 && (
                    <span className="sf__anticheat-danger">
                      <Sticker name="alert" size={14} /> Demasiadas distracciones. Se enviará un reporte.
                    </span>
                  )}
                </div>
                <button className="sf__btn sf__btn--primary" onClick={handleResumeFromAntiCheat}>
                  <Sticker name="repeat" size={16} /> Volver a enfocarme
                </button>
              </div>
            </div>
          )}

          {/* Session header */}
          <div className="sf__run-header">
            <div className="sf__run-method">
              <span className="sf__run-method-icon" style={{ background: selectedMethod?.gradient }}>
                <Sticker name={selectedMethod?.icon} size={24} />
              </span>
              <div>
                <h3 className="sf__run-title">{selectedMethod?.name}</h3>
                <span className="sf__run-task">{selectedTask?.title || 'Sesión libre'}</span>
              </div>
            </div>
            <div className="sf__run-stats">
              <div className="sf__run-stat">
                <span className="sf__run-stat-val">{checkpointCount}</span>
                <span className="sf__run-stat-label">Checks</span>
              </div>
              <div className="sf__run-stat">
                <span className="sf__run-stat-val">{focusWarnings}</span>
                <span className="sf__run-stat-label">Avisos</span>
              </div>
              <div className="sf__run-stat">
                <span className="sf__run-stat-val">{sessionPoints}</span>
                <span className="sf__run-stat-label">Pts</span>
              </div>
            </div>
          </div>

          {/* Notification blocker badge */}
          <div className="sf__notif-blocked-badge">
            <Sticker name="bell" size={14} /> Notificaciones bloqueadas
          </div>

          {/* Timer display */}
          <div className="sf__timer-area">
            <div className="sf__timer-ring" style={{ '--ring-color': selectedMethod?.color }}>
              <div className="sf__timer-inner">
                <span className="sf__timer-time">
                  {selectedMethod?.id === 'flowtime'
                    ? fmt(timeElapsed)
                    : fmt(timeRemaining || 0)
                  }
                </span>
                <span className="sf__timer-label">
                  {selectedMethod?.id === 'flowtime' ? 'Tiempo en flujo' : 'Restante'}
                </span>
              </div>
              {/* Progress arc for countdown methods */}
              {selectedMethod?.id !== 'flowtime' && timeRemaining !== null && (
                <svg className="sf__timer-svg" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
                  <circle
                    cx="100" cy="100" r="90"
                    fill="none"
                    stroke={selectedMethod?.color}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 90}`}
                    strokeDashoffset={`${2 * Math.PI * 90 * (1 - (timeRemaining / (selectedMethod?.workMinutes * 60)))}`}
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                    transform="rotate(-90 100 100)"
                  />
                </svg>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="sf__controls">
            {isRunning ? (
              <button className="sf__ctrl-btn sf__ctrl-btn--pause" onClick={handlePause}>
                <Sticker name="pause" size={16} /> Pausar
              </button>
            ) : (
              <button className="sf__ctrl-btn sf__ctrl-btn--play" onClick={handleResume}>
                <Sticker name="play" size={16} /> Reanudar
              </button>
            )}

            {selectedMethod?.id === 'flowtime' && (
              <button className="sf__ctrl-btn sf__ctrl-btn--stop" onClick={handleFlowtimeStop}>
                <Sticker name="stop" size={16} /> Detener flujo
              </button>
            )}

            <button className="sf__ctrl-btn sf__ctrl-btn--finish" onClick={handleFinishSession}>
              <Sticker name="check" size={16} /> Finalizar
            </button>
          </div>

          {/* Focus indicator */}
          <div className={`sf__focus-bar ${focusWarnings > 0 ? 'has-warnings' : ''}`}>
            <div className="sf__focus-indicator">
              <span className={`sf__focus-dot ${isRunning ? 'is-active' : ''}`} />
              <span className="sf__focus-text">
                {isRunning ? 'Enfocado' : 'Pausado'}
              </span>
            </div>
            {focusWarnings > 0 && (
              <span className="sf__focus-warnings">
                <Sticker name="alert" size={14} /> {focusWarnings} pérdida{focusWarnings !== 1 ? 's' : ''} de enfoque
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─────── PHASE 4: BREAK ─────── */}
      {phase === 'break' && (
        <div className="sf__phase sf__break">
          <div className="sf__break-content">
            <div className="sf__break-icon">
              <Sticker name={selectedMethod?.id === 'pomodoro' ? 'coffee' : selectedMethod?.id === '52-17' ? 'leaf' : 'leaf'} size={44} />
            </div>
            <h2 className="sf__break-title">¡Toma un descanso!</h2>
            <p className="sf__break-subtitle">
              {selectedMethod?.id === 'pomodoro'
                ? 'Estírate, toma agua, relaja los ojos'
                : selectedMethod?.id === '52-17'
                ? 'Descanso largo para recargar energía'
                : 'Respira profundo y prepárate para la próxima sesión'
              }
            </p>

            <div className="sf__break-timer">
              <span className="sf__break-time">{fmt(breakTimeRemaining || 0)}</span>
            </div>

            <div className="sf__break-tips">
              <span><Sticker name="drop" size={15} /> Toma agua</span>
              <span><Sticker name="heart" size={15} /> Estírate</span>
              <span><Sticker name="eye" size={15} /> Descansa la vista</span>
              <span><Sticker name="wave" size={15} /> Respira profundo</span>
            </div>

            <button className="sf__btn sf__btn--primary" onClick={handleResumeFromBreak}>
              <Sticker name="rocket" size={16} /> Volver a trabajar
            </button>
          </div>
        </div>
      )}

      {/* ─────── PHASE 5: CHECKPOINT ─────── */}
      {phase === 'checkpoint' && (
        <div className="sf__phase sf__checkpoint">
          <div className="sf__checkpoint-content">
            <div className="sf__checkpoint-header">
              <div className="sf__checkpoint-icon"><Sticker name="cap" size={42} /></div>
              <h2 className="sf__checkpoint-title">Checkpoint #{checkpointCount + 1}</h2>
              <p className="sf__checkpoint-subtitle">
                Iris necesita verificar tu progreso para continuar
              </p>
            </div>

            {/* Feedback from previous attempt */}
            {checkpointFeedback && (
              <div className={`sf__cp-feedback ${checkpointFeedback.verified ? 'is-approved' : 'is-rejected'}`}>
                <span className="sf__cp-feedback-icon"><Sticker name={checkpointFeedback.verified ? 'check' : 'cross'} size={18} /></span>
                <div className="sf__cp-feedback-body">
                  <p className="sf__cp-feedback-text">{checkpointFeedback.ai_feedback}</p>
                  {checkpointFeedback.suggestions_for_next?.length > 0 && (
                    <div className="sf__cp-feedback-tips">
                      {checkpointFeedback.suggestions_for_next.map((tip, i) => (
                        <span key={i} className="sf__cp-tip"><Sticker name="bulb" size={13} /> {tip}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Input area */}
            {(!checkpointFeedback || !checkpointFeedback.verified) && (
              <>
                <div className="sf__cp-input-area">
                  <label className="sf__cp-label">
                    <Sticker name="doc" size={15} /> Describe qué has avanzado hasta ahora:
                  </label>
                  <textarea
                    className="sf__cp-textarea"
                    value={checkpointResponse}
                    onChange={e => setCheckpointResponse(e.target.value)}
                    placeholder="Ej: Completé los ejercicios 5-8 de derivadas, revisé mis respuestas y entendí el concepto de la regla de la cadena..."
                    rows={4}
                  />

                  <div className="sf__cp-photo-area">
                    <button
                      className="sf__cp-photo-btn"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <Sticker name="camera" size={15} /> {checkpointPhoto ? 'Cambiar captura' : 'Agregar captura de pantalla'}
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handlePhotoUpload}
                    />
                    {checkpointPhoto && (
                      <div className="sf__cp-photo-preview">
                        <img src={checkpointPhoto} alt="Captura" />
                        <button onClick={() => setCheckpointPhoto(null)}>✕</button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sf__cp-actions">
                  <button
                    className="sf__btn sf__btn--primary"
                    onClick={handleSubmitCheckpoint}
                    disabled={(!checkpointResponse.trim() && !checkpointPhoto) || isVerifyingCheckpoint}
                  >
                    {isVerifyingCheckpoint ? 'Iris verificando…' : <><Sticker name="spark" size={16} /> Enviar a Iris</>}
                  </button>
                </div>

                <div className="sf__cp-examples">
                  <h4><Sticker name="bulb" size={15} /> Ejemplos de buenas evidencias:</h4>
                  <ul>
                    <li>Completé 10 ejercicios de ecuaciones cuadráticas (problemas 15-24)</li>
                    <li>Escribí 600 palabras del ensayo sobre energías renovables</li>
                    <li>Adjunto captura de mis notas del capítulo 5</li>
                  </ul>
                </div>
              </>
            )}

            {/* Continue button (only if verified) */}
            {checkpointFeedback?.verified && (
              <button className="sf__btn sf__btn--primary sf__btn--glow" onClick={handleContinueAfterCheckpoint}>
<Sticker name="spark" size={16} /> Continuar sesión
              </button>
            )}

            {/* Blocked message */}
            {checkpointBlocked && (
              <div className="sf__cp-blocked">
                <span className="sf__cp-blocked-icon"><Sticker name="ban" size={40} /></span>
                <p>Iris necesita más evidencia de progreso. Intenta de nuevo con más detalle o una captura de pantalla.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────── PHASE 6: COMPLETED ─────── */}
      {phase === 'completed' && (
        <div className="sf__phase sf__completed">
          <div className="sf__completed-content">
            <div className="sf__completed-celebration">
              <span className="sf__completed-icon"><Sticker name={selectedMethod?.icon} size={52} /></span>
              <h2 className="sf__completed-title">
                ¡Sesión de {selectedMethod?.name} Completada!
              </h2>
            </div>

            <div className="sf__completed-stats">
              <div className="sf__comp-stat">
                <span className="sf__comp-stat-icon"><Sticker name="clock" size={22} /></span>
                <span className="sf__comp-stat-label">Tiempo enfocado</span>
                <span className="sf__comp-stat-value">{Math.floor(totalFocusTime / 60)} min</span>
              </div>
              <div className="sf__comp-stat">
                <span className="sf__comp-stat-icon"><Sticker name="mind" size={22} /></span>
                <span className="sf__comp-stat-label">Checkpoints</span>
                <span className="sf__comp-stat-value">{checkpointCount}</span>
              </div>
              <div className="sf__comp-stat">
                <span className="sf__comp-stat-icon"><Sticker name="alert" size={22} /></span>
                <span className="sf__comp-stat-label">Pérdidas de enfoque</span>
                <span className="sf__comp-stat-value">{focusWarnings}</span>
              </div>
              {selectedMethod?.id === 'pomodoro' && (
                <div className="sf__comp-stat">
                  <span className="sf__comp-stat-icon"><Sticker name="tomato" size={22} /></span>
                  <span className="sf__comp-stat-label">Pomodoros</span>
                  <span className="sf__comp-stat-value">{pomodoroCount}</span>
                </div>
              )}
              <div className="sf__comp-stat sf__comp-stat--highlight">
                <span className="sf__comp-stat-icon"><Sticker name="star" size={22} /></span>
                <span className="sf__comp-stat-label">Puntos totales</span>
                <span className="sf__comp-stat-value">{sessionPoints}</span>
              </div>
            </div>

            <div className="sf__completed-feedback">
              {focusWarnings === 0 ? (
                <p className="sf__feedback sf__feedback--perfect"><Sticker name="trophy" size={16} /> ¡Concentración perfecta! Cero distracciones.</p>
              ) : focusWarnings <= 2 ? (
                <p className="sf__feedback sf__feedback--good"><Sticker name="check" size={16} /> Buen trabajo, pocas interrupciones.</p>
              ) : (
                <p className="sf__feedback sf__feedback--warn"><Sticker name="alert" size={16} /> Muchas distracciones detectadas. Intenta mantener el enfoque.</p>
              )}
            </div>

            <button className="sf__btn sf__btn--primary sf__btn--lg" onClick={handleReset}>
<Sticker name="plus" size={16} /> Nueva Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudyFlow
