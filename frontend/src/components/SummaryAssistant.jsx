/**
 * Asistente de resúmenes con soporte para archivos, texto y lectura en voz alta.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'

// Componente que concentra el flujo de carga, resumen y reproducción por voz.
const SummaryAssistant = ({
  onUpload,
  summary,
  keywords,
  originalText,
  isLoading,
  onSpeak,
  onStopSpeaking,
  onClearResults,
}) => {
  const [text, setText] = useState('')
  const [sentences, setSentences] = useState(7)
  const [summaryLength, setSummaryLength] = useState('medium')  // NEW: short, medium, long
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [activeResultTab, setActiveResultTab] = useState('summary')
  const [isListening, setIsListening] = useState(false)
  const [showActionBubble, setShowActionBubble] = useState(false)
  const [showModalActionBubble, setShowModalActionBubble] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [bubblePosition, setBubblePosition] = useState({ x: 24, y: 24 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // En desktop, hideBubble siempre es false. En móvil, se oculta después de 2 segundos
  const isMobileDevice = /Mobile|Android|iPhone/.test(navigator.userAgent)
  const [hideBubble, setHideBubbleState] = useState(false)
  
  // Log inicial para debug
  useEffect(() => {
    console.log('🎯 [SummaryAssistant] Component initialized:', {
      isMobileDevice,
      userAgent: navigator.userAgent,
      version: 'v3.8-DESKTOP-FIX', // Versión actualizada para forzar despliegue
      windowWidth: window.innerWidth
    })
  }, [])
  
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)

  // Simple wrapper que en desktop NUNCA permite ocultar
  const setHideBubble = useCallback((value) => {
    if (!isMobileDevice) {
      // En desktop, siempre mantener false
      setHideBubbleState(false)
    } else {
      // En móvil, permitir el valor normal
      setHideBubbleState(value)
    }
  }, [isMobileDevice])

  // Debug: Log props changes
  useEffect(() => {
    if (summary || originalText) {
      console.log('🔍 [SummaryAssistant] RESULTS AVAILABLE:', {
        summaryLength: summary?.length || 0,
        originalTextLength: originalText?.length || 0,
        showResultModal,
        isMobile: /Mobile|Android|iPhone/.test(navigator.userAgent)
      })
    }
  }, [summary, originalText, showResultModal])
  const baseTextRef = useRef('')
  const finalTranscriptRef = useRef('')
  const bubbleRef = useRef(null)
  const modalBubbleRef = useRef(null)
  const hideTimeoutRef = useRef(null)

  // Auto-ocultar burbuja después de 2 segundos (SOLO en móvil)
  useEffect(() => {
    // En desktop, no hacer nada
    if (!isMobileDevice) {
      return
    }
    
    if (showResultModal && !showModalActionBubble) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
      hideTimeoutRef.current = setTimeout(() => {
        console.log('📱 [SummaryAssistant] Mobile - hiding bubble after 2 seconds')
        setHideBubble(true)
      }, 2000)
    }
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [showResultModal, showModalActionBubble, isMobileDevice])

  // Mostrar burbuja al tocar la pantalla (SOLO en móvil)
  useEffect(() => {
    // En desktop, no agregar listener (burbuja siempre visible)
    if (!isMobileDevice) {
      console.log('🖥️ [SummaryAssistant] Desktop mode - NO event listener added')
      return
    }

    console.log('📱 [SummaryAssistant] Mobile mode - Adding event listener')
    const handleInteraction = (e) => {
      // No dispara si el click es en la burbuja misma o en el menú
      if (e.target.closest('.summary-result-modal__floating-bubble') || 
          e.target.closest('.summary__bubble-menu')) {
        return
      }

      // Si el menú está abierto, solo cerrarlo
      if (showModalActionBubble) {
        console.log('🔚 [SummaryAssistant] Menu open - click closes it')
        setShowModalActionBubble(false)
        return
      }

      // Solo en móvil: mostrar burbuja si está oculta
      if (showResultModal && hideBubble) {
        console.log('✅ [SummaryAssistant] Mobile - Showing bubble after interaction')
        setHideBubble(false)
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current)
        }
        hideTimeoutRef.current = setTimeout(() => {
          console.log('⏰ [SummaryAssistant] Mobile - Auto-hiding bubble after 2 seconds')
          setHideBubble(true)
        }, 2000)
      }
    }

    if (showResultModal) {
      const modalContent = document.querySelector('.summary-result-modal__content')
      if (modalContent) {
        modalContent.addEventListener('click', handleInteraction, true)
      }
    }

    return () => {
      if (showResultModal) {
        const modalContent = document.querySelector('.summary-result-modal__content')
        if (modalContent) {
          modalContent.removeEventListener('click', handleInteraction, true)
        }
      }
    }
  }, [showResultModal, hideBubble, showModalActionBubble, isMobileDevice])

  // Mostrar modal cuando hay resultados
  useEffect(() => {
    if (summary || originalText) {
      console.log('📊 [SummaryAssistant] Showing modal - summary:', !!summary, 'originalText:', !!originalText)
      setShowResultModal(true)
      setHideBubble(false)
      setBubblePosition({ x: 24, y: 24 })
      // Limpiar el estado del archivo después de generar el resumen
      setSelectedFile(null)
      setSelectedFileName('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [summary, originalText])

  // Cerrar burbuja al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target)) {
        setShowActionBubble(false)
      }
    }

    if (showActionBubble) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showActionBubble])

  // Cerrar menú del modal al hacer clic fuera (NO ocultar burbuja en desktop)
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Si hay un menú abierto y el clic NO está en la burbuja
      if (showModalActionBubble && modalBubbleRef.current && !modalBubbleRef.current.contains(e.target)) {
        console.log('🔚 [SummaryAssistant] Closing menu by external click')
        setShowModalActionBubble(false)
        
        // En móvil, establecer timeout. En desktop, no hacer nada
        if (isMobileDevice && hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current)
          hideTimeoutRef.current = setTimeout(() => {
            console.log('⏰ [SummaryAssistant] Mobile - Auto-hiding bubble after 2 seconds')
            setHideBubble(true)
          }, 2000)
        }
      }
    }

    if (showResultModal) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModalActionBubble, showResultModal, isMobileDevice])

  // Inicializa el reconocimiento de voz
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'es-ES'
      recognitionRef.current.maxAlternatives = 1

      let silenceTimeout = null
      const SILENCE_THRESHOLD = 5000 // 5 segundos sin sonido

      recognitionRef.current.onstart = () => {
        console.log('Reconocimiento iniciado')
        // Limpiar timeout al iniciar
        if (silenceTimeout) clearTimeout(silenceTimeout)
      }

      recognitionRef.current.onresult = (event) => {
        // Limpiar timeout anterior al detectar sonido
        if (silenceTimeout) clearTimeout(silenceTimeout)

        let interimTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          
          if (event.results[i].isFinal) {
            // Resultado final: agregar al texto base
            const finalText = transcript.trim()
            if (finalText && !finalTranscriptRef.current.endsWith(finalText)) {
              finalTranscriptRef.current += finalText + ' '
              baseTextRef.current += finalText + ' '
            }
          } else {
            // Resultado intermedio: mostrar en tiempo real
            interimTranscript += transcript
          }
        }

        // Actualizar el estado con el texto combinado
        const fullText = baseTextRef.current + interimTranscript
        setText(fullText)

        // Establecer timeout de silencio
        silenceTimeout = setTimeout(() => {
          if (recognitionRef.current) {
            console.log('Sin sonido detectado durante 5 segundos. Deteniendo...')
            recognitionRef.current.stop()
          }
        }, SILENCE_THRESHOLD)
      }

      recognitionRef.current.onend = () => {
        // Limpiar timeout
        if (silenceTimeout) clearTimeout(silenceTimeout)
        
        // Consolidar todo el texto final
        if (finalTranscriptRef.current.trim()) {
          baseTextRef.current = baseTextRef.current.trim()
          finalTranscriptRef.current = ''
          setText(baseTextRef.current)
        }
        
        // Detener solo si el usuario presionó el botón (no reiniciar automáticamente)
        setIsListening(false)
      }

      recognitionRef.current.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error)
        if (silenceTimeout) clearTimeout(silenceTimeout)
        setIsListening(false)
        if (event.error === 'not-allowed') {
          alert('Permiso de micrófono denegado. Por favor, habilita el acceso al micrófono.')
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  // Cambia automáticamente la pestaña de resultado según lo disponible.
  useEffect(() => {
    if (summary) {
      setActiveResultTab('summary')
    } else if (originalText) {
      setActiveResultTab('original')
    }
  }, [summary, originalText])

  const summarySegments = useMemo(() => {
    if (!summary) return []
    return summary
      .split(/(?<=[.!?])\s+/)
      .map((segment) => segment.trim())
      .filter(Boolean)
  }, [summary])

  // Lectura en voz alta usando SOLO TTS nativo del backend (Google Cloud) - SIN fallback
  const handleSpeak = useCallback(async (textToSpeak) => {
    if (!textToSpeak) return
    
    // Detiene cualquier audio anterior primero
    if (window.currentAudioElement) {
      window.currentAudioElement.pause()
      window.currentAudioElement = null
    }
    
    console.log('🔊 [SummaryAssistant-TTS-NATIVE] Usando TTS nativo del backend (Google Cloud)...')
    
    try {
      const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')
      
      const formData = new FormData()
      formData.append('text', textToSpeak.substring(0, 5000))
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
  }, [])

  // Detiene el audio TTS del backend
  const handleStopSpeaking = useCallback(() => {
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

  // Valida que exista contenido y delega la petición de resumen al padre.
  const handleSubmit = (event) => {
    event.preventDefault()
    if (!text.trim() && !selectedFile) {
      alert('Escribe un texto o selecciona un archivo para generar el resumen.')
      return
    }
    const formData = new FormData()
    formData.append('sentences', sentences)
    formData.append('summary_length', summaryLength)  // NEW: enviar extensión del resumen
    if (text.trim()) {
      formData.append('text', text)
    }
    if (selectedFile) {
      formData.append('file', selectedFile)
    }
    onUpload(formData)
  }

  // Función para generar resumen directamente desde el menú
  const generateSummary = () => {
    handleSubmit({ preventDefault: () => {} })
  }

  // Procesa la selección de archivos compatibles y almacena su nombre.
  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setSelectedFileName(file.name)
    event.target.value = ''
  }

  // Permite activar el selector de archivos usando teclado.
  const handleUploadKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      fileInputRef.current?.click()
    }
  }

  // Controla el inicio y detención del reconocimiento de voz
  const toggleVoiceRecognition = () => {
    if (!recognitionRef.current) {
      alert('Tu navegador no soporta el reconocimiento de voz.')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      // Guardar el texto actual como base antes de empezar a dictar
      baseTextRef.current = text
      finalTranscriptRef.current = ''
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  return (
    <section
      className="panel panel--with-sticker"
      aria-labelledby="summary-heading"
      data-sticker="Resumen exprés"
      data-icon="📝"
    >
      <header className="panel__header">
        <div>
          <h2 id="summary-heading" className="panel__title">
            Gestor de resúmenes
          </h2>
          <p className="panel__subtitle">
            Sube un documento (PDF, Word, PowerPoint, TXT, Markdown, RTF) o pega tu texto. Elige entre 3 niveles de resumen. Funciona sin límite de tamaño.
          </p>
        </div>
      </header>
      <div className="summary">
        {/* Hoja de texto grande y atractiva */}
        <div className="summary__paper">
          {/* Burbuja flotante con acciones */}
          <div className="summary__floating-bubble" ref={bubbleRef}>
            <button
              type="button"
              className="summary__bubble-toggle"
              onClick={() => setShowActionBubble(!showActionBubble)}
              aria-label="Menú de opciones"
              disabled={isListening}
            >
              ✨
            </button>
            {showActionBubble && (
              <div className="summary__bubble-menu">
                <button
                  type="button"
                  className="summary__bubble-item"
                  onClick={() => {
                    fileInputRef.current?.click()
                    setShowActionBubble(false)
                  }}
                  disabled={isListening}
                >
                  <span className="summary__bubble-icon">📎</span>
                  <span className="summary__bubble-text">Cargar archivo</span>
                </button>
                <div className="summary__bubble-divider"></div>
                <button
                  type="button"
                  className="summary__bubble-item"
                  onClick={() => {
                    setSentences(3)
                    setSummaryLength('short')  // NEW: set to short
                    generateSummary()
                    setShowActionBubble(false)
                  }}
                  disabled={isLoading || (!text && !selectedFile)}
                >
                  <span className="summary__bubble-icon">⚡</span>
                  <span className="summary__bubble-text">Resumen breve (3 frases)</span>
                </button>
                <button
                  type="button"
                  className="summary__bubble-item"
                  onClick={() => {
                    setSentences(7)
                    setSummaryLength('medium')  // NEW: set to medium
                    generateSummary()
                    setShowActionBubble(false)
                  }}
                  disabled={isLoading || (!text && !selectedFile)}
                >
                  <span className="summary__bubble-icon">✨</span>
                  <span className="summary__bubble-text">Resumen equilibrado (7 frases)</span>
                </button>
                <button
                  type="button"
                  className="summary__bubble-item"
                  onClick={() => {
                    setSentences(10)
                    setSummaryLength('long')  // NEW: set to long
                    generateSummary()
                    setShowActionBubble(false)
                  }}
                  disabled={isLoading || (!text && !selectedFile)}
                >
                  <span className="summary__bubble-icon">🔬</span>
                  <span className="summary__bubble-text">Resumen detallado (10+ frases)</span>
                </button>
                <div className="summary__bubble-divider"></div>
                <button
                  type="button"
                  className="summary__bubble-item"
                  onClick={() => {
                    if (text.trim()) {
                      handleSpeak(text)
                    }
                    setShowActionBubble(false)
                  }}
                  disabled={!text.trim()}
                >
                  <span className="summary__bubble-icon">🔊</span>
                  <span className="summary__bubble-text">Escuchar texto</span>
                </button>
              </div>
            )}
          </div>

          {/* Botón de micrófono flotante */}
          <button
            type="button"
            className={`summary__mic-button ${isListening ? 'is-listening' : ''}`}
            onClick={toggleVoiceRecognition}
            title={isListening ? 'Detener dictado' : 'Iniciar dictado por voz'}
            aria-label={isListening ? 'Detener dictado' : 'Iniciar dictado por voz'}
          >
            {isListening ? '🔴' : '🎤'}
          </button>

          {/* Textarea principal */}
          <textarea
            id="summary-text"
            name="text"
            className="summary__paper-textarea"
            placeholder={isListening ? "Escuchando... habla ahora" : "Escribe o pega tu texto aquí, usa el micrófono para dictar, o carga un archivo..."}
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={isListening}
          />

          {/* Indicador de escucha activa */}
          {isListening && (
            <div className="summary__listening-indicator">
              <span className="summary__listening-pulse"></span>
              <span className="summary__listening-text">Escuchando...</span>
            </div>
          )}

          {/* Botón de archivo en el centro (solo cuando NO está escuchando ni hay texto) */}
          {!text && !selectedFileName && !isListening && (
            <div className="summary__upload-center">
              <input
                ref={fileInputRef}
                id="summary-file"
                type="file"
                accept=".pdf,.doc,.docx,.pptx,.txt,.md,.rtf"
                onChange={handleFileChange}
                className="summary__file-input"
              />
              <label htmlFor="summary-file" className="summary__upload-label">
                <span className="summary__upload-icon">📎</span>
                <span className="summary__upload-title">Cargar archivo</span>
                <span className="summary__upload-subtitle">PDF, Word, PowerPoint, TXT, Markdown, RTF</span>
              </label>
            </div>
          )}

          {/* Indicador de archivo cargado */}
          {selectedFileName && (
            <div className="summary__file-badge">
              <span className="summary__file-icon">📄</span>
              <span className="summary__file-name">{selectedFileName}</span>
              <p style={{
                margin: '8px 0 0 0',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                textAlign: 'center',
                fontStyle: 'italic'
              }}>
                Archivo listo. Usa la burbuja ✨ para generar el resumen
              </p>
              <button
                type="button"
                className="summary__file-remove"
                onClick={() => {
                  setSelectedFile(null)
                  setSelectedFileName('')
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                  // Limpiar resultados previos para permitir subir el mismo archivo
                  if (onClearResults) {
                    onClearResults()
                  }
                }}
                aria-label="Quitar archivo"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {showResultModal && (summary || originalText) && (
          <>
            {console.log('🎉 [SummaryAssistant] Modal RENDERING:', {
              showResultModal,
              hasSummary: !!summary,
              hasOriginalText: !!originalText,
              summaryLength: summary?.length || 0
            })}
            <div 
              className="summary-result-modal" 
              onClick={(e) => {
                // Solo cierra el modal si se hace clic en el overlay, no en el contenido
                if (e.target === e.currentTarget) {
                  console.log('❌ [SummaryAssistant] Modal overlay clicked - closing modal')
                  setShowResultModal(false)
                } else {
                  // Si se hace clic en el contenido, permitir que se maneje la interacción
                  console.log('📍 [SummaryAssistant] Click inside modal content detected')
                  // Let handleInteraction work
                }
              }}
            >
              <div className="summary-result-modal__content" onClick={(e) => e.stopPropagation()}>
              {/* Burbuja flotante con acciones de audio */}
              {console.log('🎨 [SummaryAssistant] Rendering bubble:', {
                isMobileDevice,
                hideBubble,
                willAddHiddenClass: !isMobileDevice ? false : hideBubble,
                className: `summary-result-modal__floating-bubble ${!isMobileDevice ? '' : (hideBubble ? 'is-hidden' : '')}`
              })}
              <div 
                className={`summary-result-modal__floating-bubble ${!isMobileDevice ? '' : (hideBubble ? 'is-hidden' : '')}`}
                ref={modalBubbleRef}
                style={{
                  left: `${bubblePosition.x}px`,
                  top: `${bubblePosition.y}px`,
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  if (e.target.closest('.summary__bubble-toggle')) {
                    setIsDragging(true)
                    setDragOffset({
                      x: e.clientX - bubblePosition.x,
                      y: e.clientY - bubblePosition.y
                    })
                  }
                }}
                onMouseMove={(e) => {
                  e.stopPropagation()
                  if (isDragging) {
                    const modalContent = document.querySelector('.summary-result-modal__content')
                    const bubble = modalBubbleRef.current
                    if (modalContent && bubble) {
                      const modalRect = modalContent.getBoundingClientRect()
                      const bubbleRect = bubble.getBoundingClientRect()
                      
                      // Calcular posición considerando el menú (240px de ancho)
                      const menuWidth = showModalActionBubble ? 240 : 0
                      const maxX = modalRect.width - bubbleRect.width - menuWidth - 24
                      const maxY = modalRect.height - bubbleRect.height - 24
                      
                      const newX = Math.max(24, Math.min(e.clientX - dragOffset.x, maxX))
                      const newY = Math.max(24, Math.min(e.clientY - dragOffset.y, maxY))
                      
                      setBubblePosition({ x: newX, y: newY })
                    }
                  }
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onTouchStart={(e) => {
                  if (e.target.closest('.summary__bubble-toggle')) {
                    const touch = e.touches[0]
                    setIsDragging(true)
                    setDragOffset({
                      x: touch.clientX - bubblePosition.x,
                      y: touch.clientY - bubblePosition.y
                    })
                  }
                }}
                onTouchMove={(e) => {
                  if (isDragging) {
                    const touch = e.touches[0]
                    const modalContent = document.querySelector('.summary-result-modal__content')
                    const bubble = modalBubbleRef.current
                    if (modalContent && bubble) {
                      const modalRect = modalContent.getBoundingClientRect()
                      const bubbleRect = bubble.getBoundingClientRect()
                      
                      // En móvil, considerar el menú (240px) y dar más margen
                      const menuWidth = showModalActionBubble ? 240 : 0
                      const maxX = modalRect.width - bubbleRect.width - menuWidth - 16
                      const maxY = modalRect.height - bubbleRect.height - 16
                      
                      const newX = Math.max(16, Math.min(touch.clientX - dragOffset.x, maxX))
                      const newY = Math.max(16, Math.min(touch.clientY - dragOffset.y, maxY))
                      
                      setBubblePosition({ x: newX, y: newY })
                    }
                  }
                }}
                onTouchEnd={() => setIsDragging(false)}
              >
                <button
                  type="button"
                  className="summary__bubble-toggle"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isDragging) {
                      setShowModalActionBubble(!showModalActionBubble)
                    }
                  }}
                  aria-label="Menú de opciones de audio"
                >
                  ✨
                </button>
                {showModalActionBubble && (
                  <div className="summary__bubble-menu" onClick={(e) => e.stopPropagation()}>
                    {summary && (
                      <button
                        type="button"
                        className={`summary__bubble-item ${activeResultTab === 'summary' ? 'is-active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveResultTab('summary')
                          setShowModalActionBubble(false)
                        }}
                      >
                        <span className="summary__bubble-icon">📄</span>
                        <span className="summary__bubble-text">Ver resumen</span>
                      </button>
                    )}
                    {originalText && (
                      <button
                        type="button"
                        className={`summary__bubble-item ${activeResultTab === 'original' ? 'is-active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveResultTab('original')
                          setShowModalActionBubble(false)
                        }}
                      >
                        <span className="summary__bubble-icon">📖</span>
                        <span className="summary__bubble-text">Texto completo</span>
                      </button>
                    )}
                    <div className="summary__bubble-divider"></div>
                    <button
                      type="button"
                      className="summary__bubble-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSpeak(summary)
                        setShowModalActionBubble(false)
                      }}
                      disabled={!summary}
                    >
                      <span className="summary__bubble-icon">🔊</span>
                      <span className="summary__bubble-text">Escuchar resumen</span>
                    </button>
                    <button
                      type="button"
                      className="summary__bubble-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStopSpeaking()
                        setShowModalActionBubble(false)
                      }}
                    >
                      <span className="summary__bubble-icon">⏹️</span>
                      <span className="summary__bubble-text">Detener voz</span>
                    </button>
                    <div className="summary__bubble-divider"></div>
                    <button
                      type="button"
                      className="summary__bubble-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowResultModal(false)
                        setShowModalActionBubble(false)
                      }}
                    >
                      <span className="summary__bubble-icon">✕</span>
                      <span className="summary__bubble-text">Cerrar ventana</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Área de contenido */}
              <div className="summary-result-modal__body">
                {activeResultTab === 'summary' && summary && (
                  <div className="summary-result-modal__text">
                    {summarySegments.map((segment, index) => (
                      <p key={`segment-${index}`} className="summary-result-modal__paragraph">
                        {segment}
                      </p>
                    ))}
                  </div>
                )}
                {activeResultTab === 'original' && originalText && (
                  <div className="summary-result-modal__text">
                    <p className="summary-result-modal__paragraph">{originalText}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </section>
  )
}

export default SummaryAssistant