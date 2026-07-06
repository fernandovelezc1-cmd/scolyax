/**
 * Aplicación principal de Scolyax en el frontend.
 * Coordina el estado global, las pestañas y las llamadas al backend.
 * Production deployment
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HeaderGreeting from './components/HeaderGreeting'
import TaskList from './components/TaskList'
import ReminderList from './components/ReminderList'
import AIAssistant from './components/AIAssistant'
import StudyFlow from './components/StudyFlow'
import SchedulePlanner from './components/SchedulePlanner'
import AuthGateway from './components/AuthGateway'
import DisplayNamePrompt from './components/DisplayNamePrompt'
import GamificationBar from './components/GamificationBar'
import AchievementSystem from './components/AchievementSystem'
import AchievementCelebration from './components/AchievementCelebration'
import StreakCelebration, { STREAK_MILESTONES } from './components/StreakCelebration'
import NotificationCenter, { registerServiceWorker, requestNotificationPermission } from './components/NotificationCenter'
import { useEmotionalNotifications } from './hooks/useEmotionalNotifications'
import NotificationPermissionBanner from './components/NotificationPermissionBanner'
import OfflineIndicator from './components/OfflineIndicator'
import LandingPage from './components/LandingPage'
import CognitiveTest from './components/CognitiveTest'
import ToolSelector from './components/ToolSelector'
import OnboardingLoader from './components/OnboardingLoader'
import DashboardTransition from './components/DashboardTransition'
import Sticker from './components/Stickers'
import LoadingBar from './components/LoadingBar'
import InstallPrompt from './components/InstallPrompt'
import AvatarSelector from './components/AvatarSelector'
import LoadingScreen from './components/LoadingScreen'
import RatingModal from './components/RatingModal'
import AdminRatingsPanel from './components/AdminRatingsPanel'
import HomePanel from './components/HomePanel'
import SettingsPanel from './components/SettingsPanel'
import CrisisMode from './components/CrisisMode'
import EnergyJournal from './components/EnergyJournal'
import IrisResults from './components/IrisResults'
import MoodEvaluator from './components/MoodEvaluator'
import notificationService from './services/notificationService'
import './styles/admin-panel-modal.css'
import './styles/admin-ratings-panel.css'

const DEFAULT_STATS = {
  tasks_completed: 0,
  focus_hours: 0,
  milestones_completed: 0,
  upcoming_reminders: 0,
  streak_days: 0
}

// Normalizar API_URL removiendo barras al final
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

/**
 * Helper para hacer fetch con Authorization header automático
 * Lee el token de localStorage y lo incluye en todos los requests
 */
const authenticatedFetch = (url, options = {}) => {
  const sessionToken = typeof window !== 'undefined'
    ? window.localStorage.getItem('scolyax.sessionToken')
    : null

  // Detectar zona horaria del usuario para notificaciones correctas
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const headers = {
    ...options.headers,
    ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
    'X-Timezone': userTimezone,
  }

  return fetch(url, { ...options, headers })
}

const FALLBACK_SESSION = {
  id: 0,
  email: 'offline@scolyax.app',
  display_name: 'Modo sin conexión',
  provider: 'google',
  isMock: true
}

const FALLBACK_STATS = { ...DEFAULT_STATS }

const FALLBACK_TASKS = []

const FALLBACK_REMINDERS = []

const FALLBACK_SCHEDULE = []

const FALLBACK_SUMMARY = ''

const FALLBACK_ORIGINAL_TEXT = ''

const FALLBACK_KEYWORDS = []

const LOGIN_TAB = { id: 'login', label: 'Acceso' }


/* ── Sidebar Icons ──
   Light: clean outlines, stroke-width 2
   Dark:  bolder strokes (2.5) + subtle colored fills & accents for visibility
*/
// Scolyax line-icon set — single coherent style, theme-aware via currentColor
const NAV_ICONS = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/><path d="M10 20v-5h4v5"/></svg>`,
  tasks: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5 11 15l4.5-5"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/><circle cx="8.5" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none"/></svg>`,
  reminders: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>`,
  summary: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z"/><path d="M18 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/></svg>`,
  timer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v15.5H6.5A2.5 2.5 0 0 0 4 21Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v15.5h5.5A2.5 2.5 0 0 1 20 21Z"/></svg>`,
  achievements: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 5H4.5v1.5A3.5 3.5 0 0 0 8 10M17 5h2.5v1.5A3.5 3.5 0 0 1 16 10"/><path d="M9.5 20h5M12 14v6"/></svg>`,
};

const LIGHT_ICONS = NAV_ICONS;
const DARK_ICONS = NAV_ICONS;

const DASHBOARD_TABS = [
  { id: 'home', label: 'Inicio', icon: '🏠' },
  { id: 'tasks', label: 'Tareas', icon: '📚' },
  { id: 'calendar', label: 'Calendario', icon: '🗓️' },
  { id: 'reminders', label: 'Recordatorios', icon: '🔔' },
  { id: 'summary', label: 'Iris IA', icon: '✨' },
  { id: 'timer', label: 'Focus', icon: 'flow' },
  { id: 'achievements', label: 'Logros', icon: '🏆' }
]

const deriveFallbackName = (email) => {
  if (!email) return ''
  const prefix = email.split('@', 1)[0]
  return prefix
    .replace(/[-_.]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

// Hook para capturar y procesar token OAuth de la URL
const useOAuthCallback = () => {
  useEffect(() => {
    console.time('⏱️ OAuth callback processing')
    const params = new URLSearchParams(window.location.search)
    const callbackToken = params.get('token')
    const authStatus = params.get('auth')
    const provider = params.get('provider')
    
    console.log('🔍 OAuth callback check:', { 
      hasToken: !!callbackToken, 
      authStatus, 
      provider,
      fullURL: window.location.href 
    })
    
    if (callbackToken) {
      console.log('🔑 OAuth callback detected!')
      console.log('   Token:', callbackToken.substring(0, 20) + '...')
      console.log('   Status:', authStatus)
      console.log('   Provider:', provider)
      
      window.localStorage.setItem('scolyax.sessionToken', callbackToken)
      console.log('✅ Token saved to localStorage')
      
      // Limpiar parámetros de la URL
      window.history.replaceState({}, document.title, window.location.pathname)
      console.log('✅ URL cleaned')
      
      console.timeEnd('⏱️ OAuth callback processing')
      
      // ⚡ OPTIMIZACIÓN: En lugar de reload completo, simplemente limpiar la URL
      // El useEffect de checkSession() se disparará automáticamente y cargará la sesión
      console.log('✅ Session token ready - checkSession will handle the rest')
      // NO hacer window.location.reload() - innecesario, el useEffect ya maneja esto
    } else if (params.get('calendar') === 'connected') {
      // Google Calendar fue conectado exitosamente
      console.log('📅 Google Calendar connected successfully!')
      window.localStorage.setItem('scolyax.googleCalendarConnected', '1')
      // Limpiar parámetros de la URL
      window.history.replaceState({}, document.title, window.location.pathname)
      console.timeEnd('⏱️ OAuth callback processing')
    } else if (authStatus) {
      console.warn('⚠️ OAuth callback received but NO TOKEN in URL!')
      console.warn('   This means the backend did not include the token')
      console.warn('   Full URL:', window.location.href)
      console.timeEnd('⏱️ OAuth callback processing')
    }
  }, [])
}

// Componente raíz que muestra la navegación y cada pestaña funcional.
const App = () => {
  // Capturar token OAuth si viene en la URL
  useOAuthCallback()
  
  const [activeTab, setActiveTab] = useState('login')
  const [tabHistory, setTabHistory] = useState(['login'])
  const [session, setSession] = useState(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [isBackendReachable, setIsBackendReachable] = useState(true)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  // Modo nocturno automático: oscuro de 18:00 a 5:59, claro de 6:00 a 17:59
  const isNightTime = () => {
    const h = new Date().getHours()
    return h >= 18 || h < 6
  }
  // themeMode: 'auto' | 'light' | 'dark'
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('scolyax.themeMode')
    return saved || 'dark'
  })
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('scolyax.themeMode')
    if (savedMode === 'dark') return true
    if (savedMode === 'light') return false
    if (savedMode === 'auto') return isNightTime()
    // Default experience: editorial dark + lime
    return true
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [stats, setStats] = useState(() => ({ ...DEFAULT_STATS }))
  // Contador acumulativo de tareas completadas (NUNCA se decrementa)
  const [totalTasksEverCompleted, setTotalTasksEverCompleted] = useState(() => {
    const saved = localStorage.getItem('scolyax.totalTasksEverCompleted')
    return saved ? parseInt(saved, 10) : 0
  })
  const [tasks, setTasks] = useState([])
  const [scheduleEntries, setScheduleEntries] = useState([])
  const [reminders, setReminders] = useState([])
  const [summary, setSummary] = useState('')
  const [originalText, setOriginalText] = useState('')
  const [keywords, setKeywords] = useState([])
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [isNamePromptOpen, setIsNamePromptOpen] = useState(false)
  
  // Gamification states
  const [xp, setXp] = useState(() => {
    const saved = localStorage.getItem('scolyax.xp')
    return saved ? parseInt(saved, 10) : 0
  })
  const [streakDays, setStreakDays] = useState(() => {
    const saved = localStorage.getItem('scolyax.streak')
    return saved ? parseInt(saved, 10) : 0
  })
  const [lastActivityDate, setLastActivityDate] = useState(() => {
    const saved = localStorage.getItem('scolyax.lastActivity')
    return saved || null
  })
  const [userStatsLoaded, setUserStatsLoaded] = useState(false)
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false)
  const [streakMilestoneToShow, setStreakMilestoneToShow] = useState(null)
  const [unlockedAchievements, setUnlockedAchievements] = useState(() => {
    const saved = localStorage.getItem('scolyax.achievements')
    return saved ? JSON.parse(saved) : []
  })
  const [gamificationStats, setGamificationStats] = useState({
    tasksCompleted: 0,
    pomodoroSessions: 0,
    nightSessions: 0,
    morningSessions: 0,
    tripleDay: 0,
    maxTasksPerDay: 0,
    streakDays: 0
  })
  const [showLanding, setShowLanding] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('scolyax.sidebarCollapsed')
    return saved !== 'false' // collapsed by default
  })
  
  // Avatar state
  const [userAvatar, setUserAvatar] = useState(() => {
    const saved = localStorage.getItem('scolyax.userAvatar')
    return saved || null
  })
  const [isAvatarSelectorOpen, setIsAvatarSelectorOpen] = useState(false)
  
  // Onboarding states - Initialize from localStorage to persist across reloads
  const [isNewUser, setIsNewUser] = useState(() => {
    const saved = window.localStorage.getItem('scolyax.onboarding.isNewUser')
    return saved === 'true'
  })
  const [hasCompletedTest, setHasCompletedTest] = useState(() => {
    const saved = window.localStorage.getItem('scolyax.onboarding.hasCompletedTest')
    return saved === 'true'
  })
  const [recommendedTools, setRecommendedTools] = useState(() => {
    const saved = window.localStorage.getItem('scolyax.onboarding.recommendedTools')
    return saved ? JSON.parse(saved) : []
  })
  const [recommendedStudyMethod, setRecommendedStudyMethod] = useState(() => {
    return window.localStorage.getItem('scolyax.onboarding.recommendedStudyMethod') || null
  })
  const [showToolSelector, setShowToolSelector] = useState(false)
  // NOTE: showToolSelector starts false. The loading screen will set it to true 
  // via handleLoadingScreenComplete after showing the animation.
  const [showOnboardingLoader, setShowOnboardingLoader] = useState(false)
  const [isLoaderFadingOut, setIsLoaderFadingOut] = useState(false)
  const [showDashboardTransition, setShowDashboardTransition] = useState(false)
  const [transitionData, setTransitionData] = useState({ tool: null, toolName: '', toolIcon: '' })
  const [showLoadingScreenAfterLogin, setShowLoadingScreenAfterLogin] = useState(false)

  // IrisResults – pantalla de análisis post-test cognitivo (una sola vez)
  const [showIrisResults, setShowIrisResults] = useState(false)
  const [irisTestAnswers, setIrisTestAnswers] = useState([])

  // MoodEvaluator – evaluador emocional para usuarios recurrentes (una vez por sesión)
  const [showMoodEvaluator, setShowMoodEvaluator] = useState(false)
  
  // Rating Modal states
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [achievementToRate, setAchievementToRate] = useState(null)
  
  // Achievement Celebration state (global, shows above all tabs)
  const [achievementToCelebrate, setAchievementToCelebrate] = useState(null)
  const [showAchievementCelebration, setShowAchievementCelebration] = useState(false)
  
  // Admin Feedback Panel state
  const [showAdminFeedback, setShowAdminFeedback] = useState(false)
  
  // Crisis Mode state
  const [showCrisisMode, setShowCrisisMode] = useState(false)
  
  // Energy Journal state (post-session check-in)
  const [showEnergyJournal, setShowEnergyJournal] = useState(false)
  
  // Feature Landing Pages state - track which features have been started
  const [startedFeatures, setStartedFeatures] = useState(() => {
    const saved = localStorage.getItem('scolyax.startedFeatures')
    return saved ? JSON.parse(saved) : {}
  })
  
  // Emotional notifications hook
  const { sendStreakNotification, sendStreakLostNotification, sendMotivationNotification } = useEmotionalNotifications()

  const fallbackData = useMemo(
    () => ({
      session: FALLBACK_SESSION,
      stats: FALLBACK_STATS,
      tasks: FALLBACK_TASKS,
      reminders: FALLBACK_REMINDERS,
      schedule: FALLBACK_SCHEDULE
    }),
    []
  )

  const activateOfflineExperience = useCallback(
    (overrides = {}) => {
      const offlineSession = { ...fallbackData.session, ...overrides }
      setIsOfflineMode(true)
      setSession(offlineSession)
      setStats({ ...fallbackData.stats })
      setTasks([...fallbackData.tasks])
      setReminders([...fallbackData.reminders])
      setScheduleEntries([...fallbackData.schedule])
      setSummary(FALLBACK_SUMMARY)
      setOriginalText(FALLBACK_ORIGINAL_TEXT)
      setKeywords([...FALLBACK_KEYWORDS])
      navigateToTab('home')
      const fallbackName = deriveFallbackName(offlineSession.email)
      const shouldPrompt =
        !offlineSession.display_name ||
        offlineSession.display_name.toLowerCase() === fallbackName.toLowerCase()
      setIsNamePromptOpen(shouldPrompt)
      return offlineSession
    },
    [fallbackData]
  )

  // Activa datos demostrativos cuando la API no responde.
  const applyFallbackData = useCallback(() => {
    activateOfflineExperience()
  }, [activateOfflineExperience])

  // Restaura los valores iniciales antes de sincronizar con el backend.
  const resetCollections = useCallback(() => {
    setStats({ ...DEFAULT_STATS })
    setTasks([])
    setReminders([])
    setScheduleEntries([])
    setSummary('')
    setOriginalText('')
    setKeywords([])
    // CRÍTICO: Resetear gamificationStats para evitar data bleed entre usuarios
    setGamificationStats({
      tasksCompleted: 0,
      pomodoroSessions: 0,
      nightSessions: 0,
      morningSessions: 0,
      tripleDay: 0,
      maxTasksPerDay: 0,
      streakDays: 0
    })
    // También resetear estados derivados
    setXp(0)
    setStreakDays(0)
    setLastActivityDate(null)
    setUnlockedAchievements([])
    // Resetear contador acumulativo para el nuevo usuario
    setTotalTasksEverCompleted(0)
    localStorage.setItem('scolyax.totalTasksEverCompleted', '0')
    localStorage.removeItem('scolyax.achievements')
  }, [])

  // Retake cognitive test handler (called from CrisisMode)
  const handleRetakeTest = useCallback(() => {
    setShowCrisisMode(false)
    setHasCompletedTest(false)
    setIsNewUser(true)
    window.localStorage.setItem('scolyax.onboarding.hasCompletedTest', 'false')
    window.localStorage.setItem('scolyax.onboarding.isNewUser', 'true')
    window.localStorage.removeItem('scolyax.onboarding.recommendedTools')
    window.localStorage.removeItem('scolyax.onboarding.recommendedStudyMethod')
  }, [])

  // Cognitive test completion handler
  const handleTestComplete = useCallback(async (recommended, studyMethod, answers) => {
    console.log('✅ Test completed. Recommended tools:', recommended, '| Study method:', studyMethod)
    setRecommendedTools(recommended)
    setRecommendedStudyMethod(studyMethod || null)
    setHasCompletedTest(true)
    
    // Guardar respuestas para IrisResults
    setIrisTestAnswers(answers || [])
    
    // Marcar que el evaluador de ánimo ya fue "usado" en esta sesión
    // (el usuario acabó de completar el test por primera vez → saltar MoodEvaluator)
    try { sessionStorage.setItem('scolyax.moodEvaluated', 'true') } catch (e) { /* ignore */ }
    
    // Persist immediately to prevent loss on reload
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('scolyax.onboarding.recommendedTools', JSON.stringify(recommended))
      window.localStorage.setItem('scolyax.onboarding.hasCompletedTest', 'true')
      if (studyMethod) {
        window.localStorage.setItem('scolyax.onboarding.recommendedStudyMethod', studyMethod)
      }
    }
    
    // 🔥 CRITICAL: Mark test as completed in backend BEFORE showing loading screen
    // This ensures that if user reloads BEFORE selecting tool, they see tool selector, NOT test
    try {
      const sessionToken = window.localStorage.getItem('scolyax.sessionToken')
      if (sessionToken) {
        console.log('📤 Sending test-completed notification to backend (BLOCKING)...')
        const response = await fetch(`${API_URL}/api/onboarding-test-completed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            recommended_tools: recommended,
            recommended_study_method: studyMethod || null
          })
        })
        if (response.ok) {
          console.log('✅ Backend marked test as completed (confirmed)')
        } else {
          console.warn('⚠️ Failed to mark test as completed:', response.status)
        }
      }
    } catch (error) {
      console.error('❌ Error in test completion notification:', error)
    }
    
    // Mostrar IrisResults (análisis personalizado) ANTES de la loading screen
    setShowIrisResults(true)
  }, [])

  // Tool selection handler
  const handleToolSelection = useCallback(async (toolId) => {
    console.log('🎯 Tool selected:', toolId)
    
    // Map tool ID to tab ID and get tool info
    const toolToTab = {
      home: 'home',
      tasks: 'tasks',
      timer: 'timer',
      pomodoro: 'timer',
      reminders: 'reminders',
      schedule: 'calendar',
      summary: 'summary',
      achievements: 'tasks',
      crisis: '__crisis__'
    }
    
    const TOOLS = {
      home: { name: 'Inicio', icon: 'home' },
      tasks: { name: 'Tareas', icon: 'check' },
      timer: { name: 'Focus', icon: 'flow' },
      pomodoro: { name: 'Focus', icon: 'flow' },
      reminders: { name: 'Recordatorios', icon: 'clock' },
      schedule: { name: 'Horario', icon: 'calendar' },
      summary: { name: 'Resumen IA', icon: 'spark' },
      achievements: { name: 'Logros', icon: 'trophy' },
      crisis: { name: 'Modo Crisis', icon: 'sos' }
    }
    
    console.log('⏳ Waiting for fade-out animation (600ms)...')
    
    // Wait for ToolSelector fade-out (600ms) then show transition
    setTimeout(() => {
      console.log('✅ Fade-out complete, showing transition')
      
      // Hide selector and show transition
      setShowToolSelector(false)
      setTransitionData({
        tool: toolId,
        toolName: TOOLS[toolId]?.name || 'Dashboard',
        toolIcon: TOOLS[toolId]?.icon || 'rocket'
      })
      setShowDashboardTransition(true)
      
      console.log('📊 Transition data set:', {
        tool: toolId,
        toolName: TOOLS[toolId]?.name,
        showDashboardTransition: true
      })
      
      // Save to backend
      try {
        const sessionToken = window.localStorage.getItem('scolyax.sessionToken')
        if (sessionToken) {
          fetch(`${API_URL}/api/onboarding-complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
              selected_tool: toolId,
              recommended_tools: recommendedTools
            })
          }).then(response => {
            if (response.ok) {
              console.log('✅ Onboarding data saved successfully')
            } else {
              console.warn('⚠️ Failed to save onboarding data:', response.status)
            }
          }).catch(error => {
            console.error('❌ Error saving onboarding:', error)
          })
        }
      } catch (error) {
        console.error('❌ Error in onboarding save:', error)
      }
      
      console.log('⏳ Waiting 1.5s for transition animation...')
      
      // After 1.5 seconds, navigate to dashboard
      setTimeout(() => {
        console.log('✅ Transition complete, navigating to dashboard')
        const targetTab = toolToTab[toolId] || 'home'
        console.log('🔄 Setting activeTab to:', targetTab)
        
        // Si eligió Modo Crisis, ir a home y abrir overlay
        if (targetTab === '__crisis__') {
          navigateToTab('home')
          setShowCrisisMode(true)
        } else {
          navigateToTab(targetTab)
        }
        setIsNewUser(false)
        setShowDashboardTransition(false)
        
        console.log('🎉 Dashboard should now be visible!')
        
        // Clear onboarding flags from localStorage immediately
        if (typeof window !== 'undefined') {
          console.log('🧹 Saving onboarding completion to localStorage')
          // ✅ GUARDAR que se completó el test, NO eliminarlo
          window.localStorage.setItem('scolyax.onboarding.isNewUser', 'false')
          window.localStorage.setItem('scolyax.onboarding.hasCompletedTest', 'true')
          window.localStorage.setItem('scolyax.onboarding.showToolSelector', 'false')
          // Mantener las herramientas recomendadas
        }
      }, 1500) // 1.5 seconds transition
    }, 600) // Wait for ToolSelector fade-out
  }, [recommendedTools])

  // Mantiene sincronizado el modo oscuro con el DOM y el almacenamiento local.
  useEffect(() => {
    if (typeof document === 'undefined') return
    // Ensure we explicitly mark the body with either theme-dark or theme-light
    document.body.classList.toggle('theme-dark', Boolean(isDarkMode))
    document.body.classList.toggle('theme-light', !Boolean(isDarkMode))
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('scolyax.darkMode', isDarkMode ? '1' : '0')
    }
  }, [isDarkMode])

  // Auto-switch dark/light cada 60 s según la hora del día (solo en modo auto)
  useEffect(() => {
    if (themeMode !== 'auto') return
    const checkTime = () => {
      const shouldBeDark = isNightTime()
      setIsDarkMode(prev => {
        if (prev !== shouldBeDark) {
          console.log(`🌗 Auto-switch: ${shouldBeDark ? 'noche → dark' : 'día → light'}`)
          return shouldBeDark
        }
        return prev
      })
    }
    const id = setInterval(checkTime, 60_000) // revisa cada minuto
    return () => clearInterval(id)
  }, [themeMode])

  // Cambiar modo de tema (auto / light / dark)
  const handleThemeModeChange = useCallback((mode) => {
    setThemeMode(mode)
    localStorage.setItem('scolyax.themeMode', mode)
    if (mode === 'auto') {
      setIsDarkMode(isNightTime())
    } else {
      setIsDarkMode(mode === 'dark')
    }
  }, [])

  // Persist onboarding state to localStorage to survive page reloads
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    console.log('💾 Persisting onboarding state:', { isNewUser, hasCompletedTest, showToolSelector, recommendedTools, recommendedStudyMethod })
    
    window.localStorage.setItem('scolyax.onboarding.isNewUser', String(isNewUser))
    window.localStorage.setItem('scolyax.onboarding.hasCompletedTest', String(hasCompletedTest))
    window.localStorage.setItem('scolyax.onboarding.showToolSelector', String(showToolSelector))
    window.localStorage.setItem('scolyax.onboarding.recommendedTools', JSON.stringify(recommendedTools))
    if (recommendedStudyMethod) {
      window.localStorage.setItem('scolyax.onboarding.recommendedStudyMethod', recommendedStudyMethod)
    }
  }, [isNewUser, hasCompletedTest, showToolSelector, recommendedTools, recommendedStudyMethod])

  // Clear onboarding navigation state when user completes the full flow
  // IMPORTANT: Keep hasCompletedTest and recommendedTools permanently so 
  // ToolSelector always shows on next page load
  useEffect(() => {
    if (!isNewUser && !showToolSelector && typeof window !== 'undefined') {
      console.log('✅ Tool selected - clearing navigation flags (keeping test completion)')
      window.localStorage.removeItem('scolyax.onboarding.isNewUser')
      window.localStorage.removeItem('scolyax.onboarding.showToolSelector')
      // ✅ KEEP hasCompletedTest = 'true' → so showToolSelector initializes as true on next reload
      // ✅ KEEP recommendedTools → so Iris's picks always appear in ToolSelector
    }
  }, [isNewUser, showToolSelector])

  // Prevent navigation away during cognitive test only (not during tool selector)
  useEffect(() => {
    // Only show warning during the cognitive test, NOT during tool selector
    // Tool selector shows every session - blocking reload would be annoying
    if (!isNewUser || hasCompletedTest) return
    
    const handleBeforeUnload = (e) => {
      // Show browser warning when trying to leave during cognitive test
      e.preventDefault()
      e.returnValue = '¿Estás seguro de que quieres salir? Perderás tu progreso en el test.'
      return e.returnValue
    }
    
    const handlePopState = (e) => {
      // Prevent back button from leaving the cognitive test
      if (isNewUser && !hasCompletedTest) {
        console.log('⚠️ Navigation blocked - cognitive test in progress')
        window.history.pushState(null, '', window.location.href)
      }
    }
    
    // Push initial state to prevent back button
    window.history.pushState(null, '', window.location.href)
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isNewUser, hasCompletedTest])

  // Close mobile sidebar when clicking outside (mobile menu click-outside handler)
  useEffect(() => {
    if (!isSidebarOpen) return
    
    const handleClickOutside = (e) => {
      const sidebar = document.querySelector('.dashboard-sidebar')
      const toggleButton = document.querySelector('[data-sidebar-toggle]')
      
      // Close sidebar only if click is outside of sidebar and toggle button
      if (sidebar && !sidebar.contains(e.target) && (!toggleButton || !toggleButton.contains(e.target))) {
        setIsSidebarOpen(false)
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isSidebarOpen])

  // ── Mobile Sidebar Drag-to-Reveal Gesture ──
  const sidebarSwipeRef = useRef({ startX: 0, startY: 0, startTime: 0, tracking: false, source: null })
  const sidebarDragRef = useRef(null) // ref to the sidebar DOM element
  const overlayDragRef = useRef(null) // ref to the overlay DOM element
  const [showSwipeHint, setShowSwipeHint] = useState(false)
  const swipeHintTimerRef = useRef(null)
  const swipeHintCountRef = useRef(0)
  const swipeHintDismissedRef = useRef(false)
  const SIDEBAR_WIDTH = 280

  // Real-time drag gesture: tracks finger movement and progressively reveals sidebar
  useEffect(() => {
    const isMobile = () => window.innerWidth <= 768

    const handleTouchStart = (e) => {
      if (!isMobile()) return
      const touch = e.touches[0]
      const startX = touch.clientX
      const sidebar = document.querySelector('.dashboard-sidebar')
      const edgeTab = document.querySelector('.sidebar-edge-tab')

      // Determine if this is a valid drag start:
      // 1. From the left 30px edge of the screen (to open)
      // 2. From the edge tab (to open OR close depending on sidebar state)
      // 3. From within the open sidebar (to close by swiping left)
      // 4. From the overlay (to close)
      let source = null
      if (edgeTab && edgeTab.contains(e.target)) {
        source = isSidebarOpen ? 'edge-tab-close' : 'edge-tab'
      } else if (isSidebarOpen && sidebar && !sidebar.contains(e.target)) {
        source = 'overlay'
      } else if (isSidebarOpen && sidebar && sidebar.contains(e.target)) {
        source = 'sidebar-close'
      }

      if (!source) return

      sidebarSwipeRef.current = {
        startX,
        startY: touch.clientY,
        startTime: Date.now(),
        tracking: true,
        source
      }

      // Disable CSS transition for real-time drag feel
      if (sidebar) sidebar.style.transition = 'none'
      const overlay = document.querySelector('.sidebar-overlay')
      if (overlay) overlay.style.transition = 'none'
      // Also disable transition on edge tab for smooth drag tracking
      const edgeTabForDrag = document.querySelector('.sidebar-edge-tab')
      if (edgeTabForDrag) edgeTabForDrag.style.transition = 'none'
    }

    const handleTouchMove = (e) => {
      if (!isMobile() || !sidebarSwipeRef.current.tracking) return
      const touch = e.touches[0]
      const { startX, startY, source } = sidebarSwipeRef.current
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY

      // Cancel if vertical scrolling
      if (Math.abs(dy) > Math.abs(dx) + 10) {
        sidebarSwipeRef.current.tracking = false
        resetSidebarPosition()
        return
      }

      const sidebar = document.querySelector('.dashboard-sidebar')
      const overlay = document.querySelector('.sidebar-overlay')
      if (!sidebar) return

      let newLeft
      if (source === 'edge' || source === 'edge-tab') {
        // Opening: sidebar starts at -280, finger drags right
        newLeft = Math.min(0, Math.max(-SIDEBAR_WIDTH, -SIDEBAR_WIDTH + dx))
      } else if (source === 'edge-tab-close') {
        // Closing from edge tab: sidebar starts at 0, finger drags left
        newLeft = Math.min(0, Math.max(-SIDEBAR_WIDTH, dx))
      } else {
        // Closing: sidebar starts at 0, finger drags left
        newLeft = Math.min(0, Math.max(-SIDEBAR_WIDTH, dx))
      }

      sidebar.style.transform = `translateX(${newLeft}px)`

      // Calculate progress: 0 = fully closed, 1 = fully open
      const progress = (SIDEBAR_WIDTH + newLeft) / SIDEBAR_WIDTH

      // Rotate the edge tab arrow based on drag progress (0° → 180°)
      const edgeTabArrow = document.querySelector('.sidebar-edge-tab__arrow')
      if (edgeTabArrow) {
        edgeTabArrow.style.transition = 'none'
        edgeTabArrow.style.transform = `rotate(${progress * 180}deg)`
      }

      // Move edge tab with the sidebar
      const edgeTab = document.querySelector('.sidebar-edge-tab')
      if (edgeTab) {
        edgeTab.style.transition = 'none'
        edgeTab.style.left = `${Math.max(0, SIDEBAR_WIDTH + newLeft)}px`
      }

      // Update overlay opacity proportionally
      if (overlay) {
        overlay.style.opacity = progress * 1
        overlay.style.pointerEvents = progress > 0.05 ? 'auto' : 'none'
      }
    }

    const handleTouchEnd = (e) => {
      if (!isMobile() || !sidebarSwipeRef.current.tracking) return
      sidebarSwipeRef.current.tracking = false

      const touch = e.changedTouches[0]
      const { startX, startTime, source } = sidebarSwipeRef.current
      const dx = touch.clientX - startX
      const elapsed = Date.now() - startTime
      const velocity = Math.abs(dx) / elapsed // px/ms

      const sidebar = document.querySelector('.dashboard-sidebar')
      const overlay = document.querySelector('.sidebar-overlay')

      // Re-enable CSS transition for snap animation
      const edgeTabArrow = document.querySelector('.sidebar-edge-tab__arrow')
      const edgeTabEl = document.querySelector('.sidebar-edge-tab')
      if (sidebar) sidebar.style.transition = ''
      if (overlay) overlay.style.transition = ''
      if (edgeTabArrow) { edgeTabArrow.style.transition = ''; edgeTabArrow.style.transform = '' }
      if (edgeTabEl) { edgeTabEl.style.transition = ''; edgeTabEl.style.left = '' }

      // Helper: clear ALL inline drag styles so CSS classes take over
      const clearDragStyles = () => {
        if (sidebar) sidebar.style.transform = ''
        if (overlay) { overlay.style.opacity = ''; overlay.style.pointerEvents = '' }
      }

      // Determine if we should open or close
      if (source === 'edge' || source === 'edge-tab') {
        // Opening gesture: open if dragged >30% of sidebar width OR fast flick
        const shouldOpen = dx > SIDEBAR_WIDTH * 0.3 || (velocity > 0.4 && dx > 30)
        clearDragStyles()
        if (shouldOpen) {
          setIsSidebarOpen(true)
          setShowSwipeHint(false)
          swipeHintDismissedRef.current = true
        }
      } else if (source === 'edge-tab-close') {
        // Edge tab close gesture: close if dragged left >30% OR fast flick left
        const shouldClose = dx < -(SIDEBAR_WIDTH * 0.3) || (velocity > 0.4 && dx < -30)
        clearDragStyles()
        if (shouldClose) {
          setIsSidebarOpen(false)
        }
      } else {
        // Closing gesture (overlay, sidebar-close): close if dragged left >30% OR fast flick left
        const shouldClose = dx < -(SIDEBAR_WIDTH * 0.3) || (velocity > 0.4 && dx < -30)
        clearDragStyles()
        if (shouldClose) {
          setIsSidebarOpen(false)
        }
      }
    }

    const resetSidebarPosition = () => {
      const sidebar = document.querySelector('.dashboard-sidebar')
      const overlay = document.querySelector('.sidebar-overlay')
      const edgeTabArrow = document.querySelector('.sidebar-edge-tab__arrow')
      const edgeTab = document.querySelector('.sidebar-edge-tab')
      if (sidebar) { sidebar.style.transition = ''; sidebar.style.transform = '' }
      if (overlay) { overlay.style.transition = ''; overlay.style.opacity = ''; overlay.style.pointerEvents = '' }
      if (edgeTabArrow) { edgeTabArrow.style.transition = ''; edgeTabArrow.style.transform = '' }
      if (edgeTab) { edgeTab.style.transition = ''; edgeTab.style.left = '' }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isSidebarOpen])

  // Periodic swipe hint reminder (shows every 45s for first 4 times, then stops)
  useEffect(() => {
    const isMobile = () => window.innerWidth <= 768
    if (!isMobile()) return

    // Show the first hint after 3 seconds
    const initialTimer = setTimeout(() => {
      if (!isSidebarOpen && !swipeHintDismissedRef.current) {
        setShowSwipeHint(true)
        swipeHintCountRef.current = 1

        // Auto-hide after 4s
        setTimeout(() => setShowSwipeHint(false), 4000)
      }
    }, 3000)

    // Recurring reminder every 45 seconds
    swipeHintTimerRef.current = setInterval(() => {
      if (swipeHintDismissedRef.current || swipeHintCountRef.current >= 4) {
        clearInterval(swipeHintTimerRef.current)
        return
      }
      if (!isSidebarOpen) {
        setShowSwipeHint(true)
        swipeHintCountRef.current += 1
        setTimeout(() => setShowSwipeHint(false), 4000)
      }
    }, 45000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(swipeHintTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Registrar Service Worker para push notifications
  useEffect(() => {
    registerServiceWorker()
  }, [])

  // Auto-iniciar suscripción push cuando hay sesión activa
  useEffect(() => {
    if (session) {
      import('./services/pushService.js').then(({ initPushNotifications }) => {
        initPushNotifications()
      }).catch(() => {})
    }
  }, [session])

  // Manejar la pantalla de carga después de completar test o al login con test completado
  useEffect(() => {
    if (!showLoadingScreenAfterLogin) return
    
    console.log('⏳ Loading screen activated after test completion or login')
    
    // La pantalla de carga se cierra automáticamente cuando onLoadingComplete se ejecuta
  }, [showLoadingScreenAfterLogin])

  // Cuando la pantalla de carga se completa, mostrar el selector de herramientas
  const handleLoadingScreenComplete = useCallback(() => {
    console.log('✅ Loading screen complete - checking mood evaluator')
    setShowLoadingScreenAfterLogin(false)

    // Para usuarios RECURRENTES: mostrar evaluador de ánimo UNA VEZ por sesión
    const isReturningUser = session?.has_completed_onboarding === true && !isNewUser
    const alreadyCheckedMood = (() => {
      try { return sessionStorage.getItem('scolyax.moodEvaluated') === 'true' } catch { return false }
    })()

    if (isReturningUser && !alreadyCheckedMood) {
      console.log('😊 Showing MoodEvaluator for returning user')
      setShowMoodEvaluator(true)
    } else {
      console.log('🔧 Showing ToolSelector directly')
      setShowToolSelector(true)
    }
  }, [session, isNewUser])

  // Solicitar permisos de notificaciones cuando el usuario inicia sesión
  useEffect(() => {
    if (session && !session.isMock) {
      // Esperar 2 segundos después del login para no ser intrusivo
      const timer = setTimeout(async () => {
        const hasAskedBefore = localStorage.getItem('scolyax.notificationPermissionAsked')
        
        console.log('[App] 🔔 Verificando permisos de notificación...')
        console.log('[App] - Navegador soporta Notification:', 'Notification' in window)
        console.log('[App] - Estado actual:', Notification?.permission)
        console.log('[App] - Ya se preguntó antes:', !!hasAskedBefore)
        console.log('[App] - Protocolo:', window.location.protocol)
        console.log('[App] - Hostname:', window.location.hostname)
        
        // Solo preguntar si no se ha preguntado antes
        if (!hasAskedBefore && Notification.permission === 'default') {
          console.log('[App] 📢 Solicitando permisos de notificación...')
          const permission = await requestNotificationPermission()
          localStorage.setItem('scolyax.notificationPermissionAsked', 'true')
          
          if (permission === 'granted') {
            console.log('[App] ✅ Notificaciones activadas correctamente')
          } else {
            console.log('[App] ❌ Notificaciones rechazadas o no disponibles:', permission)
          }
        } else {
          console.log('[App] ⏭️ No se solicitan permisos (ya preguntado o ya concedidos/denegados)')
        }
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [session])

  // Sincronizar XP con localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('scolyax.xp', xp.toString())
    }
  }, [xp])

  // Sincronizar rachas con localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('scolyax.streak', streakDays.toString())
    }
  }, [streakDays])

  // Sincronizar contador acumulativo de tareas con localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('scolyax.totalTasksEverCompleted', totalTasksEverCompleted.toString())
    }
  }, [totalTasksEverCompleted])

  // Sincronizar última actividad con localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && lastActivityDate) {
      localStorage.setItem('scolyax.lastActivity', lastActivityDate)
    }
  }, [lastActivityDate])

  // Sincronizar logros desbloqueados desde localStorage
  // Se ejecuta cada vez que se completa una tarea (cuando gamificationStats cambia)
  // para que el nuevo icono se muestre inmediatamente en TaskList
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('scolyax.achievements')
      if (stored) {
        try {
          const achievements = JSON.parse(stored)
          // Solo actualizar si hay cambios
          setUnlockedAchievements((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(achievements)) {
              console.log('📢 Achievements updated:', achievements)
              return achievements
            }
            return prev
          })
        } catch (e) {
          console.warn('Error parsing achievements from localStorage:', e)
        }
      }
    }
  }, [gamificationStats.tasksCompleted])

  // Cargar estadísticas de gamificación desde el backend cuando la sesión cambia
  useEffect(() => {
    if (!session || isOfflineMode) return

    const loadUserStats = async () => {
      try {
        const token = localStorage.getItem('scolyax.sessionToken')
        if (!token) {
          console.warn('⚠️ No session token found')
          return
        }

        console.log(`🔄 Loading user stats from backend for ${session.email}...`)
        const response = await fetch(`${API_URL}/user-stats`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const stats = await response.json()
          console.log('📥 Loaded user stats from backend:', stats)
          console.log('   XP:', stats.xp)
          console.log('   Streak Days:', stats.streak_days)
          console.log('   Total Tasks Ever:', stats.total_tasks_ever_completed)
          console.log('   🏆 Achievements:', stats.unlocked_achievements?.length || 0, stats.unlocked_achievements)
          
          // Actualizar estado local con datos del backend
          if (stats.xp !== undefined) setXp(stats.xp)
          if (stats.streak_days !== undefined) setStreakDays(stats.streak_days)
          if (stats.last_activity_date) setLastActivityDate(stats.last_activity_date)
          if (stats.total_tasks_ever_completed !== undefined) setTotalTasksEverCompleted(stats.total_tasks_ever_completed)
          if (stats.unlocked_achievements && Array.isArray(stats.unlocked_achievements)) {
            console.log(`✅ Setting ${stats.unlocked_achievements.length} achievements:`, stats.unlocked_achievements)
            setUnlockedAchievements(stats.unlocked_achievements)
          }
          
          // Guardar en localStorage también (backup)
          localStorage.setItem('scolyax.xp', stats.xp.toString())
          localStorage.setItem('scolyax.streak', stats.streak_days.toString())
          if (stats.last_activity_date) localStorage.setItem('scolyax.lastActivity', stats.last_activity_date)
          localStorage.setItem('scolyax.totalTasksEverCompleted', stats.total_tasks_ever_completed.toString())
          localStorage.setItem('scolyax.achievements', JSON.stringify(stats.unlocked_achievements || []))
          console.log('✅ User stats cached to localStorage')
          setUserStatsLoaded(true)
        } else {
          console.error(`❌ Failed to load user stats: ${response.status}`, await response.text())
          setUserStatsLoaded(true) // permitir que la racha se evalúe aunque falle
        }
      } catch (error) {
        console.error('❌ Error loading user stats from backend:', error)
        // Continuar con datos locales si el backend no está disponible
        setUserStatsLoaded(true)
      }
    }

    loadUserStats()
  }, [session?.email, isOfflineMode])

  // Cargar sesiones de estudio (pomodoroSessions) desde el backend
  useEffect(() => {
    if (!session || isOfflineMode) return

    const loadFocusSessions = async () => {
      try {
        const token = localStorage.getItem('scolyax.sessionToken')
        if (!token) {
          console.warn('⚠️ No session token found for loading focus sessions')
          return
        }

        console.log(`🔄 Loading focus sessions from backend for ${session.email}...`)
        const response = await fetch(`${API_URL}/focus-sessions`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const sessions = await response.json()
          console.log('📥 Loaded focus sessions from backend:', sessions.length, 'sessions')
          
          // Actualizar el contador de sesiones de estudio
          setGamificationStats((prev) => ({
            ...prev,
            pomodoroSessions: sessions.length
          }))
          
          // Guardar en localStorage también (backup)
          localStorage.setItem('scolyax.pomodoroSessions', sessions.length.toString())
          console.log('✅ Pomodo sessions cached to localStorage:', sessions.length)
        } else {
          console.error(`❌ Failed to load focus sessions: ${response.status}`, await response.text())
        }
      } catch (error) {
        console.error('❌ Error loading focus sessions from backend:', error)
      }
    }

    loadFocusSessions()
  }, [session?.email, isOfflineMode])

  // Guardar estadísticas de gamificación en el backend cada vez que cambian
  useEffect(() => {
    if (!session || isOfflineMode) return

    // Debounce: esperar 2 segundos antes de guardar para no hacer requests excesivos
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('scolyax.sessionToken')
        if (!token) {
          console.warn('⚠️ No session token found for saving stats')
          return
        }

        console.log(`💾 Saving user stats for ${session.email}...`)
        console.log('   XP:', xp)
        console.log('   Streak Days:', streakDays)
        console.log('   Total Tasks Ever:', totalTasksEverCompleted)
        console.log('   🏆 Achievements:', unlockedAchievements?.length || 0, unlockedAchievements)

        const response = await fetch(`${API_URL}/user-stats`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            xp,
            streak_days: streakDays,
            last_activity_date: lastActivityDate,
            total_tasks_ever_completed: totalTasksEverCompleted,
            unlocked_achievements: unlockedAchievements || []
          })
        })

        if (response.ok) {
          console.log('✅ Saved user stats to backend successfully')
        } else {
          const errorText = await response.text()
          console.error(`❌ Failed to save user stats: ${response.status}`, errorText)
        }
      } catch (error) {
        console.error('❌ Error saving user stats to backend:', error)
      }
    }, 2000) // Esperar 2 segundos después del último cambio

    return () => clearTimeout(timer)
  }, [xp, streakDays, lastActivityDate, totalTasksEverCompleted, unlockedAchievements, session, isOfflineMode])

  // Actualizar gamification stats desde tasks y stats
  useEffect(() => {
    // IMPORTANTE: Usar el contador ACUMULATIVO de tareas completadas
    // Esto asegura que los logros se basan en el progreso histórico, no en tareas actuales
    setGamificationStats((prev) => ({
      ...prev,
      tasksCompleted: totalTasksEverCompleted,
      streakDays
    }))
  }, [totalTasksEverCompleted, streakDays])

  // Función para verificar y actualizar rachas diarias
  const updateStreakAndActivity = useCallback(() => {
    if (!session || isOfflineMode) return
    // Esperar a que los stats del backend se carguen para evitar
    // tratar a un usuario recurrente como nuevo (race condition al limpiar caché)
    if (!userStatsLoaded) return

    const today = new Date().toISOString().split('T')[0]
    
    // ✅ NUEVA LÓGICA: Verificar milestones incluso si es el mismo día
    // Esto es importante cuando la página se recarga en el mismo día
    if (streakDays > 0) {
      const milestone = STREAK_MILESTONES.find(m => m.days === streakDays)
      if (milestone) {
        const shownMilestones = JSON.parse(localStorage.getItem('scolyax.shownMilestones') || '[]')
        const milestoneKey = `streak_${streakDays}_${today}`
        
        if (!shownMilestones.includes(milestoneKey)) {
          console.log('🔥 STREAK MILESTONE CHECK:', milestone.name, 'Días:', streakDays, 'Hoy:', today)
          setStreakMilestoneToShow(milestone)
          shownMilestones.push(milestoneKey)
          localStorage.setItem('scolyax.shownMilestones', JSON.stringify(shownMilestones))
        }
      }
    }
    
    // Solo actualizar si el día cambió
    if (lastActivityDate && lastActivityDate === today) {
      // Es el mismo día, ya verificamos milestones arriba
      return
    }

    if (lastActivityDate && lastActivityDate !== today) {
      const lastDate = new Date(lastActivityDate)
      const currentDate = new Date(today)
      const diffTime = currentDate - lastDate
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        // Racha continúa (actividad ayer, hoy es el siguiente día)
        const newStreak = streakDays + 1
        setStreakDays(newStreak)
        
        // ⏰ Enviar notificación con un pequeño delay para que el UI se actualice primero
        setTimeout(() => {
          sendStreakNotification(newStreak)
        }, 500)
        
        // Verificar si se completó un hito de racha
        const milestone = STREAK_MILESTONES.find(m => m.days === newStreak)
        if (milestone) {
          // Verificar si ya se mostró este milestone para evitar repeticiones
          const shownMilestones = JSON.parse(localStorage.getItem('scolyax.shownMilestones') || '[]')
          const milestoneKey = `streak_${newStreak}_${today}`
          
          if (!shownMilestones.includes(milestoneKey)) {
            console.log('🔥 STREAK MILESTONE REACHED:', milestone.name, 'Días:', newStreak)
            setStreakMilestoneToShow(milestone)
            // Guardar que ya se mostró este milestone
            shownMilestones.push(milestoneKey)
            localStorage.setItem('scolyax.shownMilestones', JSON.stringify(shownMilestones))
          }
        }
      } else if (diffDays > 1) {
        // Racha rota (más de 1 día sin actividad)
        const lostStreak = streakDays
        setStreakDays(0)
        if (lostStreak > 0) {
          sendStreakLostNotification(lostStreak)
        }
      }
    } else if (!lastActivityDate) {
      // Primera actividad, empezar racha
      setStreakDays(1)
      
      // ⏰ Enviar notificación con un pequeño delay para que el UI se actualice primero
      setTimeout(() => {
        sendStreakNotification(1)
      }, 500)
      
      // El primer día también es un hito
      const milestone = STREAK_MILESTONES.find(m => m.days === 1)
      if (milestone) {
        // Verificar si ya se mostró el milestone del primer día
        const shownMilestones = JSON.parse(localStorage.getItem('scolyax.shownMilestones') || '[]')
        const milestoneKey = `streak_1_${today}`
        
        if (!shownMilestones.includes(milestoneKey)) {
          console.log('🔥 STREAK MILESTONE REACHED:', milestone.name, 'Días: 1')
          setStreakMilestoneToShow(milestone)
          // Guardar que ya se mostró este milestone
          shownMilestones.push(milestoneKey)
          localStorage.setItem('scolyax.shownMilestones', JSON.stringify(shownMilestones))
        }
      }
    }

    setLastActivityDate(today)
  }, [session, isOfflineMode, lastActivityDate, streakDays, userStatsLoaded, sendStreakNotification, sendStreakLostNotification])

  // Ejecutar verificación de racha automáticamente
  useEffect(() => {
    updateStreakAndActivity()
  }, [updateStreakAndActivity])

  // Handler para otorgar XP
  const awardXP = useCallback((amount, reason) => {
    setXp((prev) => {
      const newXP = prev + amount
      console.log(`[XP] +${amount} por ${reason}. Total: ${newXP}`)
      return newXP
    })
  }, [])

  // Handler cuando se desbloquea un logro
  const handleAchievementUnlocked = useCallback((achievement) => {
    console.log('[Achievement Unlocked]', achievement.name)
    console.log('🎯 Disparando celebración para:', achievement.name, achievement)
    // Otorgar XP bonus por logro
    awardXP(50, `Logro: ${achievement.name}`)
    // Actualizar la lista de logros desbloqueados
    setUnlockedAchievements((prev) => {
      if (!prev.includes(achievement.id)) {
        return [...prev, achievement.id]
      }
      return prev
    })
    
    // Mostrar celebración de logro (global, visible en cualquier pestaña)
    console.log('🎉 Mostrando celebración de logro...')
    setAchievementToCelebrate(achievement)
    setShowAchievementCelebration(true)
    console.log('✅ Estados de celebración actualizados')
  }, [awardXP])

  // ✅ Sincronizar tareas pendientes cuando Railway vuelve a estar disponible
  useEffect(() => {
    const syncPendingTasks = async () => {
      const pendingTasks = JSON.parse(localStorage.getItem('scolyax.pendingTasks') || '[]')
      
      if (pendingTasks.length === 0 || !session || isOfflineMode) {
        return
      }

      console.log(`📤 Intentando sincronizar ${pendingTasks.length} tareas pendientes...`)

      for (const task of pendingTasks) {
        try {
          console.log(`🔄 Sincronizando tarea pendiente:`, task.title)
          
          const response = await authenticatedFetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: 0,
              title: task.title,
              course: task.course,
              due_date: task.due_date,
              status: task.status,
              notes: task.notes,
              tags: task.tags
            })
          })

          if (!response.ok) {
            console.error(`❌ Error sincronizando tarea ${task.title}:`, response.status)
            continue
          }

          const syncedTask = await response.json()
          console.log(`✅ Tarea sincronizada exitosamente:`, syncedTask.id)

          // Actualizar la tarea en el estado para que use el ID del servidor
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? syncedTask : t
            )
          )

          // Remover de la lista de pendientes
          const updated = pendingTasks.filter((t) => t.id !== task.id)
          localStorage.setItem('scolyax.pendingTasks', JSON.stringify(updated))
        } catch (error) {
          console.error(`❌ Error sincronizando tarea ${task.title}:`, error.message)
          // Continuar con las siguientes tareas
        }
      }

      const remainingTasks = JSON.parse(localStorage.getItem('scolyax.pendingTasks') || '[]')
      if (remainingTasks.length === 0) {
        console.log('✅ Todas las tareas pendientes fueron sincronizadas')
      } else {
        console.log(`⚠️ ${remainingTasks.length} tareas aún pendientes de sincronizar`)
      }
    }

    // Sincronizar cuando la pestaña vuelve a ser visible, y cada 30s (en vez de 5s)
    const smartSync = () => {
      if (document.visibilityState === 'visible') syncPendingTasks()
    }
    document.addEventListener('visibilitychange', smartSync)
    window.addEventListener('online', syncPendingTasks)
    const interval = setInterval(smartSync, 30000)

    // Sincronizar inmediatamente al montar
    syncPendingTasks()

    return () => {
      document.removeEventListener('visibilitychange', smartSync)
      window.removeEventListener('online', syncPendingTasks)
      clearInterval(interval)
    }
  }, [session, isOfflineMode])

  // Recupera la sesión activa al inicializar la aplicación.
  useEffect(() => {
    const fetchSession = async () => {
      console.time('⏱️ Full session initialization')
      setIsLoading(true) // Start loading when checking session
      try {
        // Obtener token desde localStorage (puede venir del OAuth callback o sesión anterior)
        const sessionToken = window.localStorage.getItem('scolyax.sessionToken')
        console.log('Session check - Token available:', !!sessionToken)
        
        // Si hay token, intentar restaurar desde caché primero
        // PERO SIEMPRE VALIDAR CON BACKEND para evitar data bleed entre usuarios
        if (sessionToken) {
          const cachedSession = window.localStorage.getItem('scolyax.session')
          if (cachedSession) {
            try {
              const sessionData = JSON.parse(cachedSession)
              // IMPORTANTE: No confiar en el caché sin validar con backend
              // Validar que el token sea válido llamando al backend
              if (sessionData && !sessionData.isMock) {
                console.log('⚠️  Cached session found, validating with backend:', sessionData.email)
                // NO restaurar directamente del caché - validar primero
                // Esto previene data bleed si el caché es de otro usuario
              }
            } catch (e) {
              console.warn('Cache corrupted, fetching from backend')
              window.localStorage.removeItem('scolyax.session')
            }
          }
        }

        // Si no hay caché válido, fetch del backend con token si existe
        console.time('⏱️ Backend /session API call')
        console.log('Fetching session from backend...')
        const headers = sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}
        console.log('📤 Request headers:', { Authorization: sessionToken ? 'Bearer ' + sessionToken.substring(0, 20) + '...' : 'none' })
        
        const response = await fetch(`${API_URL}/session`, { 
          headers
        })
        console.timeEnd('⏱️ Backend /session API call')
        
        console.log('📥 Backend response status:', response.status)
        
        if (!response.ok) {
          console.log('Backend returned error:', response.status)
          setIsBackendReachable(true)
          setIsSessionLoading(false)
          console.timeEnd('⏱️ Full session initialization')
          return
        }
        
        const data = await response.json()
        console.log('📥 Backend response data:', data ? { email: data.email, hasToken: !!data.session_token } : 'null')
        
        if (data) {
          setIsBackendReachable(true)
          setIsOfflineMode(false)
          setSession(data)
          window.localStorage.setItem('scolyax.session', JSON.stringify(data))
          if (data.session_token) {
            window.localStorage.setItem('scolyax.sessionToken', data.session_token)
          }
          console.log('✅ Session established for:', data.email)
          console.timeEnd('⏱️ Full session initialization')
          
          // Verificar si el usuario es administrador
          if (data.email === 'appscolyax@gmail.com') {
            console.log('🔑 Admin access detected - redirecting to admin panel')
            // Guardar datos de admin en localStorage
            window.localStorage.setItem('authUser', JSON.stringify({
              email: data.email,
              name: data.display_name || 'Administrador',
              sessionToken: data.session_token
            }))
            // Redirigir al panel administrativo
            // Intentar múltiples rutas posibles
            setTimeout(() => {
              const possiblePaths = [
                '/admin.html',
                './admin.html',
                '/public/admin.html',
                '/frontend/admin.html'
              ]
              
              // Por ahora usar la primera (más común)
              window.location.href = '/admin.html'
              
              // Si no funciona después de 2 segundos, intentar alternativa
              setTimeout(() => {
                console.log('⚠️ Admin redirect failed, trying alternative path')
                window.location.href = window.location.origin + '/admin.html'
              }, 2000)
            }, 100)
            return
          }
          
          // ✅ BACKEND ES LA FUENTE DE VERDAD
          // No usar localStorage para decisiones de autorización
          // localStorage solo para UI transitions durante el flujo actual
          
          console.log('🔐 Checking onboarding status from BACKEND:', {
            has_completed_onboarding: data.has_completed_onboarding,
            recommended_tools: data.recommended_tools
          })
          
          if (data.has_completed_onboarding === true) {
            // ✅ Test completado → sincronizar herramientas recomendadas
            console.log('✅ Backend: TEST COMPLETADO → mostrando loading screen → selector')
            
            // Sincronizar recommended_tools del backend
            let recommendedArray = []
            if (data.recommended_tools) {
              recommendedArray = Array.isArray(data.recommended_tools) 
                ? data.recommended_tools 
                : (typeof data.recommended_tools === 'string' 
                    ? (() => { try { return JSON.parse(data.recommended_tools) } catch { return [] } })()
                    : [])
            }
            // Fallback: intentar cargar de localStorage si el backend no tiene datos
            if (recommendedArray.length === 0) {
              const savedRecommended = window.localStorage.getItem('scolyax.onboarding.recommendedTools')
              if (savedRecommended) {
                try {
                  const parsed = JSON.parse(savedRecommended)
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    recommendedArray = parsed
                    console.log('📋 Usando herramientas recomendadas de localStorage (fallback):', parsed)
                  }
                } catch (e) { /* ignore parse error */ }
              }
            }
            
            if (recommendedArray.length > 0) {
              // ✅ Tenemos recomendaciones → mostrar loading screen → selector de herramientas
              setHasCompletedTest(true)
              setRecommendedTools(recommendedArray)
              window.localStorage.setItem('scolyax.onboarding.recommendedTools', JSON.stringify(recommendedArray))
              setShowLoadingScreenAfterLogin(true)
              window.localStorage.setItem('scolyax.onboarding.hasCompletedTest', 'true')
              window.localStorage.setItem('scolyax.onboarding.showToolSelector', 'true')
            } else {
              // ⚠️ Sin recomendaciones guardadas → re-hacer el test cognitivo para obtenerlas
              console.log('⚠️ has_completed_onboarding=true pero recommended_tools vacío → rehacer test')
              window.localStorage.removeItem('scolyax.onboarding.hasCompletedTest')
              window.localStorage.removeItem('scolyax.onboarding.showToolSelector')
              window.localStorage.removeItem('scolyax.onboarding.recommendedTools')
              setIsNewUser(true)
              setHasCompletedTest(false)
              setShowToolSelector(false)
              setShowOnboardingLoader(true)
              setIsLoaderFadingOut(false)
              
              // After 2.2s, fade out loader and show the cognitive test
              setTimeout(() => {
                setIsLoaderFadingOut(true)
                setTimeout(() => {
                  setShowOnboardingLoader(false)
                  setIsLoaderFadingOut(false)
                  setIsNewUser(true)
                  setHasCompletedTest(false)
                  window.localStorage.setItem('scolyax.onboarding.isNewUser', 'true')
                  window.localStorage.setItem('scolyax.onboarding.hasCompletedTest', 'false')
                }, 800)
              }, 2200)
            }
          } else if (data.has_completed_onboarding === false) {
            // ✅ Backend confirma NOT completed: mostrar test obligatorio
            console.log('🆕 Backend confirma: ONBOARDING PENDIENTE - mostrar test')
            
            // CRÍTICO: Limpiar localStorage para que no interfiera
            window.localStorage.removeItem('scolyax.onboarding.hasCompletedTest')
            window.localStorage.removeItem('scolyax.onboarding.showToolSelector')
            window.localStorage.removeItem('scolyax.onboarding.recommendedTools')
            
            setIsNewUser(true)
            setHasCompletedTest(false)
            setShowToolSelector(false)
            
            // Show loader first
            setShowOnboardingLoader(true)
            setIsLoaderFadingOut(false)
            
            // After 2.2 seconds, start fade-out animation
            setTimeout(() => {
              setIsLoaderFadingOut(true)
              
              // After fade-out animation completes (0.8s), change to test
              setTimeout(() => {
                setShowOnboardingLoader(false)
                setIsLoaderFadingOut(false)
                setIsNewUser(true)
                setHasCompletedTest(false)
                // Persist this to localStorage immediately
                window.localStorage.setItem('scolyax.onboarding.isNewUser', 'true')
                window.localStorage.setItem('scolyax.onboarding.hasCompletedTest', 'false')
              }, 800) // Match fade-out animation duration
            }, 2200) // Show loader for 2.2s before starting fade-out
          } else {
            console.log('👤 Estado onboarding desconocido - skip onboarding')
            navigateToTab('home')
          }
        }
      } catch (error) {
        console.error('Session error:', error)
        setIsBackendReachable(false)
        applyFallbackData()
      } finally {
        setIsSessionLoading(false)
        setIsLoading(false) // End loading when session check completes
      }
    }

    fetchSession()
  }, [applyFallbackData])

  useEffect(() => {
    if (!session) {
      setIsNamePromptOpen(false)
      // CRITICAL: Only clear localStorage if session loading is complete (not during initial load)
      // This prevents clearing userAvatar during page reload when session is temporarily null
      if (typeof window !== 'undefined' && !isSessionLoading) {
        const currentSession = window.localStorage.getItem('scolyax.session')
        if (currentSession) {
          // Si localStorage aún tiene sesión pero el estado es null, limpiar TODOS los datos del usuario
          // This only happens during explicit logout or after failed session load
          window.localStorage.removeItem('scolyax.session')
          window.localStorage.removeItem('scolyax.sessionToken')
          window.localStorage.removeItem('scolyax.demo')
          window.localStorage.removeItem('authUser')  // CRÍTICO: Limpiar datos del usuario
          window.localStorage.removeItem('scolyax.userAvatar')
          window.localStorage.removeItem('scolyax.xp')
          window.localStorage.removeItem('scolyax.streak')
          window.localStorage.removeItem('scolyax.lastActivity')
          window.localStorage.removeItem('scolyax.onboarding.isNewUser')
          window.localStorage.removeItem('scolyax.onboarding.hasCompletedTest')
          window.localStorage.removeItem('scolyax.onboarding.showToolSelector')
          window.localStorage.removeItem('scolyax.onboarding.recommendedTools')
        }
      }
      return
    }
    // Solo guarda la sesión en localStorage si es una sesión válida
    // y NO es una sesión mock (offline)
    if (typeof window !== 'undefined' && session && !session.isMock) {
      window.localStorage.setItem('scolyax.session', JSON.stringify(session))
      if (session.session_token) {
        window.localStorage.setItem('scolyax.sessionToken', session.session_token)
      }
    }
    const fallbackName = deriveFallbackName(session.email)
    const shouldPrompt =
      Boolean(session.display_name) && session.display_name.toLowerCase() === fallbackName.toLowerCase()
    setIsNamePromptOpen(shouldPrompt)
    
    // CRÍTICO: Backend es la ÚNICA fuente de verdad para has_completed_onboarding
    // localStorage solo se usa para UX transitions durante el flujo, no para autoridad
    if (typeof window !== 'undefined') {
      // ✅ FUENTE DE VERDAD: Backend determina si completó onboarding
      const backendCompletedOnboarding = session?.has_completed_onboarding === true
      
      // Get recommended tools from backend (backend is authority)
      const backendRecommended = session?.recommended_tools
      const finalRecommended = backendRecommended 
        ? (Array.isArray(backendRecommended) 
            ? backendRecommended 
            : (typeof backendRecommended === 'string' 
                ? JSON.parse(backendRecommended) 
                : []))
        : []
      
      console.log('🔐 Sincronizando onboarding state desde BACKEND (fuente de verdad):', {
        backendCompletedOnboarding,
        backendRecommended: finalRecommended,
        session: {
          has_completed_onboarding: session?.has_completed_onboarding,
          recommended_tools: session?.recommended_tools
        }
      })
      
      // Force backend as authority - override localStorage
      if (backendCompletedOnboarding) {
        // ✅ Test completado → mostrar loading screen → luego selector
        setHasCompletedTest(true)
        
        // Solo actualizar recommendedTools si el backend tiene datos
        // Si el backend devuelve vacío, mantener las de localStorage/state como fallback
        if (finalRecommended.length > 0) {
          setRecommendedTools(finalRecommended)
          window.localStorage.setItem('scolyax.onboarding.recommendedTools', JSON.stringify(finalRecommended))
        } else {
          // Fallback: intentar cargar de localStorage
          const savedRecommended = window.localStorage.getItem('scolyax.onboarding.recommendedTools')
          if (savedRecommended) {
            try {
              const parsed = JSON.parse(savedRecommended)
              if (Array.isArray(parsed) && parsed.length > 0) {
                setRecommendedTools(parsed)
                console.log('📋 Usando herramientas recomendadas de localStorage (fallback useEffect):', parsed)
              }
            } catch (e) { /* ignore parse error */ }
          }
        }
        
        // Solo activar loading screen si el selector no está ya visible
        if (!showToolSelector) {
          setShowLoadingScreenAfterLogin(true)
        }
        window.localStorage.setItem('scolyax.onboarding.hasCompletedTest', 'true')
        window.localStorage.setItem('scolyax.onboarding.showToolSelector', 'true')
        console.log('✅ Backend: test completed - showing loading screen → tool selector')
      } else {
        // Backend says NOT completed → Show test, CLEAR everything else
        setHasCompletedTest(false)
        setShowToolSelector(false)
        setRecommendedTools([])
        // IMPORTANT: Clear localStorage so it doesn't interfere next time
        window.localStorage.removeItem('scolyax.onboarding.hasCompletedTest')
        window.localStorage.removeItem('scolyax.onboarding.showToolSelector')
        window.localStorage.removeItem('scolyax.onboarding.recommendedTools')
        console.log('🆕 Backend says onboarding NOT completed - showing test + clearing localStorage')
      }
      
      // ✅ RECUPERAR RACHAS DESDE EL BACKEND
      // El backend es la fuente de verdad para rachas
      if (session?.streak_days !== undefined) {
        console.log(`🔄 Sincronizando racha desde backend: ${session.streak_days} días`)
        setStreakDays(session.streak_days)
        window.localStorage.setItem('scolyax.streak', session.streak_days.toString())
      }
      
      // Recuperar XP y nivel si están disponibles
      if (session?.total_xp !== undefined) {
        console.log(`💾 Sincronizando XP desde backend: ${session.total_xp}`)
        window.localStorage.setItem('scolyax.xp', session.total_xp.toString())
      }
      
      if (session?.level !== undefined) {
        console.log(`📊 Sincronizando nivel desde backend: ${session.level}`)
        window.localStorage.setItem('scolyax.level', session.level.toString())
      }
    }
  }, [session, isSessionLoading])

  // Track if initial data has been loaded
  const [hasLoadedData, setHasLoadedData] = useState(false)

  useEffect(() => {
    if (!session) {
      resetCollections()
      setHasLoadedData(false)
      if (!isSessionLoading) {
        navigateToTab('login')
      }
      return
    }

    if (isOfflineMode || session?.isMock) {
      // En modo offline, no cargar del backend
      setHasLoadedData(true)
      return
    }

    // CRITICAL: Resetear hasLoadedData cuando cambia la sesión (usuario diferente)
    // Esto asegura que cada usuario nuevo cargue sus datos correctamente
    const fetchData = async () => {
      try {
        // Cargar datos de forma SECUENCIAL para evitar problemas de socket en Windows
        // Esto previene el error "WinError 10035: No se puede completar de forma inmediata"
        
        let hasErrors = false
        
        // 1. Dashboard stats
        try {
          console.log(`📊 Cargando estadísticas para usuario: ${session?.email}...`)
          let statsResponse = await authenticatedFetch(`${API_URL}/dashboard`)
          if (!statsResponse.ok) {
            console.error(`❌ Dashboard error: ${statsResponse.status}`, await statsResponse.text())
            // Continuar sin stats, no es crítico
          } else {
            statsResponse = await statsResponse.json()
            setStats(statsResponse)
          }
        } catch (error) {
          console.error('❌ Error cargando dashboard:', error)
          // Continuar, no es crítico
        }
        
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // 2. Tareas (CRÍTICO)
        try {
          console.log('✅ Cargando tareas...')
          let tasksResponse = await authenticatedFetch(`${API_URL}/tasks`)
          if (!tasksResponse.ok) {
            console.error(`❌ Tasks error: ${tasksResponse.status}`)
            const errorText = await tasksResponse.text()
            console.error(`Error details: ${errorText}`)
            if (tasksResponse.status === 401) {
              throw new Error('Session expired - re-login required')
            }
            throw new Error(`Tasks returned ${tasksResponse.status}`)
          }
          tasksResponse = await tasksResponse.json()
          console.log(`   📦 Se cargaron ${tasksResponse?.length || 0} tareas`)
          setTasks(tasksResponse || [])
        } catch (error) {
          console.error('❌ CRÍTICO - Error cargando tareas:', error)
          hasErrors = true
        }
        
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // 3. Recordatorios
        try {
          console.log('🔔 Cargando recordatorios...')
          let remindersResponse = await authenticatedFetch(`${API_URL}/reminders`)
          if (!remindersResponse.ok) {
            console.error(`❌ Reminders error: ${remindersResponse.status}`)
            // Continuar sin recordatorios
          } else {
            remindersResponse = await remindersResponse.json()
            console.log(`   📦 Se cargaron ${remindersResponse?.length || 0} recordatorios`)
            setReminders(remindersResponse || [])
          }
        } catch (error) {
          console.error('❌ Error cargando recordatorios:', error)
          // Continuar, no es crítico
        }
        
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // 4. Calendario
        try {
          console.log('📅 Cargando calendario...')
          let scheduleResponse = await authenticatedFetch(`${API_URL}/schedule`)
          if (!scheduleResponse.ok) {
            console.error(`❌ Schedule error: ${scheduleResponse.status}`)
            // Continuar sin calendario, el endpoint podría no existir
          } else {
            scheduleResponse = await scheduleResponse.json()
            console.log(`   📦 Se cargaron ${scheduleResponse?.length || 0} entradas de calendario`)
            setScheduleEntries(scheduleResponse || [])
          }
        } catch (error) {
          console.error('❌ Error cargando calendario:', error)
          // Continuar, no es crítico
        }
        
        if (!hasErrors) {
          setHasLoadedData(true)
          setIsBackendReachable(true)
          console.log('✨ Todos los datos cargados correctamente')
        } else {
          console.warn('⚠️ Algunos datos críticos no se pudieron cargar')
          throw new Error('Critical data failed to load')
        }
      } catch (error) {
        console.error('❌ Error crítico cargando datos:', error)
        setIsBackendReachable(false)
        applyFallbackData()
      }
    }

    fetchData()
  }, [session?.id])

  // CRÍTICO: Resetear gamificationStats cuando el usuario cambia (email diferente)
  // Esto previene que un usuario vea los stats de otro usuario después de logout/login
  useEffect(() => {
    if (!session) {
      return
    }
    
    // Cuando el usuario cambia, resetear ALL gamification data
    // Esto se ejecuta cuando session.email es diferente de la anterior
    console.log('🔄 Session email changed, resetting gamification stats for:', session.email)
    
    // Resetear los estados que se cargan de localStorage
    setXp(0)
    setStreakDays(0)
    setLastActivityDate(null)
    setUserStatsLoaded(false)
    setTotalTasksEverCompleted(0)
    setGamificationStats({
      tasksCompleted: 0,
      pomodoroSessions: 0,
      nightSessions: 0,
      morningSessions: 0,
      tripleDay: 0,
      maxTasksPerDay: 0,
      streakDays: 0
    })
    
    // CRÍTICO: Sincronizar estado de onboarding desde la sesión del nuevo usuario
    // (no resetear a vacío — usar los datos reales del backend para este usuario)
    console.log('🔄 Syncing onboarding state for user:', session.email)
    const _hasCompleted = session?.has_completed_onboarding === true
    const _sessionRecs = Array.isArray(session?.recommended_tools) ? session.recommended_tools : []
    setIsNewUser(!_hasCompleted)
    setHasCompletedTest(_hasCompleted)
    setShowToolSelector(false)
    setRecommendedTools(_sessionRecs)
    
    // CRÍTICO: Limpiar logros de localStorage para que cada usuario comience de cero
    // Los logros se guardan en localStorage y NO están vinculados al usuario,
    // por eso necesitamos limpiarlos cuando cambia de usuario
    window.localStorage.removeItem('scolyax.achievements')
    console.log('🏆 Achievements cleared for user:', session.email)
    
    // El backend cargará los stats correctos del usuario en el siguiente fetch
    console.log('✅ All user state reset for user:', session.email)
  }, [session?.email])

  // Marca una tarea como completada y ajusta la estadística de logros.
  

// Elimina la tarea (y eventos de calendario vinculados en el backend)
const handleDeleteTask = async (taskId) => {
  // Encontrar la tarea antes de eliminarla
  const taskToDelete = tasks.find((t) => t.id === taskId)
  console.log(`🗑️ Eliminando tarea ${taskId}: ${taskToDelete?.title}`)
  
  if (isOfflineMode) {
    console.log('📱 Modo offline - eliminando localmente')
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    return
  }
  try {
    console.log(`📤 DELETE /tasks/${taskId}`)
    const res = await authenticatedFetch(`${API_URL}/tasks/${taskId}?cascade_calendar=true`, { method: 'DELETE' })
    console.log(`📥 DELETE response status:`, res.status)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('❌ Delete error:', err)
      throw new Error(err.detail || 'No se pudo eliminar la tarea')
    }
    console.log('✅ Tarea eliminada del backend')
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    // Refrescar calendario
    try {
      const schRes = await authenticatedFetch(`${API_URL}/schedule`)
      if (schRes.ok) {
        const sch = await schRes.json()
        setSchedule(sch)
      }
    } catch {}
  } catch (error) {
    console.error('❌ Error eliminando tarea:', error)
    alert(error.message || 'No se pudo eliminar la tarea')
  }
}

// Elimina un recordatorio
const handleDeleteReminder = async (reminderId) => {
  if (isOfflineMode) {
    setReminders((prev) => prev.filter((r) => r.id !== reminderId))
    setStats((prev) => ({
      ...prev,
      upcoming_reminders: Math.max(0, prev.upcoming_reminders - 1)
    }))
    return
  }
  try {
    // Si es un ID temporal, refrescar primero para obtener el ID real
    if (typeof reminderId === 'string' && reminderId.startsWith('temp-')) {
      console.log('⏳ ID temporal detectado, refrescando recordatorios...')
      const refreshResponse = await authenticatedFetch(`${API_URL}/reminders`)
      const refreshedReminders = await refreshResponse.json()
      setReminders(refreshedReminders)
      
      // Encontrar el primer recordatorio con ID real (número)
      const realReminder = refreshedReminders.find((r) => typeof r.id === 'number')
      if (realReminder) {
        console.log(`✅ Usando recordatorio ID ${realReminder.id} en lugar del temporal`)
        reminderId = realReminder.id
      } else {
        throw new Error('No se encontró el recordatorio después de refrescar')
      }
    }
    
    const res = await authenticatedFetch(`${API_URL}/reminders/${reminderId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'No se pudo eliminar el recordatorio')
    }
    setReminders((prev) => prev.filter((r) => r.id !== reminderId))
    setStats((prev) => ({
      ...prev,
      upcoming_reminders: Math.max(0, prev.upcoming_reminders - 1)
    }))
  } catch (error) {
    console.error('Error eliminando recordatorio', error)
    alert(error.message || 'No se pudo eliminar el recordatorio')
  }
}

const handleStartFeature = (featureId) => {
  const updated = { ...startedFeatures, [featureId]: true }
  setStartedFeatures(updated)
  localStorage.setItem('scolyax.startedFeatures', JSON.stringify(updated))
}

const handleMarkComplete = async (taskId) => {
    if (isOfflineMode) {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, status: 'completed' } : task))
      )
      setStats((prev) => ({
        ...prev,
        tasks_completed: prev.tasks_completed + 1
      }))
      // Incrementar contador acumulativo (nunca se decrementa)
      const _nextTotalOff = parseInt(localStorage.getItem('scolyax.totalTasksEverCompleted') || '0') + 1
      localStorage.setItem('scolyax.totalTasksEverCompleted', _nextTotalOff)
      setTotalTasksEverCompleted(_nextTotalOff)
      // Mostrar calificación en hitos de tareas completadas
      if ([1, 5, 10].includes(_nextTotalOff)) {
        const _midOff = `tareas_${_nextTotalOff}`
        const _ratedOff = JSON.parse(localStorage.getItem('ratedAchievements') || '[]')
        if (!_ratedOff.includes(_midOff)) {
          setTimeout(() => {
            setAchievementToRate({ id: _midOff, name: _nextTotalOff === 1 ? '¡Primera tarea completada!' : `${_nextTotalOff} tareas completadas` })
            setShowRatingModal(true)
          }, 700)
        }
      }
      // Otorgar XP por completar tarea
      awardXP(10, 'Tarea completada')
      // Actualizar racha
      updateStreakAndActivity()
      return
    }
    try {
      console.log(`✅ Marcando tarea ${taskId} como completada...`)
      const response = await authenticatedFetch(`${API_URL}/tasks/${taskId}/status?status=completed`, {
        method: 'PATCH'
      })
      console.log(`📥 PATCH /tasks/${taskId}/status response status:`, response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Error updating task status: ${response.status}`, errorText)
        throw new Error(`Error ${response.status}: ${errorText}`)
      }
      
      const updatedTask = await response.json()
      console.log(`✅ Tarea actualizada:`, updatedTask)
      
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updatedTask : task)))
      setStats((prev) => ({
        ...prev,
        tasks_completed: prev.tasks_completed + 1
      }))
      // Incrementar contador acumulativo (nunca se decrementa)
      const _nextTotal = parseInt(localStorage.getItem('scolyax.totalTasksEverCompleted') || '0') + 1
      localStorage.setItem('scolyax.totalTasksEverCompleted', _nextTotal)
      setTotalTasksEverCompleted(_nextTotal)
      // Mostrar calificación en hitos de tareas completadas
      if ([1, 5, 10].includes(_nextTotal)) {
        const _milestoneId = `tareas_${_nextTotal}`
        const _rated = JSON.parse(localStorage.getItem('ratedAchievements') || '[]')
        if (!_rated.includes(_milestoneId)) {
          setTimeout(() => {
            setAchievementToRate({ id: _milestoneId, name: _nextTotal === 1 ? '¡Primera tarea completada!' : `${_nextTotal} tareas completadas` })
            setShowRatingModal(true)
          }, 700)
        }
      }
      // Otorgar XP por completar tarea
      awardXP(10, 'Tarea completada')
      // Actualizar racha
      updateStreakAndActivity()
    } catch (error) {
      console.error('❌ No se pudo actualizar la tarea', error)
      alert(`Error al completar tarea: ${error.message}`)
    }
  }

  // Actualiza una tarea existente con campos parciales (para pomodoros, tiempo, etc.)
  const handleUpdateTask = useCallback(async (taskId, updates) => {
    if (isOfflineMode) {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
      )
      return true
    }

    try {
      // Primero obtener la tarea actual
      const currentTask = tasks.find(t => t.id === taskId)
      if (!currentTask) {
        throw new Error('Tarea no encontrada')
      }

      // Combinar la tarea actual con las actualizaciones
      const updatedTask = { ...currentTask, ...updates }

      console.log(`🔄 Actualizando tarea ${taskId}...`, updates)
      const response = await authenticatedFetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedTask)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Error actualizando tarea: ${response.status}`, errorText)
        throw new Error(`Error ${response.status}: ${errorText}`)
      }

      const serverTask = await response.json()
      console.log(`✅ Tarea actualizada en servidor:`, serverTask)
      
      // Actualizar el estado local
      setTasks((prev) => prev.map((task) => (task.id === taskId ? serverTask : task)))
      
      return true
    } catch (error) {
      console.error('❌ No se pudo actualizar la tarea', error)
      return false
    }
  }, [isOfflineMode, tasks, authenticatedFetch, API_URL])

  // Registra una tarea nueva en el backend o en modo sin conexión.
  const handleAddTask = useCallback(
    async ({ title, course, dueDate, notes, estimated_pomodoros }) => {
      const normalizedCourse = course.trim() || 'General'
      const normalizedNotes = notes.trim() ? notes.trim() : null
      const tempId = Math.floor(Date.now() + Math.random() * 1000)

      // ⚡ Optimistic: agregar la tarea al estado INMEDIATAMENTE
      const optimisticTask = {
        id: tempId,
        title,
        course: normalizedCourse,
        due_date: dueDate
          ? /\d{4}-\d{2}-\d{2}$/.test(String(dueDate))
            ? String(dueDate)
            : new Date(dueDate).toISOString()
          : null,
        status: 'pending',
        notes: normalizedNotes,
        tags: [],
        estimated_pomodoros: estimated_pomodoros || 0
      }
      setTasks((prev) => [...prev, optimisticTask])

      // Actualizar fecha de última actividad para racha
      const today = new Date().toISOString().split('T')[0]
      setLastActivityDate(today)

      // 🔔 Crear recordatorio local inmediato si tiene fecha
      if (dueDate && session) {
        const localReminder = {
          id: tempId + 1,
          title: `📚 Tarea: ${title}`,
          description: `Recordatorio automático para la tarea "${title}" de ${normalizedCourse}`,
          remind_at: dueDate
            ? /\d{4}-\d{2}-\d{2}$/.test(String(dueDate))
              ? String(dueDate)
              : new Date(dueDate).toISOString()
            : null,
          type: 'task',
          delivery_provider: session.provider
        }
        setReminders((prev) => [...prev, localReminder])
        setStats((prev) => ({ ...prev, upcoming_reminders: prev.upcoming_reminders + 1 }))
      }

      // Si estamos offline, no intentar el backend
      if (isOfflineMode) {
        console.log('💾 [OFFLINE] Tarea agregada localmente')
        return optimisticTask
      }

      // 🔄 Sincronizar con backend en segundo plano (no bloquea UI)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await authenticatedFetch(`${API_URL}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            id: 0,
            title,
            course: normalizedCourse,
            due_date: dueDate ? new Date(dueDate).toISOString() : null,
            status: 'pending',
            notes: normalizedNotes,
            tags: [],
            estimated_pomodoros: estimated_pomodoros || 0
          })
        })
        clearTimeout(timeoutId)

        if (response.ok) {
          const serverTask = await response.json()
          console.log('✅ Tarea sincronizada con backend:', serverTask.id)
          // Reemplazar tarea optimista con la del servidor (tiene ID real)
          setTasks((prev) => prev.map(t => t.id === tempId ? serverTask : t))

          // Sincronizar recordatorio con backend
          if (dueDate && session) {
            try {
              const reminderResp = await authenticatedFetch(`${API_URL}/reminders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: `📚 Tarea: ${title}`,
                  description: `Recordatorio automático para la tarea "${title}" de ${normalizedCourse}`,
                  remind_at: new Date(dueDate).toISOString(),
                  type: 'task'
                })
              })
              if (reminderResp.ok) {
                const serverReminder = await reminderResp.json()
                setReminders((prev) => prev.map(r => r.id === tempId + 1 ? serverReminder : r))
              }
            } catch (e) { console.warn('⚠️ Recordatorio no sincronizado:', e.message) }
          }
        } else {
          console.warn('⚠️ Backend respondió con error, tarea se mantiene local')
        }
      } catch (error) {
        console.warn('⚠️ Backend no disponible, tarea guardada localmente:', error.message)
        // Guardar en localStorage para futura sincronización
        const pendingTasks = JSON.parse(localStorage.getItem('scolyax.pendingTasks') || '[]')
        pendingTasks.push({ ...optimisticTask, _synced: false, _createdAt: new Date().toISOString() })
        localStorage.setItem('scolyax.pendingTasks', JSON.stringify(pendingTasks))
      }

      return optimisticTask
    },
    [isOfflineMode, session, authenticatedFetch, API_URL, setTasks, setReminders, setStats, setLastActivityDate]
  )

  // Persiste el nombre preferido una vez completado el inicio de sesión.
  const handleDisplayNameSubmit = useCallback(
    async (displayName) => {
      if (!session) return

      if (isOfflineMode || session.isMock) {
        setSession((prev) => (prev ? { ...prev, display_name: displayName } : prev))
        setIsNamePromptOpen(false)
        return
      }

      try {
        const response = await authenticatedFetch(`${API_URL}/session/display-name`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ display_name: displayName })
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.detail || 'No se pudo guardar tu nombre preferido.')
        }
        setSession(data)
        setIsNamePromptOpen(false)
      } catch (error) {
        console.error('Error actualizando el nombre para mostrar', error)
        alert(error.message || 'No se pudo guardar tu nombre preferido. Intenta nuevamente.')
      }
    },
    [session, isOfflineMode]
  )

  const handleDismissNamePrompt = useCallback(() => {
    setIsNamePromptOpen(false)
  }, [])

  // Gestiona el envío de archivos o texto al servicio de resúmenes.
  const handleSummaryUpload = async (payload) => {
    setIsSummarizing(true)
    if (isOfflineMode) {
      setSummary(FALLBACK_SUMMARY)
      setKeywords(FALLBACK_KEYWORDS)
      setOriginalText(FALLBACK_ORIGINAL_TEXT)
      navigateToTab('summary')
      setIsSummarizing(false)
      return
    }
    try {
      const response = await authenticatedFetch(`${API_URL}/summary`, {
        method: 'POST',
        body: payload
      })
      const data = await response.json()
      if (!response.ok) {
        const message = data?.detail || 'No se pudo generar el resumen. Inténtalo nuevamente.'
        alert(message)
        setSummary('')
        setKeywords([])
        setOriginalText('')
        return
      }
      setIsBackendReachable(true)
      setSummary(data.summary)
      setKeywords(data.highlighted_keywords)
      setOriginalText(data.original_text)
      navigateToTab('summary')
    } catch (error) {
      console.error('Error generando resumen', error)
      setIsBackendReachable(false)
      setIsOfflineMode(true)
      alert('Ocurrió un problema al generar el resumen. Activamos el modo demostración para que puedas seguir trabajando mientras reconectas el backend.')
    } finally {
      setIsSummarizing(false)
    }
  }

  // Limpia los resultados del resumen
  const clearSummaryResults = useCallback(() => {
    setSummary('')
    setKeywords([])
    setOriginalText('')
  }, [])

  // Crea recordatorios y sincroniza el estado local.
  const handleAddReminder = useCallback(
    async ({ title, description, remindAt, type }) => {
      if (!session) {
        alert('Inicia sesión con Google o Microsoft para agendar recordatorios.')
        return null
      }
      if (isOfflineMode) {
        const newReminder = {
          id: Date.now(),
          title,
          description,
            // Preservar YYYY-MM-DD cuando el usuario proporciona solo la fecha
            remind_at: remindAt
              ? /\d{4}-\d{2}-\d{2}$/.test(String(remindAt))
                ? String(remindAt)
                : remindAt
              : null,
          type,
          delivery_provider: session.provider
        }
        setReminders((prev) => [...prev, newReminder])
        setStats((prev) => ({
          ...prev,
          upcoming_reminders: prev.upcoming_reminders + 1
        }))
        // Actualizar fecha de última actividad para racha
        const today = new Date().toISOString().split('T')[0]
        setLastActivityDate(today)
        return newReminder
      }
      
      // Optimistic update: mostrar inmediatamente
      const tempId = `temp-${Date.now()}`
      const optimisticReminder = {
        id: tempId,
        title,
        description,
        remind_at: remindAt,
        type,
        _pending: true
      }
      
      setReminders((prev) => [...prev, optimisticReminder])
      setStats((prev) => ({
        ...prev,
        upcoming_reminders: prev.upcoming_reminders + 1
      }))
      
      try {
        const response = await authenticatedFetch(`${API_URL}/reminders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title,
            description,
            remind_at: remindAt,
            type
          })
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.detail || 'No se pudo crear el recordatorio. Inténtalo nuevamente.')
        }

        // Reemplazar el recordatorio temporal con el real
        console.log('📌 Recordatorio creado:', { tempId, newId: data.id, data })
        setReminders((prev) => 
          prev.map((r) => {
            if (r.id === tempId) {
              console.log('✅ Reemplazando recordatorio temporal:', tempId, 'con:', data.id)
              return data
            }
            return r
          })
        )

        // Refrescar la lista de recordatorios desde el servidor para asegurar sincronización
        await new Promise(resolve => setTimeout(resolve, 100))
        try {
          const refreshResponse = await authenticatedFetch(`${API_URL}/reminders`)
          const refreshedReminders = await refreshResponse.json()
          console.log('🔄 Recordatorios refrescados después de crear:', refreshedReminders.length)
          setReminders(refreshedReminders)
        } catch (err) {
          console.warn('No se pudo refrescar recordatorios:', err)
          // Continuar con el recordatorio ya actualizado
        }

        // Actualizar fecha de última actividad para racha
        const today = new Date().toISOString().split('T')[0]
        setLastActivityDate(today)

        return data
      } catch (error) {
        console.error('Error creando recordatorio', error)
        // Remover el recordatorio temporal si falla
        setReminders((prev) => prev.filter((r) => r.id !== tempId))
        setStats((prev) => ({
          ...prev,
          upcoming_reminders: prev.upcoming_reminders - 1
        }))
        alert(error.message || 'No se pudo crear el recordatorio. Inténtalo otra vez.')
        return null
      }
    },
    [session, isOfflineMode, setReminders, setStats]
  )

  // Ajusta un recordatorio existente preservando el proveedor activo.
  const handleUpdateReminder = useCallback(
    async (reminderId, { title, description, remindAt, type }) => {
      if (!session) {
        alert('Inicia sesión para editar tus recordatorios sincronizados.')
        return null
      }

      if (isOfflineMode) {
        const updatedReminder = {
          id: reminderId,
          title,
          description,
            remind_at: remindAt
              ? /\d{4}-\d{2}-\d{2}$/.test(String(remindAt))
                ? String(remindAt)
                : remindAt
              : null,
          type,
          delivery_provider: session.provider
        }
        setReminders((prev) =>
          prev.map((reminder) => (reminder.id === reminderId ? updatedReminder : reminder))
        )
        return updatedReminder
      }

      try {
        const response = await authenticatedFetch(`${API_URL}/reminders/${reminderId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title,
            description,
            remind_at: remindAt,
            type
          })
        })

        const data = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(data?.detail || 'No se pudo actualizar el recordatorio.')
        }

        setReminders((prev) =>
          prev.map((reminder) => (reminder.id === reminderId ? data : reminder))
        )
        return data
      } catch (error) {
        console.error('Error actualizando recordatorio', error)
        alert(error.message || 'No se pudo guardar el cambio del recordatorio.')
        return null
      }
    },
    [session, isOfflineMode]
  )

  // Activa la lectura en voz alta usando TTS del backend (voces realistas gTTS/Google Cloud)
  const speakText = useCallback(async (text) => {
    if (!text) return
    
    // Detiene cualquier audio anterior
    if (window.currentAudioElement) {
      window.currentAudioElement.pause()
      window.currentAudioElement = null
    }
    
    console.log('🔊 [App-TTS-NATIVE] Usando TTS nativo del backend (Google Cloud)...')
    
    try {
      const formData = new FormData()
      formData.append('text', text.substring(0, 5000))
      formData.append('language', 'es-ES')
      formData.append('voice_name', 'es-ES-Neural2-c')
      
      const response = await fetch(`${API_URL}/tts`, {
        method: 'POST',
        body: formData,
        timeout: 10000
      })
      
      if (!response.ok) {
        throw new Error(`TTS error: ${response.status}. Verifica que Google Cloud TTS esté configurado.`)
      }
      
      const audioBlob = await response.blob()
      
      if (audioBlob.size === 0) {
        throw new Error('Recibido audio vacío del servidor TTS')
      }
      
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      
      // Guardar referencia global
      window.currentAudioElement = audio
      
      // Event handlers
      audio.onplay = () => console.log('▶️ Reproduciendo audio TTS nativo')
      
      audio.onended = () => {
        console.log('✅ Audio TTS finalizado')
        URL.revokeObjectURL(audioUrl)
        window.currentAudioElement = null
      }
      
      audio.onerror = (err) => {
        console.error('❌ Error al reproducir audio TTS:', err)
        URL.revokeObjectURL(audioUrl)
        window.currentAudioElement = null
      }
      
      // Reproducir
      await audio.play()
      console.log('✅ Audio TTS iniciado correctamente')
      
    } catch (error) {
      console.error('❌ Error en TTS nativo:', error.message)
      window.currentAudioElement = null
    }
  }, [API_URL])

  // Detiene la narración por voz cuando la persona lo solicita.
  const stopSpeaking = useCallback(() => {
    if (window.currentAudioElement) {
      console.log('🛑 Deteniendo audio TTS...')
      window.currentAudioElement.pause()
      window.currentAudioElement.currentTime = 0
      
      // Limpiar el URL del blob
      const src = window.currentAudioElement.src
      if (src && src.startsWith('blob:')) {
        URL.revokeObjectURL(src)
      }
      
      window.currentAudioElement = null
      console.log('✅ Audio TTS detenido')
    }
  }, [])

  // Maneja la selección de avatar
  const handleSelectAvatar = useCallback((avatarId) => {
    setUserAvatar(avatarId)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('scolyax.userAvatar', avatarId)
    }
  }, [])

  // Cierra la sesión y limpia el estado compartido.
  const handleLogout = useCallback(async () => {
    // Get session token to send to backend
    const sessionToken = typeof window !== 'undefined'
      ? window.localStorage.getItem('scolyax.sessionToken')
      : null

    // CRÍTICO: Limpiar localStorage PRIMERO antes de cambiar estados
    // Limpiar TODOS los datos del usuario anterior para evitar data bleed entre usuarios
    if (typeof window !== 'undefined') {
      // Session data
      window.localStorage.removeItem('scolyax.session')
      window.localStorage.removeItem('scolyax.sessionToken')
      window.localStorage.removeItem('scolyax.demo')
      
      // User data
      window.localStorage.removeItem('authUser')  // CRÍTICO: Limpiar datos del usuario anterior
      window.localStorage.removeItem('scolyax.userAvatar')
      
      // Gamification stats
      window.localStorage.removeItem('scolyax.xp')
      window.localStorage.removeItem('scolyax.streak')
      window.localStorage.removeItem('scolyax.lastActivity')
      window.localStorage.removeItem('scolyax.totalTasksEverCompleted')
      window.localStorage.removeItem('scolyax.achievements')
      
      // Rating/Feedback state
      window.localStorage.removeItem('ratedAchievements')
      
      // Google Calendar connection state
      window.localStorage.removeItem('scolyax.googleCalendarConnected')
      
      // Onboarding state (user-specific)
      window.localStorage.removeItem('scolyax.onboarding.isNewUser')
      window.localStorage.removeItem('scolyax.onboarding.hasCompletedTest')
      window.localStorage.removeItem('scolyax.onboarding.showToolSelector')
      window.localStorage.removeItem('scolyax.onboarding.recommendedTools')
      
      // Note: NOT removing scolyax.darkMode as it's a user preference, not user data
      // Note: NOT removing scolyax.notificationPermissionAsked as it's a browser preference
    }

    // Luego, establecer estados
    setSession(null)
    setIsOfflineMode(false)
    setIsNamePromptOpen(false)
    setShowLanding(true)
    resetCollections()
    navigateToTab('login')
    setHasLoadedData(false)

    // Verificar si estaba en modo offline antes del logout
    const wasOffline = !isBackendReachable || isOfflineMode
    
    if (wasOffline) {
      stopSpeaking()
      return
    }

    try {
      await authenticatedFetch(`${API_URL}/session`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('Error al cerrar sesión', error)
    } finally {
      stopSpeaking()
    }
  }, [isBackendReachable, isOfflineMode, resetCollections, stopSpeaking])

  // Alterna manual entre claro/oscuro (se re-sincroniza con la hora al minuto siguiente)
  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev)
  }, [])

  // ✅ NUEVA LÓGICA DE NAVEGACIÓN MEJORADA
  // Navegar a una pestaña y guardar en historial
  const navigateToTab = useCallback((tabId) => {
    setActiveTab(tabId)
    setTabHistory((prev) => {
      // Evitar duplicados consecutivos
      if (prev[prev.length - 1] === tabId) return prev
      return [...prev, tabId]
    })
    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false)
    }
    console.log(`🧭 Navegando a: ${tabId}`)
  }, [])

  // Volver a la pestaña anterior
  const goBackTab = useCallback(() => {
    setTabHistory((prev) => {
      if (prev.length <= 1) return prev
      const newHistory = prev.slice(0, -1)
      const previousTab = newHistory[newHistory.length - 1]
      setActiveTab(previousTab)
      console.log(`🔙 Volviendo a: ${previousTab}`)
      return newHistory
    })
  }, [])

  // Obtener la pestaña anterior (para mostrar botón "Atrás" solo si existe)
  const getPreviousTab = useCallback(() => {
    return tabHistory.length > 1 ? tabHistory[tabHistory.length - 2] : null
  }, [tabHistory])

  // Limpiar historial al logout
  useEffect(() => {
    if (!session) {
      setTabHistory(['login'])
    }
  }, [session])

  // Maneja la apertura del modal de calificación después de celebración de logro
  const handleOpenRatingModal = useCallback((achievement) => {
    // Verificar si el usuario ya calificó este logro
    const ratedAchievements = JSON.parse(localStorage.getItem('ratedAchievements') || '[]')
    
    if (ratedAchievements.includes(achievement?.id)) {
      console.log('✅ Usuario ya calificó este logro:', achievement.name)
      return
    }

    console.log('📊 Opening rating modal for achievement:', achievement.name)
    setAchievementToRate(achievement)
    setShowRatingModal(true)
  }, [])

  // Maneja el envío del feedback al backend.
  // RatingModal ya envía los datos directamente al backend (JSON + Bearer token).
  // Esta función solo recibe la notificación de éxito para limpiar el estado.
  const handleSubmitFeedback = useCallback(() => {
    setShowRatingModal(false)
    setAchievementToRate(null)
  }, [])

  // Abre el panel de administrador para ver todos los feedback
  const handleOpenAdminFeedback = useCallback(() => {
    console.log('📊 Opening admin feedback panel')
    setShowAdminFeedback(true)
  }, [])

  // Notifica cuando termina un ciclo de enfoque y guarda en el backend
  const handleSessionComplete = useCallback(async (sessionData) => {
    // sessionData puede contener: { duration_minutes, topic, linked_task_id }
    const durationMinutes = sessionData?.duration_minutes || 25
    const topic = sessionData?.topic || 'General'
    const linkedTaskId = sessionData?.linked_task_id || null
    
    // Otorgar XP por sesión Pomodoro completada
    awardXP(25, 'Sesión Pomodoro completada')
    // Actualizar stats de gamificación
    setGamificationStats((prev) => ({
      ...prev,
      pomodoroSessions: prev.pomodoroSessions + 1
    }))
    // Mostrar diario de energía post-sesión
    setShowEnergyJournal(true)
    
    // Guardar la sesión en Supabase
    try {
      const token = localStorage.getItem('scolyax.sessionToken')
      if (!token) {
        console.warn('⚠️ No session token found - skipping focus session save')
        return
      }
      
      const focusSessionPayload = {
        id: 0, // Backend lo asignará
        topic: topic,
        duration_minutes: durationMinutes,
        completed_at: new Date().toISOString(),
        linked_task_id: linkedTaskId,
        linked_task_title: linkedTaskId && tasks?.find(t => t.id === linkedTaskId)?.title
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/focus-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(focusSessionPayload)
      })
      
      if (response.ok) {
        console.log('✅ Focus session guardada exitosamente')
        
        // Recargar las sesiones desde el backend para asegurar que el contador es correcto
        try {
          const sessionsResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/focus-sessions`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          
          if (sessionsResponse.ok) {
            const sessions = await sessionsResponse.json()
            console.log('🔄 Reloaded focus sessions after save:', sessions.length, 'sessions')
            
            // Actualizar el contador con el valor correcto del backend
            setGamificationStats((prev) => ({
              ...prev,
              pomodoroSessions: sessions.length
            }))
            
            // Guardar en localStorage también (backup)
            localStorage.setItem('scolyax.pomodoroSessions', sessions.length.toString())
          }
        } catch (reloadError) {
          console.warn('⚠️ Error reloading focus sessions after save:', reloadError)
        }
      } else {
        console.error('❌ Error al guardar focus session:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('❌ Error guardando focus session:', error)
    }
  }, [awardXP, tasks])

  // Permite autenticar en modo demostración cuando el backend está desconectado.
  const handleOfflineAuth = useCallback(
    ({ email, provider, displayName }) => {
      const normalizedEmail = email || FALLBACK_SESSION.email
      activateOfflineExperience({
        email: normalizedEmail,
        provider: provider || FALLBACK_SESSION.provider,
        display_name: displayName || deriveFallbackName(normalizedEmail)
      })
    },
    [activateOfflineExperience]
  )

  // Crea un bloque del calendario semanal y lo muestra en la pestaña correspondiente.
  const handleAddScheduleEntry = useCallback(
    async ({ title, day_of_week, start_time, end_time, location, description }) => {
      if (isOfflineMode) {
        const newEntry = {
          id: Date.now(),
          title,
          day_of_week,
          start_time,
          end_time,
          location,
          description
        }
        setScheduleEntries((prev) => [...prev, newEntry])
        navigateToTab('calendar')
        return newEntry
      }

      try {
        const response = await authenticatedFetch(`${API_URL}/schedule`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: 0,
            title,
            day_of_week,
            start_time,
            end_time,
            location,
            description
          })
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.detail || 'No se pudo registrar el horario. Intenta nuevamente.')
        }

        setScheduleEntries((prev) => [...prev, data])
        navigateToTab('calendar')
        return data
      } catch (error) {
        console.error('Error guardando horario', error)
        alert(error.message || 'Ocurrió un problema al guardar el bloque de horario.')
        return null
      }
    },
    [isOfflineMode, navigateToTab]
  )

  // Quita un bloque de horario del calendario.
  const handleDeleteScheduleEntry = useCallback(
    async (entryId) => {
      if (isOfflineMode) {
        setScheduleEntries((prev) => prev.filter((entry) => entry.id !== entryId))
        return
      }

      try {
        const response = await authenticatedFetch(`${API_URL}/schedule/${entryId}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data?.detail || 'No se pudo eliminar el bloque del horario.')
        }

        setScheduleEntries((prev) => prev.filter((entry) => entry.id !== entryId))
      } catch (error) {
        console.error('Error eliminando horario', error)
        alert(error.message || 'No se pudo eliminar el bloque seleccionado.')
      }
    },
    [isOfflineMode]
  )

  const tabs = session ? DASHBOARD_TABS : [LOGIN_TAB]

  
  // --- FIX LOGIN ISOLATION ---
  if (!session && !showOnboardingLoader) {
    // Mostrar Landing Page o Login
    if (showLanding) {
      return (
        <>
          <LandingPage
            onGetStarted={() => setShowLanding(false)}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
          />
          <InstallPrompt />
          <OfflineIndicator />
        </>
      )
    }

    return (
      <>
        <div className="app-shell min-h-screen flex items-center justify-center p-6">
          <LoadingBar isLoading={isLoading} />
          <section id="panel-login" role="tabpanel" aria-labelledby="tab-login" className="w-full max-w-lg">
            <AuthGateway
              isLoading={typeof isSessionLoading !== 'undefined' ? isSessionLoading : false}
              isBackendReachable={typeof isBackendReachable !== 'undefined' ? isBackendReachable : true}
              isDarkMode={typeof isDarkMode !== 'undefined' ? isDarkMode : false}
              onToggleDarkMode={typeof handleToggleDarkMode !== 'undefined' ? handleToggleDarkMode : (()=>{})}
              apiBaseUrl={typeof API_URL !== 'undefined' ? API_URL : (import.meta.env?.VITE_API_URL || '')}
              onOfflineAuth={typeof handleOfflineAuth !== 'undefined' ? handleOfflineAuth : (()=>{})}
            />
          </section>
        </div>
        <InstallPrompt />
        <OfflineIndicator />
      </>
    )
  }
  // --- END FIX LOGIN ISOLATION ---

  // Show loading screen after test completion or login with completed test
  if (showLoadingScreenAfterLogin && session) {
    return <LoadingScreen isVisible={showLoadingScreenAfterLogin} onLoadingComplete={handleLoadingScreenComplete} isDark={isDarkMode} />
  }

  // Show onboarding loader between login and test
  if (showOnboardingLoader && session) {
    return <OnboardingLoader 
      userName={session.display_name || session.email?.split('@')[0] || 'Usuario'} 
      isFadingOut={isLoaderFadingOut}
      isDark={isDarkMode}
    />
  }

  // Show Iris Results after completing the test (one-time)
  if (showIrisResults && session) {
    return (
      <IrisResults
        answers={irisTestAnswers}
        recommendedTools={recommendedTools}
        studyMethod={recommendedStudyMethod}
        userName={session.display_name || 'Estudiante'}
        onContinue={() => {
          setShowIrisResults(false)
          setShowLoadingScreenAfterLogin(true)
        }}
      />
    )
  }

  // Show MoodEvaluator for returning users (once per session)
  if (showMoodEvaluator && session) {
    return (
      <MoodEvaluator
        userName={session.display_name || 'Estudiante'}
        isDark={isDarkMode}
        onComplete={() => {
          try { sessionStorage.setItem('scolyax.moodEvaluated', 'true') } catch (e) { /* ignore */ }
          setShowMoodEvaluator(false)
          setShowToolSelector(true)
        }}
      />
    )
  }

  // Show cognitive test for new users
  if (isNewUser && !hasCompletedTest && session) {
    return <CognitiveTest onComplete={handleTestComplete} userName={session.display_name || 'Usuario'} isDark={isDarkMode} />
  }
  
  // Show tool selector after test
  if (showToolSelector && session) {
    return <ToolSelector userName={session.display_name || 'Usuario'} recommendedTools={recommendedTools} recommendedStudyMethod={recommendedStudyMethod} onSelectTool={handleToolSelection} isDark={isDarkMode} />
  }

  // Show dashboard transition
  if (showDashboardTransition && session) {
    return <DashboardTransition 
      userName={session.display_name || 'Usuario'} 
      selectedTool={transitionData.tool}
      toolName={transitionData.toolName}
      toolIcon={transitionData.toolIcon}
      isDark={isDarkMode}
    />
  }

return (
    <div className={`dashboard-container ${isSidebarCollapsed ? 'dashboard-container--collapsed' : ''}`}>
      
      {/* Mobile sidebar backdrop overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'sidebar-overlay--visible' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Persistent edge chevron tab — always visible on mobile, rotates with sidebar state */}
      <div 
        className={`sidebar-edge-tab ${isSidebarOpen ? 'sidebar-edge-tab--open' : ''}`}
        onClick={() => {
          if (isSidebarOpen) {
            setIsSidebarOpen(false)
          } else {
            setIsSidebarOpen(true); setShowSwipeHint(false); swipeHintDismissedRef.current = true;
          }
        }}
        aria-label={isSidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        <svg className="sidebar-edge-tab__arrow" viewBox="0 0 20 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 4 L14 20 L4 36" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Swipe hint indicator for mobile (first-time users) */}
      {showSwipeHint && !isSidebarOpen && (
        <div className="swipe-hint" onClick={() => { setIsSidebarOpen(true); setShowSwipeHint(false); swipeHintDismissedRef.current = true; }}>
          <div className="swipe-hint__tab">
            <span className="swipe-hint__arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </span>
          </div>
          <span className="swipe-hint__label">Arrastra → Menú</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`dashboard-sidebar ${isSidebarCollapsed ? 'dashboard-sidebar--collapsed' : ''} ${isSidebarOpen ? 'dashboard-sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo__icon"><img src="/scolyax-icon.svg" alt="Scolyax" /></div>
            <span className="sidebar-logo__text">Scolyax</span>
          </div>
          <button
            className="sidebar-collapse-btn"
            onClick={() => {
              const next = !isSidebarCollapsed
              setIsSidebarCollapsed(next)
              localStorage.setItem('scolyax.sidebarCollapsed', String(next))
            }}
            title={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-label={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isSidebarCollapsed
                ? <polyline points="9 18 15 12 9 6" />
                : <polyline points="15 18 9 12 15 6" />
              }
            </svg>
          </button>
        </div>

        {/* User Profile Card */}
        {session && (
          <div className="sidebar-profile">
            <div className="sidebar-profile__avatar-wrap">
              <div className="sidebar-profile__avatar-ring" />
              <button
                className="sidebar-profile__avatar sidebar-profile__avatar--clickable"
                onClick={() => setIsAvatarSelectorOpen(true)}
                type="button"
                aria-label="Cambiar avatar"
                title={isSidebarCollapsed ? (session.display_name || 'Usuario') : 'Cambiar avatar'}
                style={{
                  background: userAvatar ? window.AVATAR_GRADIENTS?.[userAvatar] || 'linear-gradient(135deg, #c9d62f, #c8de1f)' : 'linear-gradient(135deg, #c9d62f, #c8de1f)'
                }}
              >
                {userAvatar || (session.display_name?.charAt(0).toUpperCase() || session.email?.charAt(0).toUpperCase() || 'U')}
              </button>
            </div>
            <div className="sidebar-profile__info">
              <span className="sidebar-profile__name">{session.display_name || 'Usuario'}</span>
              <span className="sidebar-profile__email">{session.email}</span>
            </div>
          </div>
        )}

        {/* GamificationBar moved to Achievement panel */}

        {/* Navigation Menu */}
        <nav className="sidebar-nav" role="tablist" aria-label="Secciones principales">
          {tabs.map((tab) => {
            const isDisabled = !session && tab.id !== 'login'
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                className={`sidebar-nav__item sidebar-nav__item--${tab.id} ${activeTab === tab.id ? 'sidebar-nav__item--active' : ''} ${isDisabled ? 'sidebar-nav__item--disabled' : ''}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                aria-label={tab.label}
                title={isSidebarCollapsed ? tab.label : undefined}
                onClick={() => { if (isDisabled) return; navigateToTab(tab.id); }}
                disabled={isDisabled}
              >
                <span className="sidebar-nav__icon" dangerouslySetInnerHTML={{ __html: isDarkMode ? DARK_ICONS[tab.id] : LIGHT_ICONS[tab.id] || '' }}></span>
                <span className="sidebar-nav__label">{tab.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {session && (
            <button
              type="button"
              className="sidebar-footer__button sidebar-footer__button--crisis"
              aria-label="Modo crisis – necesito ayuda"
              title={isSidebarCollapsed ? 'Modo Crisis' : undefined}
              onClick={() => { setShowCrisisMode(true); if (window.innerWidth <= 768) setIsSidebarOpen(false); }}
            >
              <span className="sidebar-footer__icon"><Sticker name="sos" size={22} /></span>
              <span className="sidebar-footer__label">Crisis</span>
            </button>
          )}
          <button
            type="button"
            className="sidebar-footer__button"
            aria-label="Configuración"
            title={isSidebarCollapsed ? 'Configuración' : undefined}
            onClick={() => setIsSettingsOpen(true)}
          >
            <span className="sidebar-footer__icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span className="sidebar-footer__label">Configuración</span>
          </button>
          
          {session && (
            <button
              type="button"
              className="sidebar-footer__button sidebar-footer__button--logout"
              title={isSidebarCollapsed ? 'Cerrar Sesión' : undefined}
              onClick={handleLogout}
            >
              <span className="sidebar-footer__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              <span className="sidebar-footer__label">Cerrar Sesión</span>
            </button>
          )}
        </div>
      </aside>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        themeMode={themeMode}
        onThemeModeChange={handleThemeModeChange}
        isDarkMode={isDarkMode}
        onLogout={handleLogout}
      />

      {/* Top navigation bar — desktop only (sidebar is used on mobile) */}
      <header className="topnav" role="navigation" aria-label="Navegación principal">
        <div className="topnav__brand">
          <img className="topnav__mark" src="/scolyax-icon.svg" alt="Scolyax" />
          <span className="topnav__name">Scolyax</span>
        </div>
        <nav className="topnav__tabs" role="tablist" aria-label="Secciones">
          {tabs.map((tab) => {
            const disabled = !session && tab.id !== 'login'
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`topnav__tab ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => { if (disabled) return; navigateToTab(tab.id) }}
                disabled={disabled}
                title={tab.label}
              >
                <span className="topnav__tab-icon" dangerouslySetInnerHTML={{ __html: NAV_ICONS[tab.id] || '' }} />
                <span className="topnav__tab-label">{tab.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="topnav__actions">
          {session && (
            <button type="button" className="topnav__icon-btn topnav__icon-btn--crisis" title="Modo Crisis" aria-label="Modo Crisis" onClick={() => setShowCrisisMode(true)}><Sticker name="sos" size={20} /></button>
          )}
          <button type="button" className="topnav__icon-btn" title="Configuración" aria-label="Configuración" onClick={() => setIsSettingsOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
          {session && (
            <button type="button" className="topnav__profile" title="Cambiar avatar" onClick={() => setIsAvatarSelectorOpen(true)}>
              <span className="topnav__avatar">{userAvatar || (session.display_name?.charAt(0).toUpperCase() || session.email?.charAt(0).toUpperCase() || 'U')}</span>
              <span className="topnav__profile-name">{session.display_name || 'Usuario'}</span>
            </button>
          )}
          {session && (
            <button type="button" className="topnav__icon-btn topnav__icon-btn--logout" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={handleLogout}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="dashboard-main" data-tab={activeTab}>
        <main className="dashboard-content">
          {/* Home panel */}
          <section
            id="panel-home"
            role="tabpanel"
            aria-labelledby="tab-home"
            hidden={activeTab !== 'home'}
            className="dashboard-panel"
          >
            <HomePanel
              session={session}
              tasks={tasks}
              reminders={reminders}
              scheduleEntries={scheduleEntries}
              xp={xp}
              streakDays={streakDays}
              unlockedAchievements={unlockedAchievements}
              totalTasksEverCompleted={totalTasksEverCompleted}
              gamificationStats={gamificationStats}
              onNavigate={navigateToTab}
              isDarkMode={isDarkMode}
            />
          </section>

          {/* Regular sections */}
          <section
            id="panel-tasks"
            role="tabpanel"
            aria-labelledby="tab-tasks"
            hidden={activeTab !== 'tasks'}
            className="dashboard-panel"
          >
            {!startedFeatures.tasks ? (
              <div className="feature-landing">
                <div className="feature-landing__content">
                  <div className="feature-landing__icon"><Sticker name="tasks" size={56} /></div>
                  <h2 className="feature-landing__title">Plan de Estudio</h2>
                  <p className="feature-landing__description">
                    Organiza tus tareas de forma inteligente y mantén un seguimiento de tu progreso académico. Marca tareas como completadas y celebra tus logros.
                  </p>
                  <button 
                    className="feature-landing__button"
                    onClick={() => handleStartFeature('tasks')}
                  >
                    Iniciar
                  </button>
                </div>
              </div>
            ) : (
              <section className="panel panel--tasks" aria-labelledby="tasks-heading" data-sticker="Plan de estudio" data-icon="📚">
                <div className="panel__toolbar">
                </div>

                <div className="panel__content panel__content--tasks">
                  <TaskList
                    tasks={tasks}
                    onMarkComplete={handleMarkComplete}
                    onAdd={handleAddTask}
                    onDelete={handleDeleteTask}
                    isSessionActive={Boolean(session)}
                    unlockedAchievements={unlockedAchievements}
                  />
                </div>
              </section>
            )}
          </section>
        <section
          id="panel-timer"
          role="tabpanel"
          aria-labelledby="tab-timer"
          hidden={activeTab !== 'timer'}
          className="dashboard-panel"
        >
          {!startedFeatures.timer ? (
            <div className="feature-landing">
              <div className="feature-landing__content">
                <div className="feature-landing__icon"><Sticker name="flow" size={56} /></div>
                <h2 className="feature-landing__title">Focus</h2>
                <p className="feature-landing__description">
                  Optimiza tus sesiones de estudio con 3 métodos científicos: Pomodoro, Flowtime y 52/17. Monitoreo anti-distracciones, checkpoints con IA y recomendaciones personalizadas.
                </p>
                <button 
                  className="feature-landing__button"
                  onClick={() => handleStartFeature('timer')}
                >
                  Iniciar
                </button>
              </div>
            </div>
          ) : (
            <StudyFlow 
              onSessionComplete={handleSessionComplete} 
              tasks={tasks}
              onTaskUpdate={handleUpdateTask}
            />
          )}
        </section>
        <section
          id="panel-calendar"
          role="tabpanel"
          aria-labelledby="tab-calendar"
          hidden={activeTab !== 'calendar'}
          className="dashboard-panel"
        >
          {!startedFeatures.calendar ? (
            <div className="feature-landing">
              <div className="feature-landing__content">
                <div className="feature-landing__icon"><Sticker name="calendar" size={56} /></div>
                <h2 className="feature-landing__title">Tu Horario</h2>
                <p className="feature-landing__description">
                  Visualiza tu calendario de Google integrado. Organiza tus clases, eventos importantes y mantén un horario sincronizado con todos tus dispositivos.
                </p>
                <button 
                  className="feature-landing__button"
                  onClick={() => handleStartFeature('calendar')}
                >
                  Iniciar
                </button>
              </div>
            </div>
          ) : (
            <SchedulePlanner
              schedule={scheduleEntries}
              tasks={tasks}
              onAdd={handleAddScheduleEntry}
              onDelete={handleDeleteScheduleEntry}
            />
          )}
        </section>
        <section
          id="panel-reminders"
          role="tabpanel"
          aria-labelledby="tab-reminders"
          hidden={activeTab !== 'reminders'}
          className="dashboard-panel"
        >
          {!startedFeatures.reminders ? (
            <div className="feature-landing">
              <div className="feature-landing__content">
                <div className="feature-landing__icon"><Sticker name="bell" size={56} /></div>
                <h2 className="feature-landing__title">Recordatorios</h2>
                <p className="feature-landing__description">
                  Programa notificaciones automáticas para tus tareas importantes. Recibe avisos por correo en el momento exacto para nunca olvidar un plazo.
                </p>
                <button 
                  className="feature-landing__button"
                  onClick={() => handleStartFeature('reminders')}
                >
                  Iniciar
                </button>
              </div>
            </div>
          ) : (
            <ReminderList
              reminders={reminders}
              onAdd={handleAddReminder}
              onUpdate={handleUpdateReminder}
              onDelete={handleDeleteReminder}
              session={session}
            />
          )}
        </section>
        <section
          id="panel-summary"
          role="tabpanel"
          aria-labelledby="tab-summary"
          hidden={activeTab !== 'summary'}
          className="dashboard-panel"
        >
          {!startedFeatures.summary ? (
            <div className="feature-landing">
              <div className="feature-landing__content">
                <div className="feature-landing__icon"><Sticker name="spark" size={56} /></div>
                <h2 className="feature-landing__title">Asistente IA Iris</h2>
                <p className="feature-landing__description">
                  Tu asistente académico inteligente. Analiza documentos, crea resúmenes, extrae ideas clave y responde preguntas complejas usando IA avanzada.
                </p>
                <button 
                  className="feature-landing__button"
                  onClick={() => handleStartFeature('summary')}
                >
                  Iniciar
                </button>
              </div>
            </div>
          ) : (
            <AIAssistant
              onUpload={handleSummaryUpload}
              summary={summary}
              isLoading={isSummarizing}
              onStopSpeaking={stopSpeaking}
              onAddTask={handleAddTask}
              onAddReminder={handleAddReminder}
            />
          )}
        </section>

        {/* Achievement/Logros Section */}
        <section
          id="panel-achievements"
          role="tabpanel"
          aria-labelledby="tab-achievements"
          hidden={activeTab !== 'achievements'}
          className="dashboard-panel"
        >
          {!startedFeatures.achievements ? (
            <div className="feature-landing">
              <div className="feature-landing__content">
                <div className="feature-landing__icon"><Sticker name="trophy" size={56} /></div>
                <h2 className="feature-landing__title">Logros y Racha</h2>
                <p className="feature-landing__description">
                  Gamificación completa de tu aprendizaje. Desbloquea logros, mantén rachas diarias, gana XP y sube de nivel mientras avanzas académicamente.
                </p>
                <button 
                  className="feature-landing__button"
                  onClick={() => handleStartFeature('achievements')}
                >
                  Iniciar
                </button>
              </div>
            </div>
          ) : (
            session && (
              <AchievementSystem
                stats={gamificationStats}
                userEmail={session.email}
                onAchievementUnlocked={handleAchievementUnlocked}
                unlockedAchievements={unlockedAchievements}
                setUnlockedAchievements={setUnlockedAchievements}
                setParentUnlockedAchievements={setUnlockedAchievements}
                onRatingModalOpen={handleOpenRatingModal}
                xp={xp}
                streakDays={streakDays}
              />
            )
          )}
        </section>
        </main>
      </div>
      
      <DisplayNamePrompt
        isOpen={isNamePromptOpen}
        onClose={handleDismissNamePrompt}
        onSubmit={handleDisplayNameSubmit}
        suggestedName={session ? deriveFallbackName(session.email) : ''}
      />
      
      {/* Notification Center */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        session={session}
      />

      {/* Banner de permisos de notificaciones */}
      {session && (
        <NotificationPermissionBanner 
          onPermissionGranted={() => {
            console.log('✅ Notificaciones habilitadas')
          }}
        />
      )}

      {/* Indicador de estado offline/online */}
      <OfflineIndicator />
      
      {/* FAB buttons now embedded in components */}
      
      {/* Reminder FAB - mostrado cuando el tab de recordatorios está activo */}
      {session && activeTab === 'reminders' && startedFeatures.reminders && (
        <button
          className="reminder-list-fab"
          onClick={() => {
            document.dispatchEvent(new CustomEvent('openReminderModal'))
          }}
          aria-label="Añadir recordatorio"
          title="Añadir recordatorio"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
      

      
      {/* Selector de avatares */}
      <AvatarSelector
        isOpen={isAvatarSelectorOpen}
        onClose={() => setIsAvatarSelectorOpen(false)}
        currentAvatar={userAvatar}
        onSelectAvatar={handleSelectAvatar}
      />
      
      {/* Rating Modal - Aparece después de celebración de logro */}
      <RatingModal
        achievement={achievementToRate}
        onSubmit={handleSubmitFeedback}
        onClose={() => {
          setShowRatingModal(false)
          setAchievementToRate(null)
        }}
        isOpen={showRatingModal}
        apiBase={API_URL}
      />

      {/* Admin Ratings Panel - Modal para ver calificaciones */}
      {showAdminFeedback && (
        <div className="admin-panel-modal-overlay">
          <div className="admin-panel-modal">
            <button
              className="admin-panel-close"
              onClick={() => setShowAdminFeedback(false)}
              aria-label="Cerrar panel"
            >
              ×
            </button>
            <AdminRatingsPanel />
          </div>
        </div>
      )}
      
      {/* Celebración de hito de racha */}
      <StreakCelebration 
        milestone={streakMilestoneToShow}
        isVisible={!!streakMilestoneToShow}
        onClose={() => setStreakMilestoneToShow(null)}
        onRatingModalOpen={handleOpenRatingModal}
      />
      
      {/* Celebración de logro - Aparece cuando se desbloquea un logro */}
      <AchievementCelebration
        achievement={achievementToCelebrate}
        isVisible={showAchievementCelebration}
        onClose={() => {
          setShowAchievementCelebration(false)
          setAchievementToCelebrate(null)
        }}
        onCelebrationComplete={(achievement) => {
          // Después de la celebración, mostrar modal de reseña
          setShowAchievementCelebration(false)
          setAchievementToCelebrate(null)
          if (handleOpenRatingModal) {
            handleOpenRatingModal(achievement)
          }
        }}
      />

      {/* ── Modo Crisis (overlay) ── */}
      <CrisisMode
        isOpen={showCrisisMode}
        onClose={() => setShowCrisisMode(false)}
        tasks={tasks}
        apiUrl={API_URL}
        authenticatedFetch={authenticatedFetch}
        onCrisisResolved={() => {
          awardXP(15, 'Sesión de crisis superada')
        }}
        onRetakeTest={handleRetakeTest}
      />

      {/* ── Diario de Energía (post-sesión) ── */}
      <EnergyJournal
        isOpen={showEnergyJournal}
        onClose={() => setShowEnergyJournal(false)}
        apiUrl={API_URL}
        authenticatedFetch={authenticatedFetch}
        sessionType="pomodoro"
        sessionDuration={25}
        onSubmit={(entry) => {
          console.log('📊 Energy entry recorded:', entry.energy_level)
        }}
      />
    </div>
  )
}

export default App

