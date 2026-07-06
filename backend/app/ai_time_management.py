"""
Módulo de Gestión de Tiempo con IA - Iris.

Sistema completo de recomendación de herramientas de estudio basadas en IA,
verificación de progreso mediante photos, y monitoreo de sesiones de aprendizaje.
"""

import uuid
import os
import json
import base64
from datetime import datetime, timedelta
from typing import List, Optional
import logging
from email.message import EmailMessage

try:
    import google.genai as genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    logging.warning("⚠️ google-genai no disponible para checkpoints con IA")

from .models import (
    AITimeManagementTool,
    AIStudySession,
    AIToolRecommendation,
    Checkpoint,
    TestAnalysisResult,
    LearningStyle,
    CheckpointVerificationRequest,
    CheckpointVerificationResponse,
)

logger = logging.getLogger(__name__)


# ============ ANÁLISIS DE TEST ============

def analyze_test_results(
    test_answers: dict,
    user_email: str
) -> TestAnalysisResult:
    """
    Analiza respuestas del test de aprendizaje y genera perfil del usuario.
    
    Args:
        test_answers: Dict con respuestas del test
        user_email: Email del usuario
        
    Returns:
        TestAnalysisResult con análisis y estilo de aprendizaje
    """
    
    # Puntuaciones del test (0-100)
    focus_strength = test_answers.get("focus_strength", 50)  # Capacidad de enfoque
    consistency = test_answers.get("consistency", 50)  # Consistencia en sesiones
    distractibility = test_answers.get("distractibility", 50)  # 100 = muy distraído
    time_preference = test_answers.get("time_preference", "medium")  # short, medium, long
    
    # Determinar estilo de aprendizaje
    visual_score = test_answers.get("visual_questions", 0)
    auditory_score = test_answers.get("auditory_questions", 0)
    kinesthetic_score = test_answers.get("kinesthetic_questions", 0)
    reading_score = test_answers.get("reading_questions", 0)
    
    scores = {
        LearningStyle.VISUAL: visual_score,
        LearningStyle.AUDITORY: auditory_score,
        LearningStyle.KINESTHETIC: kinesthetic_score,
        LearningStyle.READING: reading_score,
    }
    
    # Encontrar estilo dominante
    if max(scores.values()) == 0:
        learning_style = LearningStyle.MIXED
    else:
        learning_style = max(scores, key=scores.get)
    
    return TestAnalysisResult(
        learning_style=learning_style,
        focus_strength=focus_strength,
        consistency=consistency,
        distractibility=distractibility,
        preferred_session_length=time_preference,
        test_completed=True,
        timestamp=datetime.now()
    )


def recommend_ai_tool(
    test_result: TestAnalysisResult,
    user_email: str
) -> AIToolRecommendation:
    """
    Recomienda 1 de las 3 herramientas basada en análisis de test.
    
    Lógica:
    - Alto enfoque + consistencia → Deep Focus Sprints
    - Bajo distractibilidad + quiere flexibilidad → Adaptive Learning
    - Bajo enfoque → Goal Tracking (metas pequeñas)
    
    Args:
        test_result: Resultado del análisis de test
        user_email: Email del usuario
        
    Returns:
        AIToolRecommendation con herramienta y confianza
    """
    
    focus = test_result.focus_strength
    consistency = test_result.consistency
    distractibility = 100 - test_result.distractibility  # Invertir para lógica
    
    # Puntuación para cada herramienta
    adaptive_score = focus * 0.4 + (100 - consistency) * 0.3 + distractibility * 0.3
    deep_focus_score = focus * 0.5 + consistency * 0.35 + distractibility * 0.15
    goal_tracking_score = (100 - distractibility) * 0.4 + (100 - focus) * 0.4 + consistency * 0.2
    
    # Seleccionar mejor herramienta
    scores = {
        AITimeManagementTool.ADAPTIVE_LEARNING: adaptive_score,
        AITimeManagementTool.DEEP_FOCUS: deep_focus_score,
        AITimeManagementTool.GOAL_TRACKING: goal_tracking_score,
    }
    
    recommended_tool = max(scores, key=scores.get)
    confidence = scores[recommended_tool] / 100.0  # Normalizar a 0-1
    
    # Generar razonamiento
    reasoning_map = {
        AITimeManagementTool.ADAPTIVE_LEARNING: 
            "Tu estilo es adaptable y necesitas flexibilidad. Adaptive Learning ajustará automáticamente tu ritmo según avances.",
        AITimeManagementTool.DEEP_FOCUS:
            "Tu capacidad de concentración es excelente. Deep Focus Sprints maximizarán tu productividad con sesiones estructuradas.",
        AITimeManagementTool.GOAL_TRACKING:
            "Necesitas ver progreso visual. Goal Tracking divide tareas en micro-metas verificables con fotos de avance.",
    }
    
    # Ajustar duración según preferencia
    session_length_map = {
        "short": 25,
        "medium": 50,
        "long": 90,
    }
    
    return AIToolRecommendation(
        tool_type=recommended_tool,
        confidence=min(confidence, 0.95),  # Máx 95% confianza
        reasoning=reasoning_map[recommended_tool],
        suggested_checkpoint_interval=20 if recommended_tool == AITimeManagementTool.ADAPTIVE_LEARNING else 25,
        estimated_session_length=session_length_map.get(test_result.preferred_session_length, 50),
        user_email=user_email,
        test_result=test_result
    )


# ============ GENERACIÓN DE CHECKPOINTS ============

def generate_checkpoints(
    session_id: str,
    tool_type: AITimeManagementTool,
    task_title: str,
    estimated_session_length: int
) -> List[Checkpoint]:
    """
    Genera checkpoints según tipo de herramienta.
    
    Args:
        session_id: ID de la sesión
        tool_type: Tipo de herramienta (Adaptive, Deep Focus, Goal Tracking)
        task_title: Título de la tarea
        estimated_session_length: Duración estimada en minutos
        
    Returns:
        Lista de checkpoints programados
    """
    
    checkpoints = []
    
    if tool_type == AITimeManagementTool.ADAPTIVE_LEARNING:
        # Checkpoint cada 20 minutos
        checkpoint_interval = 20
        num_checkpoints = max(2, estimated_session_length // checkpoint_interval)
        
        for i in range(num_checkpoints):
            scheduled_time = datetime.now() + timedelta(minutes=(i + 1) * checkpoint_interval)
            checkpoints.append(
                Checkpoint(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    checkpoint_number=i + 1,
                    scheduled_time=scheduled_time,
                    status="pending"
                )
            )
    
    elif tool_type == AITimeManagementTool.DEEP_FOCUS:
        # 4 checkpoints: después de 30 min, 35 min (break), 65 min, 75 min
        phase_times = [30, 35, 65, 75]
        
        for i, minutes in enumerate(phase_times):
            if minutes <= estimated_session_length:
                scheduled_time = datetime.now() + timedelta(minutes=minutes)
                checkpoints.append(
                    Checkpoint(
                        id=str(uuid.uuid4()),
                        session_id=session_id,
                        checkpoint_number=i + 1,
                        scheduled_time=scheduled_time,
                        status="pending"
                    )
                )
    
    elif tool_type == AITimeManagementTool.GOAL_TRACKING:
        # 3-5 checkpoints según metas (custom, decididas por usuario)
        # Por defecto 3 hitos
        num_hitos = 3
        interval = estimated_session_length // num_hitos
        
        for i in range(num_hitos):
            scheduled_time = datetime.now() + timedelta(minutes=(i + 1) * interval)
            checkpoints.append(
                Checkpoint(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    checkpoint_number=i + 1,
                    scheduled_time=scheduled_time,
                    status="pending"
                )
            )
    
    return checkpoints


# ============ VERIFICACIÓN POR IA (IRIS) ============

def _get_genai_client():
    """Obtiene un cliente Gemini (reutilizable)."""
    if not GENAI_AVAILABLE:
        return None
    api_key = os.getenv("NOTEBOOKLM_API_KEY")
    if not api_key:
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        logger.error(f"❌ Error creando cliente genai para checkpoint: {e}")
        return None


def verify_checkpoint_with_ai(
    request: CheckpointVerificationRequest,
) -> CheckpointVerificationResponse:
    """
    Verifica progreso mediante análisis de foto y descripción con Gemini.
    Si la IA no está disponible, cae a verificación local con reglas.
    """
    description = request.user_description or ""
    has_photo = bool(request.photo_url or request.photo_base64)

    # ─── Intento con Gemini IA real ───
    client = _get_genai_client()
    if client and (description.strip() or has_photo):
        try:
            return _verify_with_gemini(client, request, description, has_photo)
        except Exception as e:
            logger.error(f"❌ Error en verificación Gemini: {e}")
            # Fallback a verificación local

    # ─── Fallback: verificación local ───
    return _verify_locally(request, description, has_photo)


def _verify_with_gemini(
    client,
    request: CheckpointVerificationRequest,
    description: str,
    has_photo: bool,
) -> CheckpointVerificationResponse:
    """Usa Gemini 2.5 Flash para analizar el checkpoint con feedback real."""

    # Construir el prompt
    prompt_parts = []

    system_prompt = (
        "Eres Iris, una tutora académica experta de Scolyax. "
        "Un estudiante está en una sesión de estudio y acaba de llegar a un checkpoint de verificación.\n\n"
        "Tu trabajo es:\n"
        "1. VERIFICAR si hay progreso real (sí/no)\n"
        "2. Dar FEEDBACK ESPECÍFICO sobre lo que describe o muestra en su captura\n"
        "3. Dar RECOMENDACIONES CONCRETAS de mejora (qué hacer diferente, cómo mejorar la calidad, técnicas)\n"
        "4. Motivar al estudiante\n\n"
        "IMPORTANTE: Sé específica. No des respuestas genéricas. "
        "Si el estudiante dice que está haciendo un resumen, comenta sobre la calidad, sugiere técnicas de resumen. "
        "Si menciona ejercicios, sugiere cómo verificar respuestas. "
        "Si adjunta captura, describe lo que ves y da consejos.\n\n"
        "Responde EXACTAMENTE en este formato JSON (sin bloques de código, solo JSON puro):\n"
        "{\n"
        '  "verified": true o false,\n'
        '  "confidence": 0.0 a 1.0,\n'
        '  "feedback": "Tu análisis detallado y personalizado del progreso del estudiante (2-4 oraciones)",\n'
        '  "detected": ["elemento 1 detectado", "elemento 2"],\n'
        '  "missing": ["lo que podría mejorar 1", "lo que falta 2"],\n'
        '  "suggestions": ["consejo específico 1", "consejo específico 2", "consejo específico 3"]\n'
        "}"
    )

    user_message = f"El estudiante dice:\n\"{description}\"\n"
    if has_photo:
        user_message += "\n(También adjuntó una captura de pantalla de su progreso)"

    prompt_parts.append(system_prompt + "\n\n" + user_message)

    # Si hay foto en base64, incluirla como imagen para el modelo
    contents = []
    if has_photo and request.photo_base64:
        # Extraer datos base64 (puede tener prefijo data:image/...)
        photo_data = request.photo_base64
        if "," in photo_data:
            photo_data = photo_data.split(",", 1)[1]
        try:
            image_bytes = base64.b64decode(photo_data)
            contents.append(
                types.Content(
                    role="user",
                    parts=[
                        types.Part(text=system_prompt + "\n\n" + user_message),
                        types.Part(inline_data=types.Blob(data=image_bytes, mime_type="image/png")),
                    ]
                )
            )
        except Exception as img_err:
            logger.warning(f"⚠️ No se pudo decodificar imagen: {img_err}")
            contents.append(system_prompt + "\n\n" + user_message)
    else:
        contents.append(system_prompt + "\n\n" + user_message)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            temperature=0.4,
            max_output_tokens=800,
        )
    )

    response_text = response.text.strip()
    logger.info(f"🤖 Gemini checkpoint response: {response_text[:200]}...")

    # Parsear JSON de la respuesta
    try:
        # Limpiar posible markdown wrapping
        clean = response_text
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        clean = clean.strip()
        if clean.startswith("json"):
            clean = clean[4:].strip()

        data = json.loads(clean)

        verified = data.get("verified", False)
        confidence = min(max(float(data.get("confidence", 0.5)), 0), 1)
        feedback = data.get("feedback", "")
        detected = data.get("detected", [])
        missing = data.get("missing", [])
        suggestions = data.get("suggestions", [])

        return CheckpointVerificationResponse(
            checkpoint_id=request.checkpoint_id,
            verified=verified,
            confidence=confidence,
            detected_elements=detected,
            missing_elements=missing,
            ai_feedback=f"🎓 Iris: {feedback}",
            suggestions_for_next=suggestions,
            suggested_break_duration=5,
            performance_trend="improving" if verified else "needs_improvement"
        )
    except (json.JSONDecodeError, KeyError, TypeError) as parse_err:
        logger.warning(f"⚠️ No se pudo parsear respuesta Gemini: {parse_err}")
        # Usar la respuesta en texto plano como feedback
        return CheckpointVerificationResponse(
            checkpoint_id=request.checkpoint_id,
            verified=True,  # Si Gemini respondió, asumir que hay progreso
            confidence=0.7,
            detected_elements=["Respuesta analizada por Iris"],
            missing_elements=[],
            ai_feedback=f"🎓 Iris: {response_text[:500]}",
            suggestions_for_next=["Sigue con el buen trabajo", "Intenta ser más específico en el próximo checkpoint"],
            suggested_break_duration=5,
            performance_trend="stable"
        )


def _verify_locally(
    request: CheckpointVerificationRequest,
    description: str,
    has_photo: bool,
) -> CheckpointVerificationResponse:
    """Verificación local (fallback sin Gemini)."""

    desc_lower = description.lower()
    desc_words = len(description.split())

    positive_indicators = [
        "completé", "terminé", "hice", "logré", "avancé", "implementé",
        "escribí", "dibujé", "instalé", "configuré", "resolvé", "leí",
        "estudié", "practiqué", "repasé", "analicé", "revisé",
        "resumen", "párrafo", "ejercicio", "problema", "página",
        "capítulo", "sección", "punto", "nota", "apunte",
        "actualmente", "estoy haciendo", "me encuentro", "voy en"
    ]

    has_positive = any(ind in desc_lower for ind in positive_indicators)

    # Más generoso si tiene foto
    confidence = 0.0
    confidence += 0.35 if has_photo else 0.0
    confidence += 0.35 if has_positive else 0.1
    confidence += 0.30 if desc_words > 8 else (0.15 if desc_words > 3 else 0.05)

    verified = confidence >= 0.55

    detected = []
    missing = []
    suggestions = []

    if has_photo:
        detected.append("📸 Captura de pantalla adjunta")
        suggestions.append("Excelente que incluyas evidencia visual")
    else:
        missing.append("Adjuntar captura de pantalla fortalece tu evidencia")

    if has_positive:
        detected.append("📝 Descripción con indicadores de progreso")
    else:
        missing.append("Menciona específicamente qué completaste o en qué avanzaste")

    if desc_words > 15:
        detected.append("✅ Descripción detallada")
        suggestions.append("Tu nivel de detalle es bueno, mantén esta práctica")
    elif desc_words > 5:
        suggestions.append("Intenta ser más específico: cantidad de ejercicios, páginas leídas, palabras escritas")
    else:
        missing.append("Proporciona más detalles: ¿cuánto avanzaste? ¿qué aprendiste?")

    # Sugerencias contextuales según lo mencionado
    if "resumen" in desc_lower:
        suggestions.append("💡 Tip: Usa la técnica de resumen activo — resume cada sección con tus propias palabras sin mirar el texto")
        suggestions.append("📌 Verifica que tu resumen cubra: idea principal, argumentos clave y conclusión")
    elif "ejercicio" in desc_lower or "problema" in desc_lower:
        suggestions.append("💡 Tip: Después de resolver, vuelve a hacer los ejercicios sin mirar tus notas para verificar comprensión")
        suggestions.append("📌 Si un ejercicio te costó, márcalo y repásalo al final de la sesión")
    elif "leí" in desc_lower or "lectura" in desc_lower or "capítulo" in desc_lower:
        suggestions.append("💡 Tip: Después de leer, escribe 3 ideas principales de memoria — esto fortalece la retención")
        suggestions.append("📌 Subraya o anota en los márgenes las partes que no entiendes para repasarlas")
    elif "párrafo" in desc_lower or "ensayo" in desc_lower or "escribí" in desc_lower:
        suggestions.append("💡 Tip: Lee en voz alta lo que escribiste — ayuda a detectar errores y mejorar fluidez")
        suggestions.append("📌 Asegúrate de que cada párrafo tenga una idea central clara")
    else:
        suggestions.append("💡 Tip: Alterna entre estudiar y auto-evaluarte — esto mejora la retención a largo plazo")
        suggestions.append("📌 Toma 2 minutos para anotar lo más importante que has aprendido hasta ahora")

    # Siempre agregar algo motivador
    if verified:
        feedback = f"🎓 Iris: ¡Buen progreso! {'. '.join(detected[:2])}. Sigue así, vas por buen camino."
    else:
        feedback = f"🎓 Iris: Necesito más evidencia. {'. '.join(missing[:2])}. Intenta de nuevo con más detalles."

    return CheckpointVerificationResponse(
        checkpoint_id=request.checkpoint_id,
        verified=verified,
        confidence=confidence,
        detected_elements=detected,
        missing_elements=missing,
        ai_feedback=feedback,
        suggestions_for_next=suggestions[:4],
        suggested_break_duration=5,
        performance_trend="improving" if verified else "needs_improvement"
    )


# ============ NOTIFICACIONES ============

def send_checkpoint_notification(
    user_email: str,
    task_title: str,
    checkpoint_number: int,
    session_url: str
) -> bool:
    """
    Envía notificación por email cuando llega checkpoint.
    Compatible con estructura de mailer.py
    """
    from .mailer import _send_message_or_outbox
    
    message = EmailMessage()
    message["Subject"] = f"⏰ Checkpoint #{checkpoint_number} - {task_title}"
    message["From"] = "noreply@scolyax.app"
    message["To"] = user_email
    
    html_body = f"""
    <html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1f6feb;">⏰ Es hora de tu Checkpoint</h2>
            
            <p>Tu sesión de estudio continúa. Necesitamos verificar tu progreso.</p>
            
            <div style="background: #f0f0f0; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #333;">Detalles:</h3>
                <ul style="font-size: 14px;">
                    <li><strong>Tarea:</strong> {task_title}</li>
                    <li><strong>Checkpoint:</strong> #{checkpoint_number}</li>
                    <li><strong>Requerido:</strong> Foto + descripción de avance</li>
                </ul>
            </div>
            
            <p><a href="{session_url}" style="display: inline-block; background: #1f6feb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                🚀 Ir al Checkpoint
            </a></p>
            
            <p style="color: #666; font-size: 12px;">
                Tienes 5 minutos para responder. Si no respondes, tu sesión se pausará automáticamente.
            </p>
            
            <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; color: #888; font-size: 12px;">
                <p>Scolyax - Plataforma de Estudio Inclusiva</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    message.set_content("Es hora de tu checkpoint en Scolyax")
    message.add_alternative(html_body, subtype="html")
    
    try:
        result = _send_message_or_outbox(message, prefix='checkpoint')
        logger.info(f"✅ Notificación checkpoint enviada a {user_email}")
        return True
    except Exception as e:
        logger.error(f"❌ Error enviando notificación checkpoint: {e}")
        return False
