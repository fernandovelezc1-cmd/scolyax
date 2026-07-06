/**
 * Asistente de IA tipo ChatGPT integrado
 * Soporta: Análisis de sentimiento, Categorización, Extracción de entidades, Generación, Q&A
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import Sticker from './Stickers'
import './IrisWelcome.css'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

const IRIS_AI_SERVICES = [
  { key: 'resumen', label: 'Resúmenes', sticker: 'doc' },
  { key: 'generate', label: 'Generar contenido', sticker: 'write' },
  { key: 'research', label: 'Investigación', sticker: 'research' },
  { key: 'qa', label: 'Q&A de documentos', sticker: 'qa' },
  { key: 'sentiment', label: 'Sentimiento', sticker: 'mind' },
]
const IRIS_TOOLS = [
  { key: 'createTask', label: 'Crear tarea', sticker: 'tasks' },
  { key: 'createReminder', label: 'Recordatorio', sticker: 'bell' },
  { key: 'categorize', label: 'Categorizar', sticker: 'folder' },
  { key: 'entities', label: 'Entidades', sticker: 'tag' },
  { key: 'voice', label: 'Dictado / Voz', sticker: 'mic' },
]

const AIAssistant = ({ onUpload, summary, isLoading, onStopSpeaking, onAddTask, onAddReminder }) => {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isNarrating, setIsNarrating] = useState(false) // Modo narración (🎤)
  const [isCommanding, setIsCommanding] = useState(false) // Modo comando (🎙️)
  const [voiceSource, setVoiceSource] = useState(null) // 'narration' o 'command' para detectar origen
  const [editingMessageId, setEditingMessageId] = useState(null) // ID del mensaje en edición
  const [editingText, setEditingText] = useState('') // Texto temporal durante edición
  const [uploadedFiles, setUploadedFiles] = useState([]) // Array de archivos {id, name, text, size}
  const [speaking, setSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [welcomeShown, setWelcomeShown] = useState(false)
  const [userName, setUserName] = useState('Usuario')
  const [currentTopic, setCurrentTopic] = useState('') // NEW: tema actual de la conversación
  const [lastDocument, setLastDocument] = useState(null) // NEW: último documento seleccionado
  
  // 🆕 Estado para flujo guiado de creación de tareas/recordatorios
  const [creationMode, setCreationMode] = useState(null) // 'task' | 'reminder' | null
  const [creationStep, setCreationStep] = useState(0) // Paso actual del flujo
  const [creationData, setCreationData] = useState({}) // Datos recolectados
  
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const recognitionNarrationRef = useRef(null) // Para narración 🎤
  const recognitionCommandRef = useRef(null) // Para comandos 🎙️
  const syntheticRef = useRef(null)
  const voiceTranscriptRef = useRef('') // Transcripción temporal
  const voiceModeRef = useRef('') // 'narration' o 'command'
  const canvasRef = useRef(null) // Canvas para animación de audio
  const animationFrameRef = useRef(null) // Para controlar la animación
  // TTS vía backend gTTS — sin speechSynthesis del navegador

  // Get user name
  useEffect(() => {
    try {
      const storedUserName = localStorage.getItem('userName') || 'Usuario'
      setUserName(storedUserName)
    } catch (e) {
      setUserName('Usuario')
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 0)
  }, [messages])

  // Animación de ondas de audio en el canvas
  useEffect(() => {
    if (!canvasRef.current || (!isNarrating && !isCommanding)) {
      // Detener animación si no está grabando
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let phase = 0

    const drawWaveform = () => {
      const width = canvas.width
      const height = canvas.height
      const centerY = height / 2

      // Limpiar canvas
      ctx.clearRect(0, 0, width, height)

      // Configurar estilo
      ctx.strokeStyle = isCommanding ? '#f59e0b' : '#a9b71a'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'

      // Dibujar 3 ondas con diferentes frecuencias
      for (let wave = 0; wave < 3; wave++) {
        ctx.beginPath()
        const amplitude = 15 - wave * 4
        const frequency = 0.02 + wave * 0.01
        const phaseShift = wave * Math.PI / 3

        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * frequency + phase + phaseShift) * amplitude
          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }

        ctx.globalAlpha = 0.7 - wave * 0.2
        ctx.stroke()
      }

      phase += 0.08
      animationFrameRef.current = requestAnimationFrame(drawWaveform)
    }

    drawWaveform()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isNarrating, isCommanding])

  // Initialize Speech Recognition para NARRACIÓN (🎤)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('🎤 Speech Recognition no disponible en este navegador')
      return
    }

    try {
      recognitionNarrationRef.current = new SpeechRecognition()
      recognitionNarrationRef.current.lang = 'es-ES'
      recognitionNarrationRef.current.continuous = true // Para que no se detenga con silencios
      recognitionNarrationRef.current.interimResults = true

      recognitionNarrationRef.current.onstart = () => {
        console.log('🎤 Modo NARRACIÓN activado - Habla libremente')
        setIsNarrating(true)
        setVoiceSource('narration') // Marcar origen
      }

      recognitionNarrationRef.current.onresult = (event) => {
        let finalTranscript = ''
        let interimTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }
        
        // Actualizar el textarea en tiempo real
        if (finalTranscript) {
          setInputValue(prev => {
            const prevText = typeof prev === 'string' ? prev : String(prev || '')
            return prevText + finalTranscript
          })
          console.log('📝 Texto agregado:', finalTranscript)
        }
      }

      recognitionNarrationRef.current.onend = () => {
        console.log('🎤 Narración detenida manualmente')
        setIsNarrating(false)
        // NO hacer nada más - el texto ya está en el textarea
        // El usuario decide cuándo enviar con el botón ➤
        // voiceSource se mantiene para que handleSend lo detecte
      }

      recognitionNarrationRef.current.onerror = (event) => {
        console.error('🎤 Error narración:', event.error)
        setIsNarrating(false)
        
        if (event.error === 'not-allowed') {
          alert('🎤 Permiso de micrófono denegado. Ve a la configuración del navegador → Permisos del sitio → Micrófono → Permitir.')
        } else if (event.error === 'no-speech') {
          console.log('⏸️ Sin audio detectado, pero sigue grabando...')
        }
      }
    } catch (error) {
      console.error('Error inicializando narración:', error)
    }
  }, [])

  // Initialize Speech Recognition para COMANDOS (🎙️)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('🎙️ Speech Recognition no disponible en este navegador')
      return
    }

    try {
      recognitionCommandRef.current = new SpeechRecognition()
      recognitionCommandRef.current.lang = 'es-ES'
      recognitionCommandRef.current.continuous = true // Para capturar toda la petición
      recognitionCommandRef.current.interimResults = true

      recognitionCommandRef.current.onstart = () => {
        console.log('🎯 Modo COMANDO activado - Di tu petición')
        setIsCommanding(true)
        setVoiceSource('command') // Marcar origen
      }

      recognitionCommandRef.current.onresult = (event) => {
        let finalTranscript = ''
        let interimTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }
        
        // Actualizar el textarea en tiempo real
        if (finalTranscript) {
          setInputValue(prev => {
            const prevText = typeof prev === 'string' ? prev : String(prev || '')
            return prevText + finalTranscript
          })
          console.log('🎙️ Comando agregado:', finalTranscript)
        }
      }

      recognitionCommandRef.current.onend = () => {
        console.log('🎙️ Comando detenido manualmente')
        setIsCommanding(false)
        // NO enviar automáticamente - el texto ya está en el textarea
        // El usuario decide cuándo enviar con el botón ➤
        // voiceSource se mantiene para que handleSend lo detecte
      }

      recognitionCommandRef.current.onerror = (event) => {
        console.error('🎙️ Error comando:', event.error)
        setIsCommanding(false)
        
        if (event.error === 'not-allowed') {
          alert('🎙️ Permiso de micrófono denegado. Ve a la configuración del navegador → Permisos del sitio → Micrófono → Permitir.')
        } else if (event.error === 'no-speech') {
          console.log('⏸️ Sin audio detectado, pero sigue grabando...')
        }
      }
    } catch (error) {
      console.error('Error inicializando comandos:', error)
    }
  }, [])

  // Detener TTS (audio del backend)
  const stopSpeaking = () => {
    if (window.currentAudioElement) {
      window.currentAudioElement.pause()
      window.currentAudioElement.currentTime = 0
      window.currentAudioElement = null
    }
    setSpeaking(false)
  }

  // Text to Speech streaming con edge-tts (voces neuronales humanas de Microsoft)
  // Usa GET /tts/stream → el audio empieza a sonar mientras se genera
  const speak = (text, force = false) => {
    const textToSpeak = typeof text === 'string' ? text : String(text || '')
    if (!textToSpeak || !textToSpeak.trim()) return

    // Detener cualquier reproducción anterior
    stopSpeaking()

    const cleaned = textToSpeak.substring(0, 5000)
    const params = new URLSearchParams({
      text: cleaned,
      voice: 'es-CO-SalomeNeural',
      rate: '+5%',
      pitch: '+0Hz'
    })

    console.log('🔊 [TTS-Stream] Iniciando audio streaming edge-tts...')
    setSpeaking(true)

    const audio = new Audio(`${API_URL}/tts/stream?${params.toString()}`)
    window.currentAudioElement = audio

    audio.onplay = () => console.log('▶️ Audio streaming iniciado')
    audio.onended = () => {
      console.log('✅ Audio TTS finalizado')
      setSpeaking(false)
      window.currentAudioElement = null
    }
    audio.onerror = () => {
      console.error('❌ Error al reproducir audio TTS stream')
      setSpeaking(false)
      window.currentAudioElement = null
    }

    audio.play().catch(err => {
      console.error('❌ Error play():', err.message)
      setSpeaking(false)
      window.currentAudioElement = null
    })
  }

  // Exponer speak globalmente para usarla desde el useEffect de reconocimiento de voz
  useEffect(() => {
    window.irisSpeakFunction = speak
    return () => {
      delete window.irisSpeakFunction
    }
  }, [])

  // Auto-play summary cuando se recibe - DESACTIVADO: usuario controla manualmente
  // useEffect(() => {
  //   if (summary && !speaking) {
  //     speak(summary, true)
  //   }
  // }, [summary, speaking])

  // API calls
  const analyzeSentiment = async (text) => {
    const formData = new FormData()
    formData.append('text', text)
    
    try {
      const response = await fetch(`${API_URL}/ai/sentiment`, {
        method: 'POST',
        body: formData
      })
      return await response.json()
    } catch (e) {
      return { error: 'Error analizando sentimiento: ' + e.message }
    }
  }

  const categorizeText = async (text, categories) => {
    const formData = new FormData()
    formData.append('text', text)
    if (categories) formData.append('categories', categories)
    
    try {
      const response = await fetch(`${API_URL}/ai/categorize`, {
        method: 'POST',
        body: formData
      })
      return await response.json()
    } catch (e) {
      return { error: 'Error categorizando: ' + e.message }
    }
  }

  const extractEntities = async (text) => {
    const formData = new FormData()
    formData.append('text', text)
    
    try {
      const response = await fetch(`${API_URL}/ai/entities`, {
        method: 'POST',
        body: formData
      })
      return await response.json()
    } catch (e) {
      return { error: 'Error extrayendo entidades: ' + e.message }
    }
  }

  const generateContent = async (prompt, includeContext = true) => {
    // NEW: Construir contexto inteligente a partir del historial
    let enrichedPrompt = prompt
    
    if (includeContext) {
      // Extraer tema actual de los últimos mensajes
      const recentMessages = messages.slice(-6) // Últimos 6 mensajes para contexto
      const topic = currentTopic || 
        recentMessages
          .filter(m => m.type === 'user')
          .slice(-1)[0]?.content?.substring(0, 50) || ''
      
      // Si hay contexto de tema o documento, incluirlo
      if (topic || lastDocument) {
        enrichedPrompt = `CONTEXTO DE CONVERSACIÓN:\n`
        if (topic) enrichedPrompt += `- Tema actual: "${topic}"\n`
        if (lastDocument) enrichedPrompt += `- Documento activo: "${lastDocument.name}"\n`
        enrichedPrompt += `\nPREGUNTA/INSTRUCCIÓN:\n${prompt}`
      }
    }
    
    const formData = new FormData()
    formData.append('prompt', enrichedPrompt)
    formData.append('max_length', 8000) // Sin truncamiento — respuestas completas
    
    try {
      const response = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        body: formData
      })
      return await response.json()
    } catch (e) {
      return { error: 'Error generando contenido: ' + e.message }
    }
  }

  const answerQuestion = async (document, question) => {
    // NEW: Enriquecer la pregunta con contexto anterior
    let enrichedQuestion = question
    
    // Si hay mensajes previos sobre el mismo documento, incluir contexto
    const prevMessages = messages.slice(-4).filter(m => m.type === 'assistant')
    if (prevMessages.length > 0) {
      enrichedQuestion = `CONTEXTO ANTERIOR:\n${prevMessages.map(m => m.content).join('\n\n')}\n\nNUEVA PREGUNTA:\n${question}`
    }
    
    const formData = new FormData()
    formData.append('document', document)
    formData.append('question', enrichedQuestion)
    
    try {
      const response = await fetch(`${API_URL}/ai/qa`, {
        method: 'POST',
        body: formData
      })
      return await response.json()
    } catch (e) {
      return { error: 'Error respondiendo: ' + e.message }
    }
  }

  // Handle file upload - Send directly to backend for processing
  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Verificar límite de 5 documentos
    if (uploadedFiles.length >= 5) {
      addMessage('assistant', `Máximo 5 documentos permitidos. Tienes ${uploadedFiles.length} cargados. Elimina uno antes de agregar otro.`)
      return
    }

    // Validar que el archivo tiene nombre válido
    if (!file || !file.name || typeof file.name !== 'string') {
      addMessage('assistant', 'Error: archivo sin nombre válido.')
      return
    }

    const allowedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
    const imageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    const fileNameParts = file.name.split('.')
    const extension = fileNameParts.length > 0 ? fileNameParts.pop().toLowerCase() : ''
    const isImage = imageTypes.includes(file.type) || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)
    
    if (!isImage && !allowedTypes.includes(file.type) && !['txt', 'pdf', 'docx', 'pptx'].includes(extension)) {
      addMessage('assistant', `Formato no soportado. Usa: TXT, PDF, DOCX, PPTX, JPG, PNG, GIF o WEBP.`)
      return
    }

    setIsProcessing(true)

    try {
      // ── Si es imagen, guardar el archivo y pedir instrucción al usuario ──
      if (isImage) {
        const newFile = {
          id: `file-${Date.now()}`,
          name: file.name,
          rawFile: file,
          text: '',
          size: 0,
          isImage: true
        }
        setUploadedFiles(prev => [...prev, newFile])
        addMessage('assistant', `🖼️ Imagen **"${file.name}"** adjunta. ¿Qué quieres que haga Iris con ella? Escribe tu instrucción y presiona Enviar.`)
        setIsProcessing(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      // ── Documentos de texto ──
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_URL}/ai/extract-text`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.error) {
        addMessage('assistant', `**Error procesando archivo:** ${result.error}`)
      } else {
        // Agregar a array de archivos cargados
        const newFile = {
          id: `file-${Date.now()}`,
          name: file.name,
          text: result.text,
          size: result.word_count || 0
        }
        
        setUploadedFiles(prev => [...prev, newFile])
        // No mostrar mensajes automáticos - dejar que el usuario decida si enviar con el archivo
      }
    } catch (error) {
      addMessage('assistant', `**Error cargando archivo:** ${error.message}`)
    } finally {
      setIsProcessing(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }
  // Remover un archivo del array
  const removeUploadedFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  // Truncar nombre de archivo largo
  const truncateFileName = (fileName, maxLength = 25) => {
    // Validar que fileName es una cadena válida
    if (!fileName || typeof fileName !== 'string') {
      return 'archivo_sin_nombre'
    }
    
    if (fileName.length <= maxLength) return fileName
    
    const dotIndex = fileName.lastIndexOf('.')
    if (dotIndex === -1) {
      // Si no hay extensión, truncar directamente
      return fileName.substring(0, maxLength - 3) + '...'
    }
    
    const name = fileName.substring(0, dotIndex)
    const ext = fileName.substring(dotIndex)
    
    const nameLength = maxLength - ext.length - 3 // 3 para "..."
    if (nameLength <= 0) {
      // Si la extensión es muy larga, mostrar solo parte del nombre
      return fileName.substring(0, maxLength - 3) + '...'
    }
    
    return name.substring(0, nameLength) + '...' + ext
  }

  // 🗓️ Parser de fechas en español natural ("dos de marzo del 2026", "15 de abril", etc.)
  const parseSpanishDate = (text) => {
    const lower = text.toLowerCase().trim()

    // Mapa de nombres de mes → índice 0-11
    const monthMap = {
      enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
      julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
    }

    // Mapa de números escritos en español → valor numérico
    const numberWords = {
      primero: 1, primer: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
      seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
      once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
      dieciséis: 16, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
      veinte: 20, veintiuno: 21, veintiún: 21, veintidós: 22, veintidos: 22,
      veintitrés: 23, veintitres: 23, veinticuatro: 24, veinticinco: 25,
      veintiséis: 26, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
      treinta: 30, 'treinta y uno': 31
    }

    // Parsear el día: primero intenta "treinta y uno", luego palabras simples, luego dígitos
    const parseDayFromText = (str) => {
      if (/treinta y uno/i.test(str)) return 31
      for (const [word, val] of Object.entries(numberWords)) {
        if (str.includes(word)) return val
      }
      const digitMatch = str.match(/(\d{1,2})/)
      return digitMatch ? parseInt(digitMatch[1]) : null
    }

    // Detectar mes
    let detectedMonth = null
    let monthName = null
    for (const [name, idx] of Object.entries(monthMap)) {
      if (lower.includes(name)) {
        detectedMonth = idx
        monthName = name
        break
      }
    }

    if (detectedMonth === null) return null // No encontró mes → no es una fecha en español

    // Extraer día (todo lo que está antes de "de [mes]")
    const beforeMonth = lower.split(monthName)[0]
    const day = parseDayFromText(beforeMonth || lower)
    if (!day || day < 1 || day > 31) return null

    // Extraer año ("del 2026", "de 2026", "2026" después del mes)
    const afterMonth = lower.split(monthName)[1] || ''
    const yearMatch = afterMonth.match(/(\d{4})/)
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

    // Validar que la fecha sea real
    const dateObj = new Date(year, detectedMonth, day)
    if (dateObj.getFullYear() !== year || dateObj.getMonth() !== detectedMonth || dateObj.getDate() !== day) {
      return null // Fecha inválida (e.g., 31 de febrero)
    }

    return dateObj
  }

  // 🆕 FLUJO GUIADO: Crear tareas y recordatorios paso a paso
  const handleCreationFlow = async (userInput) => {
    const input = userInput.trim()
    const inputLower = input.toLowerCase()

    // Cancelar en cualquier paso
    if (inputLower === 'cancelar' || inputLower === 'salir' || inputLower === 'cancel') {
      setCreationMode(null)
      setCreationStep(0)
      setCreationData({})
      addMessage('assistant', '❌ **Creación cancelada.** No te preocupes, puedes intentarlo cuando quieras. 😊\n\n💡 Escribe "crear tarea" o "crear recordatorio" para empezar de nuevo.')
      return true
    }

    // ─── FLUJO DE TAREA ────────────────────────────────
    if (creationMode === 'task') {
      switch (creationStep) {
        case 1: // Esperando título
          setCreationData(prev => ({ ...prev, title: input }))
          setCreationStep(2)
          addMessage('assistant', `✅ Título: **"${input}"**\n\n📚 **¿A qué asignatura o materia pertenece?**\n\n_(Escribe el nombre de la materia, o "General" si no aplica)_`)
          return true

        case 2: // Esperando asignatura
          setCreationData(prev => ({ ...prev, course: input }))
          setCreationStep(3)
          addMessage('assistant', `✅ Asignatura: **${input}**\n\n📅 **¿Tiene fecha de entrega?**\n\n_(Ejemplo: "dos de marzo del 2026", "15 de abril", "mañana", "3/3" o "no" si no tiene)_`)
          return true

        case 3: { // Esperando fecha
          let dueDate = null
          // Helper: formato YYYY-MM-DD en hora LOCAL (sin UTC)
          const toLocalDateStr = (d) => {
            const y = d.getFullYear()
            const m = String(d.getMonth() + 1).padStart(2, '0')
            const dd = String(d.getDate()).padStart(2, '0')
            return `${y}-${m}-${dd}`
          }

          if (inputLower !== 'no' && inputLower !== 'sin fecha' && inputLower !== 'ninguna') {
            const today = new Date()
            if (inputLower === 'hoy') {
              dueDate = toLocalDateStr(today)
            } else if (inputLower === 'mañana') {
              const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
              dueDate = toLocalDateStr(tomorrow)
            } else if (inputLower.includes('pasado mañana')) {
              const dayAfter = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)
              dueDate = toLocalDateStr(dayAfter)
            } else if (/próxima semana|proxima semana|la semana que viene/.test(inputLower)) {
              const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)
              dueDate = toLocalDateStr(nextWeek)
            } else if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
              dueDate = input.substring(0, 10)
            } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(input)) {
              const parts = input.split('/')
              dueDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
            } else if (/^\d{1,2}\/\d{1,2}$/.test(input)) {
              const parts = input.split('/')
              dueDate = `${today.getFullYear()}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
            } else {
              // 🗓️ Intentar parseo de fecha en español natural
              const spanishParsed = parseSpanishDate(input)
              if (spanishParsed) {
                dueDate = toLocalDateStr(spanishParsed)
              } else {
                const parsed = new Date(input + ' 12:00:00')
                if (!isNaN(parsed.getTime())) {
                  dueDate = toLocalDateStr(parsed)
                } else {
                  dueDate = input
                }
              }
            }
          }

          // Mostrar fecha legible LOCAL
          let datePreview = dueDate || 'Sin fecha'
          if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            const [y, m, d] = dueDate.split('-').map(Number)
            const dateObj = new Date(y, m - 1, d)
            datePreview = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          }

          setCreationData(prev => ({ ...prev, dueDate }))

          // Si no tiene fecha, saltar directo a notas (paso 5)
          if (!dueDate) {
            setCreationStep(5)
            addMessage('assistant', `✅ Fecha: **Sin fecha**\n\n📝 **¿Alguna nota adicional?**\n\n_(Escribe tus notas o "no" para omitir)_`)
          } else {
            setCreationStep(4)
            addMessage('assistant', `✅ Fecha: **${datePreview}**\n\n🕐 **¿A qué hora es la entrega?**\n\n_(Ejemplo: "2:30pm", "14:30", "9am" o "no" si no tiene hora)_`)
          }
          return true
        }

        case 4: { // Esperando hora
          let time = null
          if (inputLower !== 'no' && inputLower !== 'sin hora' && inputLower !== 'ninguna') {
            // Parsear formatos de hora comunes
            const timeMatch = input.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?/i)
            if (timeMatch) {
              let hours = parseInt(timeMatch[1])
              const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0
              const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null

              if (ampm === 'pm' && hours < 12) hours += 12
              if (ampm === 'am' && hours === 12) hours = 0

              time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
            }
          }

          // Combinar fecha + hora
          if (time && creationData.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(creationData.dueDate)) {
            setCreationData(prev => ({ ...prev, dueDate: `${prev.dueDate}T${time}:00`, time }))
          } else {
            setCreationData(prev => ({ ...prev, time: time || null }))
          }

          const timeDisplay = time || 'Sin hora'
          setCreationStep(5)
          addMessage('assistant', `✅ Hora: **${timeDisplay}**\n\n📝 **¿Alguna nota adicional?**\n\n_(Escribe tus notas o "no" para omitir)_`)
          return true
        }

        case 5: { // Esperando notas → CREAR TAREA
          const notes = (inputLower === 'no' || inputLower === 'sin notas' || inputLower === 'sin nota' || inputLower === 'ninguna') ? '' : input
          const taskData = { ...creationData, notes }

          // Mostrar resumen con fecha + hora LOCAL correcta
          let dateDisplay = 'Sin fecha'
          const rawDate = taskData.dueDate || ''
          const datePart = rawDate.substring(0, 10)
          if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            const [y, m, d] = datePart.split('-').map(Number)
            const dateObj = new Date(y, m - 1, d)
            dateDisplay = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          } else if (taskData.dueDate) {
            dateDisplay = taskData.dueDate
          }
          const timeDisplay = taskData.time ? ` a las ${taskData.time}` : ''

          addMessage('assistant', `🎉 **¡Tarea creada exitosamente!**\n\n📋 **Resumen:**\n• 📝 **Título:** ${taskData.title}\n• 📚 **Asignatura:** ${taskData.course}\n• 📅 **Fecha:** ${dateDisplay}${timeDisplay}\n• 📄 **Notas:** ${notes || 'Ninguna'}\n\n✅ Tu tarea ya aparece en la pestaña **"Tareas"**. ¡Mucho éxito! 💪✨`)

          // Llamar al callback para crear la tarea
          if (onAddTask) {
            console.log('📋 Iris → onAddTask:', { title: taskData.title, course: taskData.course, dueDate: taskData.dueDate, notes })
            try {
              await onAddTask({
                title: taskData.title,
                course: taskData.course || 'General',
                dueDate: taskData.dueDate || null,
                notes: notes || '',
                estimated_pomodoros: 0
              })
              console.log('✅ Tarea creada correctamente desde Iris')
            } catch (err) {
              console.error('❌ Error al crear tarea desde Iris:', err)
              addMessage('assistant', `⚠️ **Hubo un error al guardar la tarea:** ${err.message}\n\nPero no te preocupes, intenta de nuevo. 😊`)
            }
          } else {
            console.warn('⚠️ onAddTask no está disponible')
          }

          // Limpiar estado de creación
          setCreationMode(null)
          setCreationStep(0)
          setCreationData({})
          return true
        }

        default:
          break
      }
    }

    // ─── FLUJO DE RECORDATORIO ─────────────────────────
    if (creationMode === 'reminder') {
      switch (creationStep) {
        case 1: // Esperando título
          setCreationData(prev => ({ ...prev, title: input }))
          setCreationStep(2)
          addMessage('assistant', `✅ Título: **"${input}"**\n\n📝 **¿Alguna descripción adicional?**\n\n_(Escribe la descripción o "no" para omitir)_`)
          return true

        case 2: { // Esperando descripción
          const description = (inputLower === 'no' || inputLower === 'sin descripción' || inputLower === 'ninguna') ? '' : input
          setCreationData(prev => ({ ...prev, description }))
          setCreationStep(3)
          addMessage('assistant', `✅ Descripción: **${description || 'Sin descripción'}**\n\n📅 **¿Para qué fecha y hora quieres el recordatorio?**\n\n_(Ejemplo: "dos de marzo del 2026", "15 de abril", "mañana" o "2026-04-20")_`)
          return true
        }

        case 3: { // Esperando fecha/hora
          let remindAt = null
          const today = new Date()
          // Helper: formato YYYY-MM-DD local
          const toLocalStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

          if (inputLower === 'hoy') {
            const h = new Date(today.getFullYear(), today.getMonth(), today.getDate(), today.getHours() + 1, 0, 0)
            remindAt = `${toLocalStr(h)}T${String(h.getHours()).padStart(2,'0')}:00:00`
          } else if (inputLower === 'mañana') {
            const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 9, 0, 0)
            remindAt = `${toLocalStr(tomorrow)}T09:00:00`
          } else if (inputLower.includes('pasado mañana')) {
            const dayAfter = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 9, 0, 0)
            remindAt = `${toLocalStr(dayAfter)}T09:00:00`
          } else if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(input)) {
            // "2026-04-20 14:30" → guardar tal cual
            remindAt = input.replace(/\s+/, 'T') + ':00'
          } else if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
            remindAt = input.substring(0, 10)
          } else if (/^\d{1,2}\/\d{1,2}$/.test(input)) {
            const parts = input.split('/')
            remindAt = `${today.getFullYear()}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
          } else {
            // 🗓️ Intentar parseo de fecha en español natural
            const spanishParsed = parseSpanishDate(input)
            if (spanishParsed) {
              remindAt = toLocalStr(spanishParsed)
            } else {
              const parsed = new Date(input + ' 12:00:00')
              if (!isNaN(parsed.getTime())) {
                remindAt = toLocalStr(parsed)
              } else {
                remindAt = input
              }
            }
          }

          // Preview legible
          let datePreview = remindAt || input
          if (remindAt && /^\d{4}-\d{2}-\d{2}/.test(remindAt)) {
            const [datePart, timePart] = remindAt.split('T')
            const [y, m, d] = datePart.split('-').map(Number)
            const dateObj = new Date(y, m - 1, d)
            datePreview = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            if (timePart) datePreview += ` a las ${timePart.substring(0, 5)}`
          }

          setCreationData(prev => ({ ...prev, remindAt }))
          setCreationStep(4)
          addMessage('assistant', `✅ Fecha: **${datePreview}**\n\n🏷️ **¿Qué tipo de recordatorio es?**\n\n• 📚 **tarea** — Relacionado con una tarea académica\n• 🎯 **enfoque** — Para sesiones de estudio/enfoque\n• 👤 **personal** — Recordatorio personal\n\n_(Escribe: tarea, enfoque o personal)_`)
          return true
        }

        case 4: { // Esperando tipo → CREAR RECORDATORIO
          let type = 'personal'
          if (inputLower.includes('tarea') || inputLower === 'task') {
            type = 'task'
          } else if (inputLower.includes('enfoque') || inputLower.includes('focus') || inputLower.includes('estudio')) {
            type = 'focus'
          } else if (inputLower.includes('personal')) {
            type = 'personal'
          }

          const reminderData = { ...creationData, type }

          const typeLabels = { task: '📚 Tarea', focus: '🎯 Enfoque', personal: '👤 Personal' }
          let dateDisplay = 'Sin fecha'
          if (reminderData.remindAt && /^\d{4}-\d{2}-\d{2}/.test(reminderData.remindAt)) {
            const [datePart, timePart] = reminderData.remindAt.split('T')
            const [y, m, d] = datePart.split('-').map(Number)
            const dateObj = new Date(y, m - 1, d)
            dateDisplay = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            if (timePart) dateDisplay += ` a las ${timePart.substring(0, 5)}`
          } else if (reminderData.remindAt) {
            dateDisplay = reminderData.remindAt
          }

          addMessage('assistant', `🔔 **¡Recordatorio creado exitosamente!**\n\n📋 **Resumen:**\n• 📝 **Título:** ${reminderData.title}\n• 📄 **Descripción:** ${reminderData.description || 'Ninguna'}\n• 📅 **Fecha:** ${dateDisplay}\n• 🏷️ **Tipo:** ${typeLabels[type] || type}\n\n✅ Tu recordatorio ya aparece en la pestaña **"Recordatorios"**. ¡No se te olvidará! ⏰✨`)

          // Llamar al callback para crear el recordatorio
          if (onAddReminder) {
            console.log('🔔 Iris → onAddReminder:', { title: reminderData.title, remindAt: reminderData.remindAt, type })
            try {
              await onAddReminder({
                title: reminderData.title,
                description: reminderData.description || '',
                remindAt: reminderData.remindAt || null,
                type: type
              })
              console.log('✅ Recordatorio creado correctamente desde Iris')
            } catch (err) {
              console.error('❌ Error al crear recordatorio desde Iris:', err)
              addMessage('assistant', `⚠️ **Hubo un error al guardar el recordatorio:** ${err.message}\n\nPero no te preocupes, intenta de nuevo. 😊`)
            }
          } else {
            console.warn('⚠️ onAddReminder no está disponible')
          }

          // Limpiar estado de creación
          setCreationMode(null)
          setCreationStep(0)
          setCreationData({})
          return true
        }

        default:
          break
      }
    }

    return false // No se manejó
  }

  // 🆕 Iniciar flujo de creación de tarea
  const startTaskCreation = () => {
    setCreationMode('task')
    setCreationStep(1)
    setCreationData({})
    addMessage('assistant', '📝✨ **¡Vamos a crear una tarea!**\n\nTe guiaré paso a paso. Puedes escribir o usar el micrófono 🎙️\n\n_(Escribe "cancelar" en cualquier momento para abandonar)_\n\n**¿Cuál es el título de la tarea?**')
  }

  // 🆕 Iniciar flujo de creación de recordatorio
  const startReminderCreation = () => {
    setCreationMode('reminder')
    setCreationStep(1)
    setCreationData({})
    addMessage('assistant', '🔔✨ **¡Vamos a crear un recordatorio!**\n\nTe guiaré paso a paso. Puedes escribir o usar el micrófono 🎙️\n\n_(Escribe "cancelar" en cualquier momento para abandonar)_\n\n**¿Cuál es el título del recordatorio?**')
  }

  // Handle service item clicks
  const handleServiceClick = (service) => {
    setWelcomeShown(true)
    
    const serviceMessages = {
      resumen: {
        message: '📚💡 **Análisis y Resúmenes Inteligentes**\n\nComo Iris, puedo crear resúmenes detallados, extraer ideas clave, y analizar documentos completos usando inteligencia artificial avanzada. Carga cualquier archivo PDF, DOCX, TXT o imagen y te haré un análisis profesional.',
        example: '💡✨ Prueba: "Analiza este documento y dame los puntos clave" o carga un archivo'
      },
      sentiment: {
        message: '💭😌 **Análisis de Sentimiento Avanzado**\n\nPuedo analizar el tono emocional de textos, identificar sentimientos positivos/negativos/neutrales con precisión, y explicar el contexto emocional. ¡Perfecto para evaluar feedback, reseñas o contenido académico! 🎯💫',
        example: '💡🔍 Prueba: "Analiza el sentimiento de este texto: [tu texto aquí]"'
      },
      research: {
        message: '🔬🤓 **Investigación Académica Profesional**\n\nEspecializada en investigación profunda. Puedo analizar múltiples documentos, encontrar conexiones, crear bibliografías, y responder preguntas complejas con inteligencia artificial avanzada para investigación de alta calidad. ¡Soy tu compañera de investigación! 📖⚡',
        example: '💡🔍 Prueba: Carga varios documentos y pregunta "¿Cuáles son las conexiones entre estos textos?"'
      },
      entities: {
        message: '🏷️🎯 **Extracción de Entidades Nombradas**\n\nIdentifico automáticamente personas, lugares, organizaciones, fechas y conceptos clave en tus documentos. ¡Ideal para crear índices, referencias rápidas o mapear información importante! Soy como un detective de datos. 🕵️‍♀️📋',
        example: '💡🔍 Prueba: "Extrae todas las personas y organizaciones de este texto"'
      },
      categorize: {
        message: '📂🤖 **Categorización Inteligente de Contenido**\n\nClasifíco automáticamente textos en categorías relevantes (académico, personal, trabajo, etc.) o puedes definir tus propias categorías. ¡Perfecto para organizar grandes volúmenes de información! Soy tu organizadora personal. 🗂️✨',
        example: '💡📋 Prueba: "Categoriza este documento según tema: tecnología, educación, salud"'
      },
      voice: {
        message: '🎤🗣️ **Dictado y Síntesis de Voz Profesional**\n\nDicta contenido usando tu micrófono y yo lo convertiré en texto estructurado. También puedo leer cualquier texto en voz alta con síntesis natural. ¡Perfecto para accesibilidad y productividad! Dame tu voz y yo la entenderé. 🎵✨',
        example: '💡🎙️ Prueba: Presiona el botón 🎤 para dictar o escribe "lee esto en voz alta"'
      },
      qa: {
        message: '❓🤔 **Q&A Avanzado sobre Documentos**\n\nHaz preguntas específicas sobre cualquier documento y recibe respuestas precisas con citas directas del texto original. Mi inteligencia artificial avanzada me permite responder con alto nivel de precisión y contexto. ¡Soy tu consultora personal de documentos! 📖💡',
        example: '💡❓ Prueba: Carga un documento y pregunta "¿Cuál es la conclusión principal?" o "¿Qué dice sobre [tema específico]?"'
      },
      generate: {
        message: '✍️📝 **Generación de Contenido Académico**\n\nCreo contenido original de calidad: ensayos, resúmenes, esquemas, presentaciones, emails académicos. Puedo adaptar el tono, formato y nivel de complejidad según tus necesidades. ¡Soy tu escritora personal! 📚⚡',
        example: '💡✨ Prueba: "Genera un esquema para una presentación sobre [tema]" o "Redacta un email formal sobre [asunto]"'
      }
    }

    const config = serviceMessages[service]
    if (config) {
      addMessage('assistant', `${config.message}\n\n${config.example}`)
      setCurrentTopic(service) // Establece el contexto del servicio
    } else if (service === 'createTask') {
      // 🆕 Iniciar flujo de creación de tarea desde welcome
      if (onAddTask) {
        startTaskCreation()
      } else {
        addMessage('assistant', '⚠️ **No es posible crear tareas desde aquí en este momento.** Intenta desde la pestaña "Tareas". 📋')
      }
    } else if (service === 'createReminder') {
      // 🆕 Iniciar flujo de creación de recordatorio desde welcome
      if (onAddReminder) {
        startReminderCreation()
      } else {
        addMessage('assistant', '⚠️ **No es posible crear recordatorios desde aquí en este momento.** Intenta desde la pestaña "Recordatorios". 🔔')
      }
    } else {
      // Fallback para servicios no definidos
      addMessage('assistant', '🪻👋 **¡Hola! Soy Iris, tu agente de estudio con IA.** 😊✨\n\nNo solo respondo: entiendo tu objetivo, lo divido en pasos y te ayudo a ejecutarlo — investigación, resúmenes, planes de estudio, tareas y más. ¿Qué quieres lograr hoy? 🌟')
    }
    
    // Auto-scroll to input
    setTimeout(() => {
      document.querySelector('.ai-assistant__textarea')?.focus()
    }, 300)
  }

  // � HANDLE SIMPLE QUESTIONS LOCALLY (sin usar API)
  const handleSimpleQuestion = (userMessage) => {
    const msgLower = userMessage.toLowerCase().trim()

    // 0. MENSAJES SOCIALES / CORTESÍAS (no consumen API)
    if (/^(gracias|muchas gracias|thank you|thanks|¡gracias!|gracias iris|gracie|grax)/.test(msgLower)) {
      const responses = [
        '😊 ¡Con mucho gusto! Para eso estoy aquí. ¿Necesitas algo más? ✨',
        '🌟 ¡Fue un placer ayudarte! ¿Hay algo más en lo que pueda apoyarte? 💫',
        '😄 ¡De nada! Siempre estoy lista para ayudarte. ¡Sigue así! 🚀',
      ]
      addMessage('assistant', responses[Math.floor(Math.random() * responses.length)])
      return true
    }
    if (/^(de nada|no hay de qué|con gusto|claro que sí|no hay problema|ok|okay|perfecto|listo|entendido|chevere|chévere|genial|excelente|bien)$/.test(msgLower)) {
      addMessage('assistant', '😊 ¡Me alegra! ¿En qué más puedo ayudarte? ✨')
      return true
    }
    if (msgLower.includes('qué hora') || msgLower.includes('que hora')) {
      const now = new Date()
      const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      addMessage('assistant', `🕐 **${timeStr}** (Hora de Colombia)\n\nEs la hora exacta en tu zona. ¡Que aproveches el tiempo! ⏰✨`)
      return true
    }
    
    // 2. PREGUNTAS SOBRE EL DÍA/FECHA
    if (msgLower.includes('qué día') || msgLower.includes('que dia') || msgLower.includes('fecha') || msgLower.includes('hoy es')) {
      const now = new Date()
      const dateStr = now.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      addMessage('assistant', `📅 **${dateStr}** (Colombia)\n\n¡Espero que sea un día productivo y para aprender! 🌟`)
      return true
    }
    
    // 3. PREGUNTAS SOBRE LA ZONA HORARIA
    if (msgLower.includes('zona horaria') || msgLower.includes('timezone') || msgLower.includes('usobtc')) {
      addMessage('assistant', `🌍 **Tu zona horaria es: COT (Hora de Colombia - UTC-5)**\n\nEstás en la zona horaria de Colombia Central. ¡Perfecto para trabajar en sincronía! 🕐✨`)
      return true
    }
    
    // 4. CÁLCULOS SIMPLES
    if (msgLower.includes('cuánto es') || msgLower.includes('cuanto es') || msgLower.match(/\d+\s*[+\-*/]\s*\d+/)) {
      try {
        // Reemplazar palabras por símbolos matemáticos
        let expr = msgLower
          .replace(/más/g, '+')
          .replace(/menos/g, '-')
          .replace(/por/g, '*')
          .replace(/entre/g, '/')
          .replace(/dividido/g, '/')
        
        // Extraer la expresión matemática segura
        const match = expr.match(/\d+[\s]*[+\-*/][\s]*\d+/g)
        if (match) {
          const result = eval(match[0].replace(/\s/g, ''))
          addMessage('assistant', `🧮 **${match[0]} = ${result}**\n\n¡Cálculo rápido completado! Si necesitas análisis más complejos, aquí estoy. 📊✨`)
          return true
        }
      } catch (e) {
        // No es un cálculo válido, continuar con la IA
      }
    }
    
    // 5. PREGUNTAS SOBRE IRIS
    if (msgLower.includes('eres') || msgLower.includes('quién eres') || msgLower.includes('que eres') || msgLower.includes('quien eres')) {
      addMessage('assistant', `😊 **Soy Iris, tu asistente académico con IA avanzada.**\n\n✨ **Mis capacidades:**\n• Análisis de sentimiento\n• Categorización inteligente\n• Extracción de entidades\n• Generación de contenido\n• Q&A sobre documentos\n• Síntesis de voz\n\n🚀 ¡Estoy aquí para potenciar tu productividad académica!`)
      return true
    }
    
    // 6. PREGUNTAS FRECUENTES
    const faqMap = {
      'cómo funcionas|como funcionas|cómo empiezo|como empiezo': {
        answer: `📚 **Para empezar:**\n1. Carga un documento (TXT, PDF, DOCX, PPTX)\n2. Escribe un comando o pregunta\n3. ¡Yo me encargo del resto!\n\n💡 Prueba: "análisis completo" para análisis integral.`,
        emoji: '🎯'
      },
      'cuál es tu límite|cual es tu limite|máximo|maximo': {
        answer: `📋 **Límites:**\n• Máx. 5 documentos por sesión\n• Máx. 4000 caracteres por análisis\n• Máx. 2000 palabras de respuesta\n\n¡Perfectamente dimensionado para tu productividad!`,
        emoji: '📊'
      },
      'necesito ayuda|help me|ayúdame|ayudame': {
        answer: `✨ **¿En qué puedo ayudarte?**\nCuéntame qué necesitas:\n• Analizar un documento\n• Responder preguntas sobre un texto\n• Generar contenido académico\n• O cualquier otra cosa\n\n¡Estoy lista!`,
        emoji: '💪'
      }
    }
    
    for (const [keyword, response] of Object.entries(faqMap)) {
      if (keyword.split('|').some(k => msgLower.includes(k))) {
        addMessage('assistant', `${response.emoji} **${response.answer}**`)
        return true
      }
    }
    
    return false // No fue una pregunta simple
  }

  // �🎓 IRIS'S AUTOMATED HELP SYSTEM
  const handleHelpCommand = async (userMessage) => {
    const msgLower = userMessage.toLowerCase()
    
    if (msgLower.includes('ayuda') || msgLower.includes('help') || msgLower.includes('comandos') || msgLower.includes('guía') || msgLower.includes('qué puedes hacer')) {
      const helpMessage = `🎓✨ **IRIS - TU ASISTENTE ACADÉMICO INTELIGENTE**\nPotenciada por Inteligencia Artificial Avanzada 🤖💫\n\n**✨ COMANDOS PRINCIPALES:**\n\n📚😊 **"análisis completo"** - Análisis comprensivo del documento\n💭🔍 **"analiza el sentimiento"** - Análisis emocional del texto\n📂🤖 **"categoriza esto"** - Clasificación inteligente\n🏷️🎯 **"extrae entidades"** - Identifica personas, lugares, organizaciones\n❓🤔 **"¿[pregunta]?"** - Q&A avanzado sobre documentos\n📝⚡ **"resumen"** - Resumen inteligente estructurado\n🔊🎵 **"lee en voz alta"** - Síntesis de voz natural\n✍️📚 **"genera [contenido]"** - Creación de contenido académico\n\n**🚀 CAPACIDADES AVANZADAS:**\n• Procesamiento multi-documento con contexto 📖✨\n• Análisis de sentimiento con puntuación exacta 💭🎯\n• Extracción de entidades nombradas (personas, lugares, organizaciones) 🏷️🔍\n• Categorización inteligente con nivel de confianza 📂🤖\n• Q&A contextual con citas del texto original ❓📝\n• Síntesis de voz profesional y natural 🗣️🎵\n• Generación de contenido académico profesional ✍️⭐\n• Conversación inteligente con contexto de documentos 💬🧠\n\n**💡 EJEMPLOS DE COMANDOS:**\n• "Análisis completo de este documento" 📊🔍\n• "¿Cuáles son las ideas principales de este texto?" 🤔💭\n• "Genera un ensayo de 300 palabras sobre este tema" ✍️📝\n• "Extrae todas las personas y organizaciones mencionadas" 🏷️👥\n• "Lee el último resumen en voz alta" 🔊📖\n• "¿Qué sentimiento expresa el autor en este párrafo?" 💭😊\n• "Categoriza este texto según su temática" 📂🎯\n\n🎯✨ **¡Estoy aquí para maximizar tu productividad académica con IA avanzada! ¡Vamos a trabajar juntos!** 🤗💫`
      
      addMessage('assistant', helpMessage)
      // await speak('Soy Iris, tu asistente académico con inteligencia artificial avanzada. Tengo capacidades avanzadas de análisis, generación de contenido, Q&A, síntesis de voz y mucho más. ¿En qué puedo ayudarte?')
      return true // Indica que se manejó el comando de ayuda
    }
    return false // No era un comando de ayuda
  }

  // 🤖 Iris MODO AGENTE: el modelo decide qué herramientas usar (function-calling
  // en el backend) y aquí ejecutamos las acciones con los handlers existentes.
  const tryIrisAgent = async (userMessage) => {
    try {
      const recent = (typeof messages !== 'undefined' && Array.isArray(messages)) ? messages : []
      const history = recent
        .slice(-6)
        .filter(m => m && (m.type === 'user' || m.type === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.content }))

      const fd = new FormData()
      fd.append('message', userMessage)
      fd.append('history', JSON.stringify(history))

      const res = await fetch(`${API_URL}/ai/agent`, { method: 'POST', body: fd })
      if (!res.ok) return false
      const data = await res.json()
      if (!data || data.error) return false

      const actions = Array.isArray(data.actions) ? data.actions : []
      if (!actions.length && !data.reply) return false

      let didAction = false
      for (const a of actions) {
        const args = (a && a.args) || {}
        if (a.type === 'create_task' && onAddTask && args.title) {
          try { await onAddTask({ title: args.title, course: args.course || '', dueDate: args.due_date || '', notes: args.notes || '' }); didAction = true } catch (e) { /* noop */ }
        } else if (a.type === 'create_reminder' && onAddReminder && args.title && args.remind_at) {
          let iso = ''
          try { iso = new Date(args.remind_at).toISOString() } catch (e) { iso = '' }
          if (iso) { try { await onAddReminder({ title: args.title, remindAt: iso, type: args.type || 'task', description: args.description || '' }); didAction = true } catch (e) { /* noop */ } }
        }
      }

      const reply = (typeof data.reply === 'string' && data.reply.trim())
        ? data.reply.trim()
        : (didAction ? 'Listo, lo dejé organizado para ti. ✅' : '')
      if (!reply && !didAction) return false
      if (reply) addMessage('assistant', reply)
      return true
    } catch (e) {
      console.warn('Iris agent no disponible, uso flujo local:', e?.message)
      return false
    }
  }

  const handleSend = async (textOverride = null) => {
    // Asegurar que inputValue es string
    const currentInput = typeof inputValue === 'string' ? inputValue : String(inputValue || '')
    const messageText = typeof textOverride === 'string' ? textOverride : (textOverride || currentInput.trim())
    
    // Validar que messageText es string y no está vacío
    const safeMessageText = typeof messageText === 'string' ? messageText.trim() : String(messageText || '').trim()
    
    if (!safeMessageText) return

    // Show welcome screen only on first message
    if (!welcomeShown) {
      setWelcomeShown(true)
    }

    // Asegurar que userMessage es string
    const userMessage = String(safeMessageText)
    
    // Detectar origen del mensaje (narración vs comando)
    const messageOrigin = voiceSource // 'narration', 'command', o null (texto escrito)
    
    // Agregar prefijo según origen para que Iris lo detecte
    let messageWithContext = userMessage
    if (messageOrigin === 'narration') {
      messageWithContext = `[🎤 NARRACIÓN DICTADA]: ${userMessage}`
      console.log('📝 Mensaje detectado como NARRACIÓN (micrófono 🎤)')
    } else if (messageOrigin === 'command') {
      messageWithContext = `[🎙️ SOLICITUD POR VOZ]: ${userMessage}`
      console.log('🎯 Mensaje detectado como COMANDO/SOLICITUD (micrófono 🎙️)')
    } else {
      console.log('⌨️ Mensaje detectado como TEXTO ESCRITO')
    }
    
    // Resetear voiceSource después de detectar
    setVoiceSource(null)
    setInputValue('')
    
    // Build message with file attachments if any
    let messageToAdd = userMessage // Mensaje visual para el usuario (sin prefijos)
    if (uploadedFiles.length > 0) {
      const filesList = uploadedFiles.map(f => `**${f.name}**`).join(', ')
      messageToAdd = `${userMessage}\n\n📎 **Archivos adjuntos:** ${filesList}`
    }
    
    // Si es NARRACIÓN, solo agregar el mensaje sin procesar con Iris
    if (messageOrigin === 'narration') {
      addMessage('user', messageToAdd, null, { 
        isNarration: true, 
        editable: true,
        voiceSource: 'narration'
      })
      setIsProcessing(false)
      console.log('📝 Narración guardada sin respuesta de Iris')
      return // Salir sin procesar
    }
    
    // Para comandos y texto normal, agregar mensaje normal
    addMessage('user', messageToAdd)
    
    // 🆕 INTERCEPTAR flujo de creación guiada (antes de procesamiento normal)
    if (creationMode) {
      const handled = await handleCreationFlow(userMessage)
      if (handled) {
        setIsProcessing(false)
        return
      }
    }

    // 🤖 MODO AGENTE: para chat general (sin archivos ni documento), Iris decide
    // y ejecuta acciones. Si lo maneja, terminamos; si no, sigue el flujo legacy.
    if (uploadedFiles.length === 0 && !lastDocument) {
      setIsProcessing(true)
      const agentHandled = await tryIrisAgent(userMessage)
      if (agentHandled) {
        setIsProcessing(false)
        return
      }
    }

    setIsProcessing(true)
    
    try {
      // Usar messageWithContext para procesamiento de IA (incluye origen)
      const msgLower = messageWithContext.toLowerCase()
      
      // Función para detectar qué documento usar basado en el nombre mencionado
      const findDocumentByName = () => {
        // Buscar si el usuario menciona un documento específico por nombre
        for (const file of uploadedFiles) {
          // Validar que el archivo tiene nombre válido
          if (!file || !file.name || typeof file.name !== 'string') {
            continue
          }
          
          const fileName = file.name.toLowerCase()
          const fileNameParts = file.name.split('.')
          const baseFileName = fileNameParts.length > 0 ? fileNameParts[0].toLowerCase() : ''
          
          // Buscar nombre completo o parcial
          if (msgLower.includes(fileName) || (baseFileName && msgLower.includes(baseFileName))) {
            return file
          }
        }
        // Si no menciona ninguno específico, usar el más reciente
        return uploadedFiles.length > 0 ? uploadedFiles[uploadedFiles.length - 1] : null
      }
      
      const selectedDocument = findDocumentByName()
      
      // Confirmación de origen de voz solo para comandos
      if (messageOrigin === 'command') {
        addMessage('assistant', '🎙️ **Solicitud por voz recibida.** Procesando tu comando...')
      }
      
      // NEW: Actualizar contexto cuando hay documento seleccionado
      if (selectedDocument) {
        setLastDocument(selectedDocument)
        // Extraer tema del primer mensaje del usuario o del nombre del documento
        const docTopic = selectedDocument.name.replace(/\.[^/.]+$/, "").substring(0, 100)
        setCurrentTopic(userMessage.substring(0, 30) || docTopic)
      } else if (!selectedDocument && userMessage.length > 10) {
        // Si no hay documento pero hay una pregunta sustancial, puede ser el tema actual
        setCurrentTopic(userMessage.substring(0, 50))
      }
      
      // 🎓 CHECK FOR HELP COMMANDS FIRST
      const helpHandled = await handleHelpCommand(userMessage)
      if (helpHandled) return // Exit early if help was provided

      // � DETECCIÓN DE INTENCIÓN: Crear tarea o recordatorio
      const taskCreationPattern = /cre[aá].*tarea|nueva tarea|agregar tarea|añadir tarea|agrega.*tarea|quiero.*tarea|necesito.*tarea|hazme.*tarea/i
      const reminderCreationPattern = /cre[aá].*recordatorio|nuevo recordatorio|agregar recordatorio|añadir recordatorio|agrega.*recordatorio|quiero.*recordatorio|necesito.*recordatorio|hazme.*recordatorio|ponme.*recordatorio/i

      if (taskCreationPattern.test(userMessage)) {
        if (!onAddTask) {
          addMessage('assistant', '⚠️ **No es posible crear tareas desde aquí en este momento.** Intenta desde la pestaña "Tareas". 📋')
        } else {
          startTaskCreation()
        }
        return
      }

      if (reminderCreationPattern.test(userMessage)) {
        if (!onAddReminder) {
          addMessage('assistant', '⚠️ **No es posible crear recordatorios desde aquí en este momento.** Intenta desde la pestaña "Recordatorios". 🔔')
        } else {
          startReminderCreation()
        }
        return
      }

      // ── IMAGEN ADJUNTA: analizar con el prompt del usuario ──
      if (selectedDocument?.isImage && selectedDocument?.rawFile) {
        addMessage('assistant', `🔍 Analizando imagen **"${selectedDocument.name}"** con tu instrucción...`)
        try {
          const imgFormData = new FormData()
          imgFormData.append('file', selectedDocument.rawFile)
          imgFormData.append('prompt', userMessage)
          const imgResponse = await fetch(`${API_URL}/ai/analyze-image`, {
            method: 'POST',
            body: imgFormData
          })
          const imgResult = await imgResponse.json()
          if (imgResult.error) {
            addMessage('assistant', `❌ **Error analizando imagen:** ${imgResult.error}`)
          } else {
            // Actualizar el documento guardando el texto analizado y liberando el rawFile
            setUploadedFiles(prev => prev.map(f =>
              f.id === selectedDocument.id
                ? { ...f, text: imgResult.content || '', rawFile: null }
                : f
            ))
            addMessage('assistant', imgResult.content || 'No se pudo obtener el análisis.')
          }
        } catch (imgErr) {
          addMessage('assistant', `❌ **Error:** ${imgErr.message}`)
        }
        setIsProcessing(false)
        return
      }

      // 🎓 IRIS'S INTELLIGENT MESSAGE PROCESSING
      // Enhanced AI system that leverages advanced artificial intelligence capabilities
      
      // 1. SENTIMENT ANALYSIS
      if (msgLower.includes('sentimiento') || msgLower.includes('emoci') || msgLower.includes('tono') || msgLower.includes('analiza el sentimiento')) {
        console.log('💭 Sentiment Analysis Mode')
        
        const textToAnalyze = selectedDocument ? selectedDocument.text.substring(0, 2000) : userMessage
        const result = await analyzeSentiment(textToAnalyze)
        
        if (result.error) {
          addMessage('assistant', `❌ ${result.error}`)
        } else {
          let sentimentEmoji = result.sentiment === 'Positivo' ? '😊' : result.sentiment === 'Negativo' ? '😔' : '😐'
          const responseText = `💭✨ **¡Análisis de Sentimiento Completado!**\n\n${sentimentEmoji} **Sentimiento:** ${result.sentiment}\n📊 **Puntuación:** ${(result.score * 100).toFixed(1)}%\n💡 **Explicación:** ${result.explanation}\n\n🎯 ¡Espero que este análisis emocional te ayude! 😊`
          addMessage('assistant', responseText)
          // await speak(`El sentimiento del texto es ${result.sentiment} con una puntuación de ${(result.score * 100).toFixed(0)} porciento. ${result.explanation}`)
        }
      }
      // 2. CATEGORIZATION
      else if (msgLower.includes('categoriza') || msgLower.includes('clasifica') || msgLower.includes('categoría') || msgLower.includes('tipo de')) {
        console.log('📂 Categorization Mode')
        
        const textToCategorize = selectedDocument ? selectedDocument.text.substring(0, 2000) : userMessage
        const result = await categorizeText(textToCategorize)
        
        if (result.error) {
          addMessage('assistant', `❌ ${result.error}`)
        } else {
          const responseText = `📂🎯 **¡Categorización Inteligente Completada!**\n\n🏷️ **Categoría principal:** ${result.category}\n📊 **Confianza:** ${(result.confidence * 100).toFixed(1)}%\n🔄 **Alternativas:** ${result.alternatives.join(', ')}\n\n✨ ¡Perfecto! Tu contenido está bien organizado ahora. 🤖`
          addMessage('assistant', responseText)
          // await speak(`He categorizado el texto como ${result.category} con ${(result.confidence * 100).toFixed(0)} porciento de confianza.`)
        }
      }
      // 3. ENTITY EXTRACTION 
      else if (msgLower.includes('entidades') || msgLower.includes('extrae') || msgLower.includes('personas') || msgLower.includes('lugares') || msgLower.includes('organizaciones')) {
        console.log('🏷️ Entity Extraction Mode')
        
        const textToExtract = selectedDocument ? selectedDocument.text.substring(0, 3000) : userMessage
        const result = await extractEntities(textToExtract)
        
        if (result.error) {
          addMessage('assistant', `❌ ${result.error}`)
        } else {
          let responseText = '🏷️🕵️‍♀️ **¡Extracción de Entidades Completada!**\n\n'
          if (result.personas && result.personas.length > 0) {
            responseText += `👥😊 **Personas:** ${result.personas.join(', ')}\n\n`
          }
          if (result.lugares && result.lugares.length > 0) {
            responseText += `🌍✨ **Lugares:** ${result.lugares.join(', ')}\n\n`
          }
          if (result.organizaciones && result.organizaciones.length > 0) {
            responseText += `🏢🎯 **Organizaciones:** ${result.organizaciones.join(', ')}\n\n`
          }
          if (!result.personas.length && !result.lugares.length && !result.organizaciones.length) {
            responseText += '🤔 No se encontraron entidades claras en el texto. ¡Pero no te preocupes, intentemos con otro contenido! 😊'
          } else {
            responseText += '🎉 ¡Misión cumplida! Todas las entidades importantes han sido identificadas. ✨'
          }
          
          addMessage('assistant', responseText)
          // await speak(`He extraído ${result.personas.length} personas, ${result.lugares.length} lugares y ${result.organizaciones.length} organizaciones del texto.`)
        }
      }
      // 4. ADVANCED Q&A
      else if ((msgLower.includes('pregunta') || msgLower.includes('¿') || msgLower.includes('?') || msgLower.includes('explica') || msgLower.includes('cuál') || msgLower.includes('qué')) && selectedDocument) {
        console.log('❓ Advanced Q&A Mode')
        
        const result = await answerQuestion(selectedDocument.text, userMessage)
        
        if (result.error) {
          addMessage('assistant', `❌ ${result.error}`)
        } else {
          let responseText = `❓🤔 **¡Respuesta Basada en el Documento!**\n\n${result.answer}`
          if (result.confidence) {
            responseText += `\n\n📊✨ **Confianza:** ${(result.confidence * 100).toFixed(1)}%`
          }
          if (result.source_quotes && result.source_quotes.length > 0 && result.source_quotes[0] !== '[]') {
            responseText += `\n\n📌📖 **Citas del documento:**\n${result.source_quotes.map(q => `• "${q}"`).join('\n')}`
          }
          responseText += '\n\n🎯 ¡Espero que esta respuesta resuelva tu duda! 😊'
          addMessage('assistant', responseText)
          // await speak(result.answer)
        }
      }
      // 5. CONTENT GENERATION (exclude image requests)
      else if ((msgLower.includes('genera') || msgLower.includes('escribe') || msgLower.includes('crea') || msgLower.includes('redacta')) 
        && !(msgLower.includes('resumen') || msgLower.includes('resume') || msgLower.includes('sumario'))
        && !(msgLower.includes('imagen') || msgLower.includes('image') || msgLower.includes('foto') || msgLower.includes('dibujo') || msgLower.includes('dibuja') || msgLower.includes('ilustra') || msgLower.includes('picture'))) {
        console.log('✍️ Advanced Content Generation')
        
        let prompt = userMessage
        if (selectedDocument) {
          prompt = `Usando como referencia este documento: "${selectedDocument.text.substring(0, 1000)}"\n\nTarea: ${userMessage}`
        }
        
        const result = await generateContent(prompt, true)
        
        console.log('🔍 DEBUG CONTENT GEN - Resultado completo del backend:', result)
        console.log('🔍 DEBUG CONTENT GEN - result.content:', result.content)
        
        if (result.error) {
          addMessage('assistant', `❌ ${result.error}`)
        } else {
          // Validar que el resultado contiene contenido real
          const contentStr = String(result.content || '').trim()
          const hasContent = contentStr.length > 10
          
          console.log('🔍 DEBUG CONTENT GEN - contentStr:', contentStr)
          console.log('🔍 DEBUG CONTENT GEN - hasContent:', hasContent)
          
          if (hasContent) {
            const responseText = `✍️📝 **¡Contenido Generado con Éxito!**\n\n📅 Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n\n${contentStr}\n\n🎉 ¡Listo! Tu contenido ha sido creado con inteligencia artificial avanzada. ¡Espero que te guste! ✨`
            addMessage('assistant', responseText)
            // await speak(result.content)
          } else {
            // Si no hay contenido real, mostrar mensaje de fallback
            addMessage('assistant', `✍️😅 **Lo siento, no pude generar el contenido solicitado.**\n\nPor favor, intenta:\n• Ser más específico con tu solicitud\n• Adjuntar un documento de referencia\n• Reformular tu pregunta\n\n💡 **Ejemplo:** "Genera un ensayo sobre energías renovables"\n\n¡Estoy aquí para ayudarte! 🤖✨`)
          }
        }
      }
      // 6. COMPREHENSIVE INTELLIGENT ANALYSIS 
      else if ((msgLower.includes('análisis completo') || msgLower.includes('analiza completamente') || msgLower.includes('análisis inteligente') || msgLower.includes('análisis profundo') || msgLower.includes('análisis avanzado')) && selectedDocument) {
        console.log('🎓 Comprehensive Document Analysis Mode')
        
        addMessage('assistant', `🎓 **Iniciando análisis inteligente completo de "${selectedDocument.name}"**\n\n⏳ Procesando documento con todas mis capacidades avanzadas de inteligencia artificial...`)

        try {
          // 1. RESUMEN INTELIGENTE
          const summaryResult = await generateContent(
            `Como Iris, asistente académico, genera un resumen profesional y estructurado. Incluye:\n1. **Tema principal**\n2. **Puntos clave** (3-5 puntos)\n3. **Conclusiones importantes**\n4. **Información relevante adicional**\n\nDocumento a analizar:\n${selectedDocument.text.substring(0, 4000)}`, 
            false
          )

          // 2. ANÁLISIS DE SENTIMIENTO
          const sentimentResult = await analyzeSentiment(selectedDocument.text.substring(0, 2000))

          // 3. CATEGORIZACIÓN
          const categorizerResult = await categorizeText(selectedDocument.text.substring(0, 2000))

          // 4. EXTRACCIÓN DE ENTIDADES
          const entitiesResult = await extractEntities(selectedDocument.text.substring(0, 3000))

          // 5. COMPILAR REPORTE COMPLETO
          let fullReport = `## Análisis de "${selectedDocument.name}"\n\n`

          // Resumen
          if (!summaryResult.error && summaryResult.content) {
            fullReport += `### Resumen\n${summaryResult.content}\n\n`
          }

          // Sentimiento
          if (!sentimentResult.error) {
            fullReport += `### Tono del documento\n${sentimentResult.sentiment} (${(sentimentResult.score * 100).toFixed(1)}%) — ${sentimentResult.explanation}\n\n`
          }

          // Categorización
          if (!categorizerResult.error) {
            fullReport += `### Categoría\n${categorizerResult.category} (confianza: ${(categorizerResult.confidence * 100).toFixed(1)}%)\n\n`
          }

          // Entidades
          if (!entitiesResult.error) {
            fullReport += `### Entidades identificadas\n`
            if (entitiesResult.personas && entitiesResult.personas.length > 0) {
              fullReport += `**Personas:** ${entitiesResult.personas.join(', ')}\n`
            }
            if (entitiesResult.lugares && entitiesResult.lugares.length > 0) {
              fullReport += `**Lugares:** ${entitiesResult.lugares.join(', ')}\n`
            }
            if (entitiesResult.organizaciones && entitiesResult.organizaciones.length > 0) {
              fullReport += `**Organizaciones:** ${entitiesResult.organizaciones.join(', ')}\n`
            }
            fullReport += '\n'
          }

          fullReport += `---\n_¿Quieres que profundice en algún punto específico del documento?_`

          addMessage('assistant', fullReport)

          // TTS del resumen
          if (!summaryResult.error && summaryResult.content) {
            const cleanSummary = summaryResult.content.replace(/[*#]/g, '').replace(/\n+/g, '. ')
            // await speak(`Análisis completo de ${selectedDocument.name}. ${cleanSummary}`, true)
          }

        } catch (error) {
          console.error('Error in comprehensive analysis:', error)
          addMessage('assistant', `🤐😅 **Error en el análisis completo:** ${error.message}\n\n¡Pero no te preocupes! Puedes seguir haciendo preguntas específicas sobre el documento. ¡Estoy aquí para ayudarte! 💪✨`)
        }
      }
      // 7. INTELLIGENT SUMMARIZATION
      else if ((msgLower.includes('resumen') || msgLower.includes('sumario') || msgLower.includes('resume'))) {
        // Si NO hay documento, verificar si hay contexto de conversación activa
        if (!selectedDocument || uploadedFiles.length === 0) {
          // Buscar mensajes recientes de Iris con contenido sustancial (contexto de conversación)
          const recentAssistantMessages = messages
            .filter(m => m.type === 'assistant' && m.content && m.content.length > 50)
            .slice(-5)
          const recentUserMessages = messages
            .filter(m => m.type === 'user')
            .slice(-5)
          
          // Si hay conversación previa con contenido, generar resumen de la conversación
          if (recentAssistantMessages.length > 0 && recentUserMessages.length > 0) {
            console.log('📚 Resumen de conversación (sin documento)')
            const conversationContext = [...recentUserMessages, ...recentAssistantMessages]
              .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
              .map(m => `${m.type === 'user' ? 'Usuario' : 'Iris'}: ${m.content}`)
              .join('\n')
              .substring(0, 4000)
            
            try {
              const summFormData = new FormData()
              summFormData.append('text', conversationContext)
              summFormData.append('sentences', '8')
              const summResponse = await fetch(`${API_URL}/summary/ai`, { method: 'POST', body: summFormData })
              const summResult = await summResponse.json()
              if (summResult.summary) {
                addMessage('assistant', summResult.summary)
              } else {
                addMessage('assistant', 'No pude generar el resumen. Intenta de nuevo o sé más específico sobre qué quieres que resuma.')
              }
            } catch (summErr) {
              addMessage('assistant', 'No pude generar el resumen. Intenta de nuevo o sé más específico sobre qué quieres que resuma.')
            }
            return
          }
          
          // Sin conversación ni documento → pedir documento
          addMessage('assistant', `📚📎 **Para generar un resumen necesito más contexto.**\n\n**Opciones:**\n1. 📎 Adjunta un documento (PDF, DOCX, TXT o PPTX)\n2. 💬 Pregúntame sobre un tema primero y luego pide el resumen\n\n💡 **Ejemplo:** "¿Qué es la metodología mixta?" → luego "dame un resumen detallado"\n\n¡Estoy lista para ayudarte! 😊✨`)
          return
        }
        
        console.log('📚 Intelligent Summarization')
        
        try {
          const summFormData = new FormData()
          summFormData.append('text', selectedDocument.text.substring(0, 4000))
          summFormData.append('sentences', '8')
          const summResponse = await fetch(`${API_URL}/summary/ai`, { method: 'POST', body: summFormData })
          const summResult = await summResponse.json()
          if (summResult.error) {
            addMessage('assistant', `**Error generando resumen:** ${summResult.error}\n\nVerifica que el backend esté activo y que el documento tenga contenido válido.`)
          } else if (summResult.summary) {
            addMessage('assistant', summResult.summary)
          } else {
            addMessage('assistant', 'No pude generar el resumen del documento. Verifica que el documento tenga contenido suficiente o intenta con una pregunta específica.')
          }
        } catch (summErr) {
          addMessage('assistant', `**Error generando resumen:** ${summErr.message}`)
        }
      }
      // 8. TEXT-TO-SPEECH 
      else if (msgLower.includes('lee') || msgLower.includes('escucha') || msgLower.includes('habla') || msgLower.includes('lee en voz')) {
        console.log('🔊 Advanced Text-to-Speech')
        
        // Detectar "lee el resumen" sin especificar cuál
        if (msgLower.includes('resumen') || msgLower.includes('sumario')) {
          const lastSummary = [...messages].reverse().find(m => 
            m.type === 'assistant' && (
              m.content.includes('Resumen Inteligente') || 
              m.content.includes('📚✨') ||
              m.content.includes('RESUMEN')
            )
          )
          
          if (lastSummary) {
            const cleanText = lastSummary.content.replace(/[*#📎📌❌✅🔊]/g, '').replace(/\n+/g, '. ').trim()
            addMessage('assistant', '🔊📚 **¡Leyendo el resumen!** Escucha atentamente... ✨')
            speak(cleanText, true)
            return
          } else {
            addMessage('assistant', '🔊😅 **No encontré ningún resumen anterior.** ¡Primero genera un resumen con "dame un resumen"! 📖')
            return
          }
        }
        
        if (msgLower.includes('anterior') || msgLower.includes('último') || msgLower.includes('ultima')) {
          const lastMsg = [...messages].reverse().find(m => m.type === 'assistant' && !m.content.startsWith('🔊'))
          if (lastMsg) {
            const cleanText = lastMsg.content.replace(/[*#📎📌❌✅🔊]/g, '').replace(/\n+/g, '. ').trim()
            addMessage('assistant', '🔊🎵 **¡Reproduciendo respuesta anterior!** ✨')
            // await speak(cleanText, true)
          }
        } else if (selectedDocument) {
          addMessage('assistant', `🔊📖 **¡Leyendo "${selectedDocument.name}"!** ¡Disfruta escuchándolo! 🎵✨`)
          // await speak(selectedDocument.text.substring(0, 3000), true)
        } else {
          addMessage('assistant', '🔊😅 **¡Necesitas cargar un documento o especificar qué texto leer!** ¡Estoy lista para leerte lo que quieras! 📖✨')
        }
      }
      // 9. IMAGE GENERATION
      else if (msgLower.includes('genera una imagen') || msgLower.includes('genera imagen') || 
               msgLower.includes('crea una imagen') || msgLower.includes('crea imagen') ||
               msgLower.includes('imagen de') || msgLower.includes('foto de') ||
               msgLower.includes('dibujo de') || msgLower.includes('dibuja') ||
               msgLower.includes('ilustra') || msgLower.includes('generate image') ||
               msgLower.includes('generar imagen') || msgLower.includes('crear imagen') ||
               msgLower.includes('hazme una imagen') || msgLower.includes('picture of') ||
               (msgLower.includes('crea') && msgLower.includes('imagen')) ||
               (msgLower.includes('genera') && msgLower.includes('imagen')) ||
               (msgLower.includes('haz') && (msgLower.includes('imagen') || msgLower.includes('foto') || msgLower.includes('dibujo')))) {
        console.log('🎨 Iris Image Generation')
        addMessage('assistant', '🎨⏳ **Generando tu imagen...** Esto puede tomar unos segundos. ¡Paciencia! ✨')
        
        try {
          const formData = new FormData()
          formData.append('prompt', userMessage)
          const response = await fetch(`${API_URL}/ai/generate-image`, {
            method: 'POST',
            body: formData
          })
          const result = await response.json()
          
          if (result.error) {
            addMessage('assistant', `🎨❌ **No pude generar la imagen:** ${result.error}`)
          } else if (result.image_base64) {
            setMessages(prev => [...prev, {
              id: Date.now(),
              type: 'assistant',
              content: `🎨✅ **¡Imagen generada!** Aquí tienes tu creación:`,
              imageBase64: result.image_base64,
              imageMimeType: result.mime_type || 'image/png',
              timestamp: new Date()
            }])
          } else {
            addMessage('assistant', '🎨😅 **No se pudo generar la imagen.** Intenta con una descripción más detallada.')
          }
        } catch (err) {
          console.error('Image generation error:', err)
          addMessage('assistant', '🎨❌ **Error de conexión al generar la imagen.** Verifica tu conexión e intenta de nuevo.')
        }
      }
      // 10. SMART CONVERSATION MODE
      else {
        console.log('💬 Iris Smart Conversation Mode')
        
        // 🎯 CHECK FOR SIMPLE QUESTIONS FIRST (no API needed)
        const handledSimple = handleSimpleQuestion(userMessage)
        if (handledSimple) return // Exit if handled locally
        
        // Detectar despedidas y responder con manita como solicitó el usuario
        if (msgLower.includes('adios') || msgLower.includes('adiós') || msgLower.includes('hasta luego') || 
            msgLower.includes('nos vemos') || msgLower.includes('hasta la vista') || msgLower.includes('chao') || 
            msgLower.includes('hasta pronto') || msgLower.includes('me voy')) {
          const despedidas = [
            '👋 ¡Hasta luego! Fue un placer ayudarte.',
            '👋 ¡Adiós! Aquí estaré cuando me necesites.',
            '👋 ¡Hasta la próxima! Mucho éxito en tus estudios.',
            '👋 ¡Que tengas un excelente día!'
          ]
          const despedidaAleatoria = despedidas[Math.floor(Math.random() * despedidas.length)]
          addMessage('assistant', despedidaAleatoria)
          return
        }
        
        // Detectar saludos y responder con carita feliz
        if (msgLower.includes('hola') || msgLower.includes('buenos días') || msgLower.includes('buenas tardes') || 
            msgLower.includes('buenas noches') || msgLower.includes('hey') || msgLower.includes('hi') ||
            msgLower.startsWith('iris')) {
          const saludos = [
            '😊 ¡Hola! ¿En qué puedo ayudarte hoy?',
            '😊 ¡Hola! Soy Iris. ¿Qué necesitas?',
            '😊 ¡Hola! Estoy aquí para ayudarte. ¿Por dónde empezamos?',
            '😊 ¡Hola! ¿En qué puedo ser útil?'
          ]
          const saludoAleatorio = saludos[Math.floor(Math.random() * saludos.length)]
          addMessage('assistant', saludoAleatorio)
          return
        }
        
        // Construir prompt con contexto de origen
        let contextualPrompt = ''
        
        if (messageOrigin === 'narration') {
          // El usuario está narrando texto/contenido para que lo proceses
          contextualPrompt = `El usuario está DICTANDO/NARRANDO el siguiente texto para que lo proceses, analices o edites:\n\n"${userMessage}"\n\n`
          contextualPrompt += `Como Iris, identifica qué necesita (corrección, formateo, análisis, resumen, etc.) y ayúdale de forma proactiva. ${selectedDocument ? `Documento activo: "${selectedDocument.name}"` : ''}`
        } else if (messageOrigin === 'command') {
          // El usuario está haciendo una solicitud/comando específico
          contextualPrompt = `El usuario hace la siguiente SOLICITUD/COMANDO por voz:\n\n"${userMessage}"\n\n`
          contextualPrompt += `Como Iris, responde a su solicitud de forma directa y profesional. ${selectedDocument ? `Basándote en: "${selectedDocument.name}"` : ''}`
        } else {
          // Mensaje escrito normal — incluir historial de conversación para mantener contexto
          const recentHistory = messages.slice(-6).map(m => 
            `${m.type === 'user' ? 'Usuario' : 'Iris'}: ${m.content.substring(0, 300)}`
          ).join('\n')
          
          if (recentHistory) {
            contextualPrompt = `Mantén el contexto de la conversación y responde con máxima precisión académica.\n\nHistorial reciente:\n${recentHistory}\n\n${selectedDocument ? `Documento activo: "${selectedDocument.name}"` : ''}\nUsuario: ${userMessage}`
          } else {
            contextualPrompt = `Responde con precisión investigativa y datos verificables. ${selectedDocument ? `(Basándote en: "${selectedDocument.name}")` : ''} ${userMessage}`
          }
        }
        
        if (selectedDocument && messageOrigin !== 'narration' && messageOrigin !== 'command') {
          contextualPrompt = `Usa este contexto: ${selectedDocument.text.substring(0, 500)}\n\nPregunta: ${userMessage}`
        }
        
        const result = await generateContent(contextualPrompt, false)
        if (result.error) {
          const errMsg = result.error || ''
          const is503 = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand')
          if (is503) {
            addMessage('assistant', 'El servicio de IA está con alta demanda en este momento. Por favor, espera unos segundos e intenta de nuevo.')
          } else {
            addMessage('assistant', `${errMsg}\n\nIntenta de nuevo o reformula tu consulta.`)
          }
        } else {
          const responseText = result.content || '😊 ¿Podrías ser más específico? Estoy lista para ayudarte. ✨'
          addMessage('assistant', responseText)
          
          // TTS inteligente: Lee automáticamente respuestas largas (>300 chars)
          // Solo si el usuario pidió generar contenido específico
          const isContentGeneration = msgLower.includes('genera') || 
                                      msgLower.includes('escribe') || 
                                      msgLower.includes('redacta') ||
                                      msgLower.includes('crea') ||
                                      msgLower.includes('desarrolla')
          
          if (result.content && result.content.length > 300 && isContentGeneration) {
            const cleanContent = result.content.replace(/[*#📎📌❌✅🔊]/g, '').replace(/\n+/g, '. ').trim()
            // await speak(cleanContent, true) // force=true para leer contenido generado siempre
          } else if (result.content && result.content.length > 100) {
            // Para respuestas largas, leer automáticamente
            const cleanText = result.content.replace(/[*#📎📌❌✅🔊]/g, '').replace(/\n+/g, '. ').trim()
            // await speak(cleanText, true)
          }
        }
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const addMessage = (type, content, fileName = null, metadata = {}) => {
    // Asegurar que content es string
    const safeContent = typeof content === 'string' ? content : String(content || '')
    
    const newMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content: safeContent,
      fileName,
      ...metadata // isNarration, editable, etc.
    }
    setMessages(prev => [...prev, newMessage])
  }

  // Editar un mensaje existente
  const updateMessage = (messageId, newContent) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, content: newContent } : msg
    ))
  }

  const handleQuickAction = (task) => {
    setCurrentTask(task)
    const prompts = {
      sentiment: '¿Cuál es el sentimiento de: ',
      categorize: '¿En qué categoría va: ',
      entities: '¿Qué entidades hay en: ',
      generate: '¿Puedes generar: ',
      qa: 'Pregunta sobre el documento: '
    }
    addMessage('assistant', prompts[task])
  }

  return (
    <section className="ai-assistant" aria-label="Asistente de IA">
      {/* Welcome Screen */}
      {!welcomeShown && (
        <div className="ai-assistant__welcome iris-welcome">
          <div className="iris-welcome__card">
            <header className="iris-welcome__head">
              <div className="iris-welcome__avatar">
                <img src="/iris-avatar.svg" alt="Iris" />
                <span className="iris-welcome__pulse" aria-hidden="true" />
              </div>
              <div className="iris-welcome__id">
                <span className="iris-welcome__status"><i className="iris-welcome__online" />En línea · Agente IA</span>
                <h1 className="iris-welcome__name">Iris</h1>
                <p className="iris-welcome__role">Tu agente de estudio con inteligencia artificial</p>
              </div>
            </header>

            <div className="iris-welcome__group">
              <span className="iris-welcome__group-label"><Sticker name="robot" size={17} /> Inteligencia artificial</span>
              <div className="iris-welcome__grid">
                {IRIS_AI_SERVICES.map((s) => (
                  <button key={s.key} type="button" className="iris-welcome__cap" onClick={() => handleServiceClick(s.key)}>
                    <span className="iris-welcome__cap-ic"><Sticker name={s.sticker} size={26} /></span>
                    <span className="iris-welcome__cap-label">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="iris-welcome__group">
              <span className="iris-welcome__group-label"><Sticker name="bolt" size={17} /> Herramientas</span>
              <div className="iris-welcome__grid">
                {IRIS_TOOLS.map((s) => (
                  <button key={s.key} type="button" className="iris-welcome__cap" onClick={() => handleServiceClick(s.key)}>
                    <span className="iris-welcome__cap-ic"><Sticker name={s.sticker} size={26} /></span>
                    <span className="iris-welcome__cap-label">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="iris-welcome__tip">
              <span className="iris-welcome__tip-ic"><Sticker name="bulb" size={20} /></span>
              <p>Analizo documentos, creo tareas y recordatorios, extraigo ideas clave y respondo preguntas académicas complejas. También puedes hablarme por voz.</p>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="ai-assistant__messages">
        {messages.map(msg => {
          // Parse message content with markdown-like formatting
          const renderMessageContent = (text) => {
            if (!text) return null

            // Split lines preserving structure
            const lines = text.split('\n')
            const elements = []
            let listBuffer = []
            let key = 0

            const flushList = () => {
              if (listBuffer.length > 0) {
                elements.push(
                  <ul key={key++} className="ai-assistant__message-list">
                    {listBuffer.map((item, i) => (
                      <li key={i}>{renderInline(item)}</li>
                    ))}
                  </ul>
                )
                listBuffer = []
              }
            }

            // Render inline: **bold** -> <strong>, *italic* -> <em>
            const renderInline = (line) => {
              const parts = []
              // Remove stray single * that isn't part of ** or *text*
              const regex = /(\*\*([^*]+)\*\*)|\*([^*]+)\*|(`[^`]+`)/g
              let last = 0
              let match
              while ((match = regex.exec(line)) !== null) {
                if (match.index > last) parts.push(line.slice(last, match.index))
                if (match[1]) {
                  // **bold**
                  parts.push(<strong key={parts.length}>{match[2]}</strong>)
                } else if (match[3]) {
                  // *italic*
                  parts.push(<em key={parts.length}>{match[3]}</em>)
                } else if (match[4]) {
                  // `code`
                  parts.push(<code key={parts.length} style={{background:'rgba(0,0,0,0.08)',padding:'1px 4px',borderRadius:'3px',fontFamily:'monospace'}}>{match[4].slice(1,-1)}</code>)
                }
                last = match.index + match[0].length
              }
              if (last < line.length) parts.push(line.slice(last))
              return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
            }

            for (let i = 0; i < lines.length; i++) {
              const raw = lines[i]
              const trimmed = raw.trim()

              // Headings: # ## ### → h3 / h4
              const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
              if (headingMatch) {
                flushList()
                const level = headingMatch[1].length
                const headingText = headingMatch[2]
                const Tag = level <= 2 ? 'h3' : 'h4'
                elements.push(<Tag key={key++} style={{margin:'10px 0 4px',fontWeight:700,lineHeight:1.3}}>{renderInline(headingText)}</Tag>)
                continue
              }

              // Horizontal rule
              if (/^---+$/.test(trimmed)) {
                flushList()
                elements.push(<hr key={key++} style={{border:'none',borderTop:'1px solid rgba(0,0,0,0.12)',margin:'8px 0'}} />)
                continue
              }

              // List items: •, -, * at start
              if (/^[•\-\*]\s/.test(trimmed)) {
                listBuffer.push(trimmed.replace(/^[•\-\*]\s+/, ''))
                continue
              }

              // Numbered list: 1. 2. etc.
              const numMatch = trimmed.match(/^\d+\.\s+(.+)$/)
              if (numMatch) {
                listBuffer.push(numMatch[1])
                continue
              }

              // Empty line
              if (trimmed === '') {
                flushList()
                continue
              }

              // Regular paragraph line
              flushList()
              elements.push(
                <p key={key++} style={{margin:'2px 0',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
                  {renderInline(raw)}
                </p>
              )
            }

            flushList()
            return elements
          }
          
          return (
            <div key={msg.id} className={`ai-assistant__message ai-assistant__message--${msg.type}`}>
              <div className="ai-assistant__message-content">
                {msg.type === 'assistant' && msg.icon && <span className="ai-assistant__message-icon">{msg.icon}</span>}
                <div className="ai-assistant__message-text">
                  {msg.fileName && (
                    <div className="ai-assistant__message-file-chip">
                      <span>📄 {msg.fileName}</span>
                    </div>
                  )}
                  
                  {/* Mostrar textarea editable o contenido normal */}
                  {editingMessageId === msg.id ? (
                    <div style={{ width: '100%' }}>
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="ai-assistant__edit-textarea"
                        style={{
                          width: '100%',
                          minHeight: '80px',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '2px solid #c9d62f',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          color: '#000', // Negro en modo claro
                          backgroundColor: '#fff' // Fondo blanco en modo claro
                        }}
                        autoFocus
                      />
                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            updateMessage(msg.id, editingText)
                            setEditingMessageId(null)
                            setEditingText('')
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#a9b71a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500'
                          }}
                        >
                          ✓ Guardar
                        </button>
                        <button
                          onClick={() => {
                            setEditingMessageId(null)
                            setEditingText('')
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500'
                          }}
                        >
                          ✕ Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    renderMessageContent(msg.content)
                  )}
                  
                  {/* Imagen generada por IA */}
                  {msg.imageBase64 && (
                    <div style={{ marginTop: '10px' }}>
                      <img 
                        src={`data:${msg.imageMimeType || 'image/png'};base64,${msg.imageBase64}`}
                        alt="Imagen generada por Iris"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '400px',
                          borderRadius: '12px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                          objectFit: 'contain'
                        }}
                      />
                      <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                        <a
                          href={`data:${msg.imageMimeType || 'image/png'};base64,${msg.imageBase64}`}
                          download={`iris-imagen-${msg.id || Date.now()}.png`}
                          style={{
                            padding: '4px 10px',
                            background: 'linear-gradient(135deg, #c9d62f 0%, #c8de1f 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            textDecoration: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          💾 Descargar
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Botones para mensajes del USUARIO que son NARRACIÓN */}
                  {msg.type === 'user' && msg.isNarration && editingMessageId !== msg.id && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Botón Leer / Detener */}
                      <button
                        className="ai-assistant__read-btn"
                        onClick={() => {
                          if (speaking) {
                            stopSpeaking()
                          } else {
                            const cleanText = msg.content.replace(/[*#📎📌❌✅🔊]/g, '').replace(/\n+/g, '. ').trim()
                            speak(cleanText, true)
                          }
                        }}
                        title={speaking ? 'Detener lectura' : 'Leer esta narración en voz alta'}
                        style={{
                          padding: '6px 12px',
                          background: speaking
                            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                            : 'linear-gradient(135deg, #c9d62f 0%, #c8de1f 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease',
                          boxShadow: speaking
                            ? '0 2px 8px rgba(239, 68, 68, 0.3)'
                            : '0 2px 8px rgba(201, 214, 47, 0.3)',
                          width: 'fit-content',
                          maxWidth: '160px',
                          alignSelf: 'flex-start'
                        }}
                      >
                        {speaking ? '⏹️ Detener' : '🔊 Leer'}
                      </button>
                      
                      {/* Botón Editar */}
                      {msg.editable && (
                        <button
                          onClick={() => {
                            setEditingMessageId(msg.id)
                            setEditingText(msg.content)
                          }}
                          title="Editar esta narración"
                          style={{
                            padding: '6px 12px',
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                          }}
                        >
                          ✏️ Editar
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Botón de "Leer" / "Detener" para mensajes del asistente */}
                  {msg.type === 'assistant' && !msg.content.startsWith('🔊') && msg.content.length > 20 && editingMessageId !== msg.id && (
                    <button
                      className="ai-assistant__read-btn"
                      onClick={() => {
                        if (speaking) {
                          stopSpeaking()
                        } else {
                          const cleanText = msg.content.replace(/[*#📎📌❌✅🔊]/g, '').replace(/\n+/g, '. ').trim()
                          speak(cleanText, true)
                        }
                      }}
                      title={speaking ? 'Detener lectura' : 'Leer este mensaje en voz alta'}
                      style={{
                        marginTop: '8px',
                        padding: '6px 12px',
                        background: speaking
                          ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                          : 'linear-gradient(135deg, #c9d62f 0%, #c8de1f 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        boxShadow: speaking
                          ? '0 2px 8px rgba(239, 68, 68, 0.3)'
                          : '0 2px 8px rgba(201, 214, 47, 0.3)',
                        width: 'fit-content',
                        maxWidth: '160px',
                        alignSelf: 'flex-start'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)'
                      }}
                    >
                      {speaking ? '⏹️ Detener' : '🔊 Leer'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Iris typing indicator */}
        {isProcessing && (
          <div className="ai-assistant__message ai-assistant__message--assistant">
            <div className="ai-assistant__message-content iris-typing-indicator">
              <span className="iris-typing-dot"></span>
              <span className="iris-typing-dot"></span>
              <span className="iris-typing-dot"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Floating & Oval Design */}
      <div className="ai-assistant__input-area">
        {/* File Input (hidden) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.pptx,.txt,.md,.jpg,.jpeg,.png,.gif,.webp"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Canvas de animación de ondas de audio - SOLO CUANDO ESTÁ HABLANDO/COMANDANDO */}
        {(isNarrating || isCommanding) && (
          <canvas 
            ref={canvasRef}
            className="ai-assistant__audio-canvas"
            width="680" 
            height="56"
            style={{
              width: '100%',
              height: '56px',
              borderRadius: '8px',
              background: 'transparent'
            }}
          />
        )}

        {/* Textarea - INTEGRADA EN LA SESIÓN */}
        {!isNarrating && !isCommanding ? (
          <textarea
            ref={(el) => {
              if (el) {
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 500) + 'px'
              }
            }}
            className="ai-assistant__textarea"
            placeholder="Pregunta lo que quieras..."
            value={typeof inputValue === 'string' ? inputValue : String(inputValue || '')}
            onChange={(e) => {
              setInputValue(String(e.target.value || ''))
              // Auto-grow textarea
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 500) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            disabled={isProcessing}
          />
        ) : null}

        {/* Input Controls */}
        <div className="ai-assistant__input-controls">
          {/* Upload Button */}
          <button
            className="ai-assistant__btn ai-assistant__btn--upload"
            onClick={() => fileInputRef.current?.click()}
            title="Cargar archivo o foto (Ctrl+U)"
            disabled={isNarrating || isCommanding}
            aria-label="Cargar archivo"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" /></svg>
          </button>

          {/* Voice Narration Button - Solo para narración */}
          <button
            className={`ai-assistant__btn ai-assistant__btn--voice ${isNarrating ? 'is-listening' : ''}`}
            onClick={() => {
              console.log('🎤 Click en botón narración')
              if (!recognitionNarrationRef.current) {
                console.error('❌ recognitionNarrationRef.current no existe')
                alert('Lo siento, tu navegador no soporta reconocimiento de voz. Usa Chrome, Edge o Safari.')
                return
              }
              if (isNarrating) {
                console.log('🛑 Deteniendo narración...')
                recognitionNarrationRef.current?.stop()
              } else {
                console.log('▶️ Iniciando narración...')
                try {
                  recognitionNarrationRef.current?.start()
                } catch (err) {
                  console.error('Error al iniciar narración:', err)
                  alert('Error al iniciar el micrófono: ' + err.message)
                }
              }
            }}
            title="🎤 Narrar texto (modo continuo - presiona de nuevo para detener)"
            aria-label="Botón de narración"
          >
            {isNarrating ? (
              // Icono de STOP cuando está grabando
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"></rect>
              </svg>
            ) : (
              // Icono de MICRÓFONO cuando no está grabando
              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            )}
          </button>
        </div>

        {/* Uploaded Files Display */}
        {uploadedFiles.length > 0 && (
          <div className="ai-assistant__uploaded-files">
            {uploadedFiles.map((file) => {
              // Validar que el archivo tiene propiedades válidas
              const fileName = file && file.name ? file.name : 'archivo_sin_nombre'
              const fileSize = file && file.size ? file.size : 0
              
              return (
              <div key={file.id} className="ai-assistant__file-chip">
                <span className="ai-assistant__file-chip-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg></span>
                <span className="ai-assistant__file-chip-name" title={fileName}>
                  {truncateFileName(fileName, 20)}
                </span>
                <span className="ai-assistant__file-chip-size">
                  {fileSize} pal.
                </span>
                <button
                  className="ai-assistant__file-chip-remove"
                  onClick={() => removeUploadedFile(file.id)}
                  title="Remover archivo"
                  aria-label="Remover archivo"
                >
                  ✕
                </button>
              </div>
              )
            })}
          </div>
        )}

        {/* Send & Listen Buttons */}
        <div className="ai-assistant__actions">
          {/* Listen Button */}
          {summary && (
            <button
              className={`ai-assistant__btn ai-assistant__btn--listen ${speaking ? 'is-speaking' : ''}`}
              onClick={() => speaking ? stopSpeaking() : speak(summary, true)}
              disabled={isProcessing}
              title={speaking ? 'Detener lectura' : 'Escuchar resultado'}
              aria-label={speaking ? 'Detener lectura' : 'Escuchar respuesta'}
            >
              {speaking ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></svg>
              )}
            </button>
          )}

          {/* Voice Command Button - Solo para comandos */}
          <button
            className={`ai-assistant__btn ai-assistant__btn--command ${isCommanding ? 'is-commanding' : ''}`}
            onClick={() => {
              console.log('🎙️ Click en botón comando')
              if (!recognitionCommandRef.current) {
                console.error('❌ recognitionCommandRef.current no existe')
                alert('Lo siento, tu navegador no soporta reconocimiento de voz. Usa Chrome, Edge o Safari.')
                return
              }
              if (isCommanding) {
                console.log('🛑 Deteniendo comando...')
                recognitionCommandRef.current?.stop()
              } else {
                console.log('▶️ Iniciando comando...')
                try {
                  recognitionCommandRef.current?.start()
                } catch (err) {
                  console.error('Error al iniciar comando:', err)
                  alert('Error al iniciar el micrófono: ' + err.message)
                }
              }
            }}
            disabled={isProcessing}
            title="🎙️ Dictar comando (modo continuo - presiona de nuevo para detener)"
            aria-label="Botón de comando de voz"
          >
            {isCommanding ? (
              // Icono de STOP cuando está grabando
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"></rect>
              </svg>
            ) : (
              // Icono de MICRÓFONO SVG cuando no está grabando
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            )}
          </button>

          {/* Send Button */}
          <button
            className="ai-assistant__btn ai-assistant__btn--send"
            onClick={() => handleSend()}
            disabled={!(typeof inputValue === 'string' ? inputValue : String(inputValue || '')).trim() || isProcessing}
            title="Enviar (Enter)"
            aria-label="Enviar mensaje"
          >
            {isProcessing ? (
              <span className="ai-assistant__spin" aria-hidden="true" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
            )}
          </button>
        </div>
      </div>
    </section>
  )
}

export default AIAssistant
