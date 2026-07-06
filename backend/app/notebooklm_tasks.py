"""
Tareas avanzadas con google-genai (Google Gemini) AI.

Proporciona funciones para:
- Análisis de sentimiento
- Categorización automática
- Extracción de entidades NER
- Generación de contenido
- Q&A sobre documentos

Todas utilizan Google Genai (Gemini) API - Acceso GRATIS
Optimizado con caché inteligente para maximizar cuota diaria
"""

import logging
import os
import re
import time
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
import pytz

try:
    import google.genai as genai
    from google.genai import types
    NOTEBOOKLM_AVAILABLE = True
except ImportError:
    NOTEBOOKLM_AVAILABLE = False
    logging.warning("⚠️ Google Genai no está instalado. Instálalo con: pip install -U google-genai")

# Importar sistema de caché
try:
    from .ai_cache import get_cached_response, save_to_cache, get_cache_stats
    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False
    logging.warning("⚠️ Sistema de caché no disponible")


# ─── Iris System Prompt (precisión investigativa) ───
IRIS_SYSTEM_PROMPT = """\
Eres Iris, el agente de inteligencia de Scolyax: no un simple asistente que responde, sino un AGENTE IA que entiende objetivos, razona, planifica y lleva al estudiante a la acción. Acompañas a estudiantes (muchos con TDAH o perfiles neurodivergentes) a aprender mejor y avanzar de verdad.

IDENTIDAD Y CARÁCTER:
- Te llamas Iris. Eres curiosa, rigurosa y cálida; mentora más que buscador. Hablas de tú, con cercanía y sin condescendencia.
- Piensas como agente: primero entiendes la meta real detrás de la pregunta, razonas los pasos internamente y solo entonces respondes con un plan claro y accionable.
- Eres proactiva: te anticipas, propones el siguiente paso concreto y ofreces ejecutar acciones dentro de Scolyax.

DOMINIOS DE EXPERTISE (conocimiento robusto):
- Ciencia del aprendizaje: recuerdo activo, repetición espaciada, intercalado, elaboración, técnica Feynman, metacognición, gestión de la atención y la energía.
- Métodos de estudio de Scolyax: Pomodoro (25/5), Flowtime (flujo libre) y 52/17; sabes cuándo conviene cada uno según el perfil.
- Materias: matemáticas, ciencias (física, química, biología), programación, humanidades, ciencias sociales, idiomas y escritura académica (estructura, citación, argumentación).
- Productividad y TDAH: descomposición de tareas en micro-pasos, manejo de la procrastinación y la sobrecarga, planificación realista, hábitos.
- Estrategia de exámenes, investigación, síntesis de documentos y pensamiento crítico.

COMPORTAMIENTO DE AGENTE:
- Descompón los objetivos complejos en pasos ordenados y ejecutables; no te quedes en lo abstracto.
- Cuando sea útil, ofrece accionar Scolyax: crear tareas o recordatorios, armar un plan/horario de estudio, recomendar una técnica, o activar el Modo Crisis si la persona está bloqueada o saturada.
- Termina las respuestas con un siguiente paso concreto o una pregunta que mueva a la acción.
- Si falta un dato CRÍTICO, haz UNA sola pregunta de aclaración; si no, asume lo más razonable y dilo explícitamente.
- Adapta el apoyo al estado emocional: si detectas agobio, baja el ritmo, valida y simplifica a "solo el siguiente paso".

RIGOR Y VERACIDAD:
- Da información precisa y verificable; muestra el razonamiento o el procedimiento en matemáticas, lógica y código.
- Si no estás segura de un dato, dilo con honestidad en lugar de inventar. Distingue hechos de opiniones o estimaciones.
- Usa ejemplos concretos y, cuando aporte, datos o cifras.

FORMATO:
- Usa ## para títulos y ### para subtítulos. **negrita** para términos clave. Listas con - o •. Listas numeradas para pasos.
- NUNCA uses * solitario ni __; separa secciones con una línea en blanco; ninguna oración queda a medias (sin "...").
- No repitas la pregunta del usuario al inicio.

CALIBRA LA EXTENSIÓN a la complejidad real:
  • Saludo / trivial → 1-2 líneas, sin secciones.
  • Concepto breve → párrafo conciso (3-6 líneas).
  • Explicación de tema → secciones, 150-400 palabras.
  • Informe / investigación / plan → estructura completa, 400-800 palabras.
Brevedad precisa cuando basta; profundidad cuando se pide. Responde SIEMPRE en español.
"""

# ─── Clasificador de intención para tokens dinámicos ───

# Palabras clave que indican consultas que requieren respuesta EXTENSA
_INTENT_EXTENDED = re.compile(
    r"(informe|investigaci[oó]n|an[aá]lisis detallado|explica a fondo|ensayo|"
    r"historia (de|del|completa)|"
    r"todo (sobre|acerca)|cu[eé]ntame (todo|sobre)|describe (detalladamente|exhaustivamente)|"
    r"reporte|monograf[ií]a|tesis|desarrollo completo|profundiz[ao]|"
    r"comparaci[oó]n|pros y contras|ventajas y desventajas|paso a paso)",
    re.IGNORECASE
)

# Palabras clave que indican respuesta MEDIA (explicación / concepto)
_INTENT_MEDIUM = re.compile(
    r"(explica|qu[eé] es|c[oó]mo funciona|c[oó]mo se hace|diferencia entre|"
    r"por qu[eé]|para qu[eé]|d[eé]jame entender|resum[ei]|resume|sintetiza|ejemplo de|"
    r"ense[ñn]ame|aprend[ae]r)",
    re.IGNORECASE
)

# Palabras clave que indican respuesta BREVE
_INTENT_BRIEF = re.compile(
    r"(hola|gracias|qu[eé] hora|fecha|cu[aá]nto|qui[eé]n (es|fue)|d[oó]nde (es|fue|queda)|"
    r"cu[aá]ndo (es|fue)|define |significado de|traduce|convierte)",
    re.IGNORECASE
)


def classify_intent(prompt: str) -> Tuple[str, int, float]:
    """
    Clasifica la intención del prompt y devuelve (intent, max_tokens, temperature).

    Categorías:
      'brief'    →  700 tokens  — saludos, datos puntuales, definiciones cortas
      'medium'   → 1200 tokens  — explicaciones, conceptos, resúmenes cortos
      'extended' → 2500 tokens  — informes, análisis profundos, investigaciones
      'document' → 4000 tokens  — análisis de documentos largos o imágenes
    """
    # Documentos o imágenes (prompt largo = contexto de documento)
    if len(prompt) > 1200:
        return 'document', 4000, 0.3

    if _INTENT_EXTENDED.search(prompt):
        return 'extended', 2500, 0.45

    if _INTENT_MEDIUM.search(prompt):
        return 'medium', 1200, 0.4

    if _INTENT_BRIEF.search(prompt):
        return 'brief', 700, 0.2

    # Default: respuesta media
    return 'medium', 1200, 0.4


def _truncate_to_complete_sentence(text: str) -> str:
    """
    Garantiza que el texto termina en una oración completa.
    Si el último carácter no es un signo de cierre, recorta hasta
    el último punto, signo de interrogación o exclamación encontrado.
    """
    if not text:
        return text
    stripped = text.rstrip()
    # Si ya termina en signo de cierre, está completo
    if stripped and stripped[-1] in '.!?:"\u201d':
        return stripped
    # Buscar el último signo de cierre de oración
    for i in range(len(stripped) - 1, -1, -1):
        if stripped[i] in '.!?':
            return stripped[:i + 1]
    # No se encontró ningún signo → devolver tal cual (mejor algo que nada)
    return stripped


class NotebookLMTasks:
    """Gestor de tareas avanzadas con google-genai (Google Gemini) AI."""
    
    GEMINI_MODEL = "gemini-2.5-flash"
    
    def __init__(self):
        """Inicializa el cliente de google-genai/Gemini."""
        self.api_key = os.getenv("NOTEBOOKLM_API_KEY") or os.getenv("GEMINI_API_KEY")
        self.client = None
        self.request_count = 0   # Contador de requests a la API
        self.cache_hits = 0      # Contador de respuestas del caché
        self.summaries_count = 0 # Contador de resúmenes generados
        
        # Patrones para respuestas locales (no consumen cuota de IA)
        self.local_patterns = {
            r"(qu[eé] hora|hora actual|qu[eé] horas son)": self._get_current_time,
            r"(qu[eé] d[íi]a|fecha|hoy es)": self._get_current_date,
            r"calcul[ao]|suma|resta|multiplica|divide": self._calculate_math,
        }
        
        if not NOTEBOOKLM_AVAILABLE:
            logging.warning("❌ Google Genai no instalado. Las tareas usarán respuestas simples.")
            return
        
        if not self.api_key:
            logging.warning("⚠️ NOTEBOOKLM_API_KEY / GEMINI_API_KEY no configurada.")
            return
        
        try:
            self.client = genai.Client(api_key=self.api_key)
            logging.info("✅ Google Genai (Gemini 2.5 Flash) conectado para tareas avanzadas")
            if CACHE_AVAILABLE:
                stats = get_cache_stats()
                logging.info(f"📦 Caché: {stats['valid']} respuestas válidas guardadas")
        except Exception as e:
            logging.warning(f"⚠️ Error inicializando google-genai: {type(e).__name__}: {e}")
    
    def is_available(self) -> bool:
        """Verifica si google-genai está disponible."""
        return self.client is not None
    
    def _generate_with_cache(self, prompt: str, temperature: float = 0.3, max_tokens: int = 1500) -> str:
        """
        Genera contenido con soporte de caché inteligente.
        
        Args:
            prompt: Texto del prompt
            temperature: Temperatura del modelo (0.0-1.0)
            max_tokens: Máximo de tokens en la respuesta
        
        Returns:
            Texto de respuesta (del caché o de la API)
        """
        # Verificar caché primero
        if CACHE_AVAILABLE:
            cached = get_cached_response(prompt)
            if cached:
                self.cache_hits += 1
                logging.debug(f"📦 Cache hit #{self.cache_hits}")
                try:
                    from .supabase_storage import increment_cache_hits
                    result = increment_cache_hits()
                    logging.warning(f"✅ Cache hit incrementado en Supabase: {result}")
                except Exception as e:
                    logging.error(f"❌ Error incrementando cache_hits en Supabase: {e}")
                return cached['response']

        # Llamar a la API
        try:
            response = self.client.models.generate_content(
                model=self.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                )
            )

            self.request_count += 1
            response_text = response.text.strip()

            if CACHE_AVAILABLE:
                save_to_cache(prompt, response_text)

            if self.request_count >= 15:
                logging.warning(f"⚠️ ALERTA CUOTA: {self.request_count}/20 requests hoy.")
            else:
                logging.info(f"✅ Iris request #{self.request_count} | tokens_max={max_tokens} | cache_hits={self.cache_hits}")

            return response_text

        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                logging.error(f"❌ CUOTA AGOTADA: {self.request_count} requests hoy.")
                raise
            if "503" in error_str or "UNAVAILABLE" in error_str:
                logging.warning("⚠️ Gemini 503 UNAVAILABLE (alta demanda)")
                return "⏳ Iris está experimentando alta demanda en este momento. Por favor, intenta de nuevo en unos segundos. 🔄"
            raise
    
    def get_stats(self) -> Dict[str, int]:
        """Obtiene estadísticas de uso."""
        stats = {
            'requests_today': self.request_count,
            'cache_hits': self.cache_hits,
            'requests_remaining': max(0, 20 - self.request_count),
            'summaries_count': self.summaries_count,
        }
        
        if CACHE_AVAILABLE:
            cache_stats = get_cache_stats()
            stats['cached_responses'] = cache_stats['valid']
        
        return stats
    
    def _get_current_time(self, text: str) -> Optional[str]:
        """Responde con la hora actual de Colombia."""
        try:
            tz = pytz.timezone('America/Bogota')
            now = datetime.now(tz)
            return f"🕐 La hora actual en Colombia es: {now.strftime('%I:%M %p')} ({now.strftime('%H:%M')})"
        except:
            return None
    
    def _get_current_date(self, text: str) -> Optional[str]:
        """Responde con la fecha actual."""
        try:
            tz = pytz.timezone('America/Bogota')
            now = datetime.now(tz)
            days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
            months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                     'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
            day_name = days[now.weekday()]
            month_name = months[now.month - 1]
            return f"📅 Hoy es {day_name}, {now.day} de {month_name} de {now.year}"
        except:
            return None
    
    def _calculate_math(self, text: str) -> Optional[str]:
        """Calcula operaciones matemáticas simples."""
        try:
            # Intenta extraer números y operación
            numbers = re.findall(r'\d+(?:\.\d+)?', text)
            if len(numbers) < 2:
                return None
            
            a, b = float(numbers[0]), float(numbers[1])
            
            if 'suma' in text.lower() or '+' in text:
                return f"🔢 {a} + {b} = {a + b}"
            elif 'resta' in text.lower() or '-' in text:
                return f"🔢 {a} - {b} = {a - b}"
            elif 'multiplica' in text.lower() or 'por' in text.lower() or '*' in text or 'x' in text:
                return f"🔢 {a} × {b} = {a * b}"
            elif 'divide' in text.lower() or '/' in text:
                if b != 0:
                    return f"🔢 {a} ÷ {b} = {a / b:.2f}"
                else:
                    return "⚠️ No puedo dividir entre cero"
            return None
        except:
            return None
    
    def _try_local_response(self, text: str) -> Optional[str]:
        """Intenta responder localmente sin consumir cuota de IA."""
        text_lower = text.lower()
        
        for pattern, handler in self.local_patterns.items():
            if re.search(pattern, text_lower):
                response = handler(text)
                if response:
                    return response
        
        return None
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """
        Analiza el sentimiento del texto.
        
        Args:
            text: Texto a analizar
        
        Returns:
            {
                "sentiment": "Positivo|Neutral|Negativo",
                "score": 0.0-1.0,
                "explanation": "Explicación breve"
            }
        """
        if not text.strip():
            return {"sentiment": "Neutral", "score": 0.5, "explanation": "Texto vacío"}
        
        if not self.is_available():
            # Fallback simple
            negative_keywords = ['malo', 'terrible', 'horrible', 'odio', 'peor', 'decepcionante', 'bad', 'terrible', 'hate', 'worst', 'disappointing']
            positive_keywords = ['bueno', 'excelente', 'maravilloso', 'amor', 'perfecto', 'good', 'excellent', 'wonderful', 'love', 'perfect']
            
            text_lower = text.lower()
            neg_count = sum(1 for w in negative_keywords if w in text_lower)
            pos_count = sum(1 for w in positive_keywords if w in text_lower)
            
            if neg_count > pos_count:
                return {"sentiment": "Negativo", "score": 0.2, "explanation": "Análisis local"}
            elif pos_count > neg_count:
                return {"sentiment": "Positivo", "score": 0.8, "explanation": "Análisis local"}
            else:
                return {"sentiment": "Neutral", "score": 0.5, "explanation": "Análisis local"}
        
        # Limita el texto
        if len(text) > 3000:
            text = text[:3000] + "..."
        
        prompt = f"""Analiza el sentimiento del siguiente texto y devuelve EXACTAMENTE este formato:
SENTIMIENTO: [Positivo|Neutral|Negativo]
PUNTUACIÓN: [0.0-1.0]
EXPLICACIÓN: [una línea breve]

TEXTO:
{text}"""
        
        try:
            response_text = self._generate_with_cache(prompt, temperature=0.1, max_tokens=400)
            
            lines = response_text.split('\n')
            
            sentiment = "Neutral"
            score = 0.5
            explanation = "Análisis completado"
            
            for line in lines:
                if "SENTIMIENTO:" in line:
                    sentiment = line.split(":")[-1].strip()
                elif "PUNTUACIÓN:" in line:
                    try:
                        score = float(line.split(":")[-1].strip())
                    except:
                        pass
                elif "EXPLICACIÓN:" in line:
                    explanation = line.split(":")[-1].strip()
            
            return {
                "sentiment": sentiment,
                "score": min(1.0, max(0.0, score)),
                "explanation": explanation
            }
        except Exception as e:
            logging.error(f"❌ Error analizando sentimiento: {e}")
            return {"sentiment": "Error", "score": 0.0, "explanation": str(e)}
    
    async def categorize(self, text: str, categories: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Categoriza el texto automáticamente.
        
        Args:
            text: Texto a categorizar
            categories: Lista de categorías posibles (si vacía, detecta automáticamente)
        
        Returns:
            {
                "category": "Categoría detectada",
                "confidence": 0.0-1.0,
                "alternatives": [...]
            }
        """
        if not text.strip():
            return {"category": "Desconocida", "confidence": 0.0, "alternatives": []}
        
        if not self.is_available():
            return {"category": "Sin IA", "confidence": 0.0, "alternatives": []}
        
        # Limita el texto
        if len(text) > 3000:
            text = text[:3000] + "..."
        
        categories_str = ", ".join(categories) if categories else "Detecta automáticamente"
        
        prompt = f"""Categoriza el siguiente texto.
Categorías posibles: {categories_str}

Devuelve EXACTAMENTE este formato:
CATEGORÍA: [nombre]
CONFIANZA: [0.0-1.0]
ALTERNATIVAS: [cat1, cat2, cat3]

TEXTO:
{text}"""
        
        try:
            response = self.client.models.generate_content(
                model=self.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=500,
                )
            )
            
            response_text = response.text.strip()
            lines = response_text.split('\n')
            
            result = {
                "category": "Desconocida",
                "confidence": 0.5,
                "alternatives": []
            }
            
            for line in lines:
                if "CATEGORÍA:" in line:
                    result["category"] = line.split(":")[-1].strip()
                elif "CONFIANZA:" in line:
                    try:
                        result["confidence"] = float(line.split(":")[-1].strip())
                    except:
                        pass
                elif "ALTERNATIVAS:" in line:
                    alts = line.split(":")[-1].strip().strip("[]")
                    result["alternatives"] = [a.strip() for a in alts.split(",")]
            
            return result
        except Exception as e:
            logging.error(f"❌ Error categorizando: {e}")
            return {"category": "Error", "confidence": 0.0, "alternatives": []}
    
    async def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extrae entidades nombradas (NER).
        
        Args:
            text: Texto a analizar
        
        Returns:
            {
                "personas": [...],
                "lugares": [...],
                "organizaciones": [...]
            }
        """
        if not text.strip():
            return {"personas": [], "lugares": [], "organizaciones": []}
        
        if not self.is_available():
            return {"personas": [], "lugares": [], "organizaciones": []}
        
        # Limita el texto
        if len(text) > 5000:
            text = text[:5000] + "..."
        
        prompt = f"""Extrae entidades nombradas del siguiente texto.
Identifica: PERSONAS, LUGARES, ORGANIZACIONES

Devuelve EXACTAMENTE este formato:
PERSONAS: [nombre1, nombre2, ...]
LUGARES: [lugar1, lugar2, ...]
ORGANIZACIONES: [org1, org2, ...]

TEXTO:
{text}"""
        
        try:
            response = self.client.models.generate_content(
                model=self.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=600,
                )
            )
            
            response_text = response.text.strip()
            lines = response_text.split('\n')
            
            result = {"personas": [], "lugares": [], "organizaciones": []}
            
            for line in lines:
                if "PERSONAS:" in line:
                    entities = line.split(":")[-1].strip().strip("[]")
                    result["personas"] = [e.strip() for e in entities.split(",") if e.strip()]
                elif "LUGARES:" in line:
                    entities = line.split(":")[-1].strip().strip("[]")
                    result["lugares"] = [e.strip() for e in entities.split(",") if e.strip()]
                elif "ORGANIZACIONES:" in line:
                    entities = line.split(":")[-1].strip().strip("[]")
                    result["organizaciones"] = [e.strip() for e in entities.split(",") if e.strip()]
            
            return result
        except Exception as e:
            logging.error(f"❌ Error extrayendo entidades: {e}")
            return {"personas": [], "lugares": [], "organizaciones": []}
    
    async def generate_content(self, prompt: str, max_length: int = 0, skip_local: bool = False) -> Dict[str, Any]:
        """
        Genera contenido basado en un prompt con tokens dinámicos según intención.

        El clasificador de intención determina automáticamente el número óptimo de
        tokens de salida y la temperatura, evitando desperdiciar cuota en respuestas
        simples y garantizando profundidad cuando se solicita un informe o análisis.

        Categorías de intención:
          'brief'    →  300 tokens, temp 0.20  — saludos, datos puntuales
          'medium'   →  900 tokens, temp 0.40  — explicaciones, conceptos
          'extended' → 2000 tokens, temp 0.45  — informes, análisis profundos
          'document' → 3500 tokens, temp 0.30  — análisis de documentos / imágenes

        Args:
            prompt: Instrucción o pregunta del usuario
            max_length: Límite de caracteres en la respuesta (0 = sin límite adicional)
            skip_local: Si True, siempre usa la API (ignora patrones locales)

        Returns:
            {
                "content": str,
                "tokens_used": int  (estimación de palabras),
                "intent": str,
                "max_tokens": int,
                "source": str
            }
        """
        if not prompt.strip():
            return {"content": "", "tokens_used": 0, "intent": "empty", "max_tokens": 0, "source": "empty"}

        # ── 1. Respuesta local (sin consumir cuota) ──────────────────────
        if not skip_local and len(prompt) < 500:
            local_response = self._try_local_response(prompt)
            if local_response:
                return {"content": local_response, "tokens_used": 0, "intent": "local", "max_tokens": 0, "source": "local"}

        if not self.is_available():
            return {"content": "⚠️ Iris no está disponible en este momento.", "tokens_used": 0, "intent": "unavailable", "max_tokens": 0, "source": "unavailable"}

        # ── 2. Clasificar intención → tokens + temperatura óptimos ───────
        intent, max_tokens, temperature = classify_intent(prompt)
        logging.info(f"🎯 Iris intent='{intent}' | max_tokens={max_tokens} | temp={temperature} | prompt_len={len(prompt)}")

        try:
            # ── 3. Construir prompt enriquecido con system prompt ─────────
            enriched = f"{IRIS_SYSTEM_PROMPT}\n\n---\n\n{prompt}"

            content = self._generate_with_cache(enriched, temperature=temperature, max_tokens=max_tokens)

            # ── 4. Garantizar oración completa al final ───────────────────
            content = _truncate_to_complete_sentence(content)

            # ── 5. Truncar solo si se especifica max_length ───────────────
            if max_length and len(content) > max_length:
                truncated = content[:max_length]
                last_para = truncated.rfind('\n\n')
                last_line = truncated.rfind('\n')
                cut_at = last_para if last_para > max_length * 0.7 else (last_line if last_line > max_length * 0.6 else len(truncated))
                content = truncated[:cut_at].rstrip()

            return {
                "content": content,
                "tokens_used": len(content.split()),
                "intent": intent,
                "max_tokens": max_tokens,
                "source": "ai"
            }

        except Exception as e:
            error_msg = str(e)
            logging.error(f"❌ Iris generate_content error: {error_msg}")

            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                return {
                    "content": "😅 He agotado mi cuota de consultas por hoy. Puedo responder preguntas simples (hora, fecha, cálculos), pero análisis complejos deben esperar al día siguiente. ¡Perdón!",
                    "tokens_used": 0, "intent": intent, "max_tokens": max_tokens, "source": "quota_error"
                }

            if "503" in error_msg or "UNAVAILABLE" in error_msg:
                return {
                    "content": "⏳ Iris experimenta alta demanda en este momento. Por favor, intenta de nuevo en unos segundos. 🔄",
                    "tokens_used": 0, "intent": intent, "max_tokens": max_tokens, "source": "unavailable"
                }

            return {"content": f"Error inesperado: {error_msg}", "tokens_used": 0, "intent": intent, "max_tokens": max_tokens, "source": "error"}
    
    async def answer_question(self, document: str, question: str) -> Dict[str, Any]:
        """
        Responde una pregunta basada en un documento.
        
        Args:
            document: Documento de referencia
            question: Pregunta a responder
        
        Returns:
            {
                "answer": "Respuesta",
                "confidence": 0.0-1.0,
                "source_quotes": ["quote1", "quote2"]
            }
        """
        if not document.strip() or not question.strip():
            return {"answer": "Documento o pregunta vacío", "confidence": 0.0, "source_quotes": []}
        
        if not self.is_available():
            return {"answer": "IA no disponible", "confidence": 0.0, "source_quotes": []}
        
        # Limita el documento
        if len(document) > 5000:
            document = document[:5000] + "..."
        
        prompt = f"""Basándote en el siguiente documento, responde la pregunta.
Si no puedes responder basándote en el documento, di "No disponible en el documento".

DOCUMENTO:
{document}

PREGUNTA:
{question}

Responde EXACTAMENTE en este formato:
RESPUESTA: [tu respuesta aquí]
CONFIANZA: [0.0-1.0]
CITAS: [cita1; cita2; ...]"""
        
        try:
            response_text = self._generate_with_cache(prompt, temperature=0.4, max_tokens=1500)
            
            lines = response_text.split('\n')
            
            result = {
                "answer": "",
                "confidence": 0.5,
                "source_quotes": []
            }
            
            # Try to extract structured format
            found_respuesta = False
            for line in lines:
                if "RESPUESTA:" in line:
                    result["answer"] = line.split(":", 1)[-1].strip()
                    found_respuesta = True
                elif "CONFIANZA:" in line:
                    try:
                        result["confidence"] = float(line.split(":", 1)[-1].strip())
                    except:
                        pass
                elif "CITAS:" in line:
                    citas = line.split(":", 1)[-1].strip()
                    result["source_quotes"] = [c.strip() for c in citas.split(";") if c.strip()]
            
            # If structured format not found, use entire response as answer
            if not found_respuesta:
                result["answer"] = response_text
            
            return result
        except Exception as e:
            error_msg = str(e)
            logging.error(f"❌ Error respondiendo pregunta: {e}")
            if "503" in error_msg or "UNAVAILABLE" in error_msg:
                return {"answer": "⏳ Iris está experimentando alta demanda. Intenta de nuevo en unos segundos. 🔄", "confidence": 0.0, "source_quotes": []}
            return {"answer": f"Error: {error_msg}", "confidence": 0.0, "source_quotes": []}


    # ─── Análisis multimodal de imágenes ───
    async def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
        prompt: str = ""
    ) -> Dict[str, Any]:
        """
        Analiza una imagen con Gemini multimodal.
        Extrae texto, describe contenido, genera resumen.
        """
        if not self.is_available():
            return {"error": "IA no disponible para análisis de imagen"}

        user_prompt = prompt.strip() or (
            "Analiza esta imagen con detalle académico. "
            "1) Describe el contenido visual. "
            "2) Si contiene texto, transcríbelo fielmente. "
            "3) Identifica conceptos clave, datos o fórmulas. "
            "4) Genera un resumen estructurado del contenido."
        )

        try:
            response = self.client.models.generate_content(
                model=self.GEMINI_MODEL,
                contents=[
                    types.Content(
                        role="user",
                        parts=[
                            types.Part(text=f"{IRIS_SYSTEM_PROMPT}\n\n{user_prompt}"),
                            types.Part(inline_data=types.Blob(data=image_bytes, mime_type=mime_type)),
                        ]
                    )
                ],
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=3000,
                )
            )

            self.request_count += 1
            content = response.text.strip()
            logging.info(f"✅ Imagen analizada: {len(content)} caracteres de respuesta")

            return {
                "content": content,
                "tokens_used": len(content.split()),
                "source": "ai"
            }
        except Exception as e:
            logging.error(f"❌ Error analizando imagen: {e}")
            return {"error": f"Error analizando imagen: {str(e)}"}

    # ─── Generación de imágenes ───
    async def generate_image(self, prompt: str) -> Dict[str, Any]:
        """
        Genera una imagen con modelos gratuitos de Gemini.
        Cadena: Gemini 2.5 Flash Image → Gemini 3 Pro Image Preview
        Con retry automático para errores 429 (rate limit / cuota temporal).
        """
        import base64
        import asyncio

        if not self.is_available():
            return {"error": "IA no disponible para generación de imagen"}

        # ── Helper para extraer imagen de respuesta generate_content ──
        def _extract_image(response):
            if response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        return part.inline_data.data, getattr(part.inline_data, "mime_type", "image/png")
            return None, None

        # Modelos de imagen compatibles con tier gratuito (orden de prioridad)
        IMAGE_MODELS = [
            "gemini-2.5-flash-image",
            "gemini-3-pro-image-preview",
        ]

        for model_name in IMAGE_MODELS:
            for attempt in range(3):  # hasta 3 intentos por modelo
                try:
                    logging.info(f"🎨 Intentando {model_name} (intento {attempt + 1})...")
                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=f"Generate a high quality detailed image of: {prompt}",
                        config=types.GenerateContentConfig(
                            response_modalities=["IMAGE", "TEXT"],
                        )
                    )
                    img_data, mime = _extract_image(response)
                    if img_data:
                        self.request_count += 1
                        logging.info(f"✅ Imagen generada con {model_name}: {len(img_data)} bytes")
                        return {
                            "image_base64": base64.b64encode(img_data).decode("utf-8"),
                            "mime_type": mime,
                            "source": model_name
                        }
                    # Modelo respondió sin imagen, probar siguiente modelo
                    logging.warning(f"⚠️ {model_name}: respondió sin imagen")
                    break

                except Exception as e:
                    err_str = str(e)
                    is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str

                    if is_rate_limit and attempt < 2:
                        wait = (attempt + 1) * 15
                        logging.info(f"⏳ {model_name} cuota temporal agotada, esperando {wait}s...")
                        await asyncio.sleep(wait)
                        continue
                    
                    logging.warning(f"⚠️ {model_name}: {err_str[:150]}")
                    break  # Pasar al siguiente modelo

        # Todos fallaron — dar mensaje claro al usuario
        return {
            "error": "La cuota gratuita de generación de imágenes está temporalmente agotada. "
                     "Google permite ~50 imágenes/día en el tier gratuito. "
                     "Intenta de nuevo en unos minutos o más tarde."
        }


# Instancia global
notebooklm_tasks = NotebookLMTasks()


# Funciones públicas para uso directo
async def analyze_sentiment(text: str) -> Dict[str, Any]:
    """Analiza sentimiento del texto."""
    return await notebooklm_tasks.analyze_sentiment(text)


async def categorize(text: str, categories: Optional[List[str]] = None) -> Dict[str, Any]:
    """Categoriza el texto."""
    return await notebooklm_tasks.categorize(text, categories)


async def extract_entities(text: str) -> Dict[str, List[str]]:
    """Extrae entidades nombradas."""
    return await notebooklm_tasks.extract_entities(text)


async def generate_content(prompt: str, max_length: int = 500) -> Dict[str, Any]:
    """Genera contenido."""
    return await notebooklm_tasks.generate_content(prompt, max_length)


async def answer_question(document: str, question: str) -> Dict[str, Any]:
    """Responde preguntas sobre un documento."""
    return await notebooklm_tasks.answer_question(document, question)
