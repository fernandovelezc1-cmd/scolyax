"""Modelos de datos compartidos entre la API y el frontend de Scolyax."""

from datetime import datetime, time
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """Estados posibles para una tarea académica."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ReminderType(str, Enum):
    """Tipologías de recordatorios que puede crear la persona usuaria."""

    TASK = "task"
    FOCUS = "focus"
    PERSONAL = "personal"


class Reminder(BaseModel):
    """Representa un recordatorio sincronizable con Gmail u Outlook."""

    id: int
    title: str
    description: Optional[str] = None
    remind_at: datetime
    type: ReminderType = ReminderType.TASK
    delivery_provider: "AuthProvider" = Field(default_factory=lambda: AuthProvider.GOOGLE)
    calendar_event_id: Optional[str] = None  # ID del evento en Google Calendar/Outlook
    notified_at: Optional[datetime] = None  # Fecha en que se envió la notificación (si aplica)
    user_email: Optional[str] = None  # Email del usuario al que pertenece el recordatorio


class Task(BaseModel):
    """Define la estructura de una tarea planificada dentro de Scolyax."""

    id: int
    title: str
    course: str
    due_date: Optional[datetime] = None
    status: TaskStatus = TaskStatus.PENDING
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    linked_schedule_ids: List[int] = Field(default_factory=list)
    user_email: Optional[str] = None  # Email del usuario al que pertenece la tarea
    estimated_pomodoros: int = 0  # Pomodoros estimados por IA
    pomodoros_completed: int = 0  # Pomodoros realmente completados
    time_spent_minutes: int = 0  # Tiempo total dedicado
    last_worked_at: Optional[datetime] = None  # Última vez que se trabajó en esta tarea


class ScheduleEntry(BaseModel):
    """Bloque de horario semanal mostrado en el calendario organizado de Scolyax."""

    id: int
    title: str
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    location: Optional[str] = None
    description: Optional[str] = None


class FocusSession(BaseModel):
    """Registro de una sesión de enfoque o pomodoro completada."""

    id: int
    topic: str
    duration_minutes: int
    completed_at: datetime
    linked_task_id: Optional[int] = None  # ID de la tarea vinculada
    linked_task_title: Optional[str] = None  # Título de la tarea (para mostrar)
    user_email: Optional[str] = None  # Email del usuario


class SummaryRequest(BaseModel):
    """Petición de resumen enviada cuando el cliente manda texto en JSON."""

    text: Optional[str] = None
    sentences: int = 5


class SummaryResponse(BaseModel):
    """Respuesta estructurada de la API de resúmenes."""

    summary: str
    highlighted_keywords: List[str] = Field(default_factory=list)
    original_text: str = ""


class DashboardStats(BaseModel):
    """Indicadores que alimentan la cabecera de progreso del tablero."""

    tasks_completed: int
    focus_hours: float
    milestones_completed: int
    upcoming_reminders: int
    streak_days: int


class AuthProvider(str, Enum):
    """Proveedores admitidos para autenticación y notificaciones."""

    GOOGLE = "google"
    MICROSOFT = "microsoft"


class SessionBase(BaseModel):
    """Campos compartidos entre sesiones existentes y nuevas."""

    email: str
    provider: AuthProvider
    display_name: str


class Session(SessionBase):
    """Representa una sesión iniciada que ya fue persistida."""

    id: int
    session_token: Optional[str] = None  # Token para mantener sesión en múltiples dispositivos
    has_completed_onboarding: bool = False  # Si el usuario completó el test cognitivo
    selected_tool: Optional[str] = None  # Herramienta seleccionada después del test
    recommended_tools: Optional[List[str]] = None  # Herramientas recomendadas por el test
    streak_days: int = 0  # Racha de días consecutivos de actividad
    total_xp: int = 0  # XP total acumulado
    level: int = 1  # Nivel del usuario

    def __eq__(self, other: object) -> bool:
        """Compara sesiones por contenido para facilitar las pruebas."""
        if not isinstance(other, Session):
            return NotImplemented
        return (
            getattr(self, "id", None) == getattr(other, "id", None)
            and getattr(self, "email", None) == getattr(other, "email", None)
            and getattr(self, "provider", None) == getattr(other, "provider", None)
            and getattr(self, "display_name", None) == getattr(other, "display_name", None)
        )


class SessionCreate(SessionBase):
    """Payload utilizado para registrar o iniciar sesión."""


class DisplayNameUpdate(BaseModel):
    """Solicitud para actualizar el nombre con el que se muestra la sesión."""

    display_name: str


class UserBase(BaseModel):
    """Atributos fundamentales de un perfil de Scolyax."""

    email: str
    provider: AuthProvider
    display_name: str


class User(UserBase):
    """Perfil persistido con identificador y fecha de creación."""

    id: int
    created_at: datetime
    streak_days: int = 0
    total_xp: int = 0
    level: int = 1
    last_activity_date: Optional[datetime] = None
    has_completed_onboarding: bool = False
    selected_tool: Optional[str] = None
    recommended_tools: List[str] = Field(default_factory=list)


class UserCreate(UserBase):
    """Modelo auxiliar cuando se necesita crear usuarios desde scripts."""


class ReminderCreate(BaseModel):
    """Estructura que utiliza el frontend para proponer un nuevo recordatorio."""

    title: str
    description: Optional[str] = None
    remind_at: datetime
    type: ReminderType = ReminderType.TASK


class ReminderUpdate(BaseModel):
    """Permite actualizar campos puntuales de un recordatorio existente."""

    title: Optional[str] = None
    description: Optional[str] = None
    remind_at: Optional[datetime] = None
    type: Optional[ReminderType] = None


class OnboardingComplete(BaseModel):
    """Datos del test cognitivo y selección de herramienta."""

    selected_tool: str
    recommended_tools: List[str]


class UserStatsPayload(BaseModel):
    """Modelo para guardar estadísticas de gamificación del usuario."""

    xp: int = 0
    streak_days: int = 0
    last_activity_date: Optional[str] = None
    total_tasks_ever_completed: int = 0
    unlocked_achievements: List[str] = []


class PomodoroEstimateRequest(BaseModel):
    """Solicitud para estimar cuántos pomodoros tomará una tarea."""
    
    title: str
    course: str = ""
    notes: str = ""
    due_date: Optional[datetime] = None


class PomodoroEstimateResponse(BaseModel):
    """Respuesta con la estimación de pomodoros."""
    
    estimated_pomodoros: int
    confidence: float  # 0.0 - 1.0
    reasoning: str  # Explicación de la estimación
    suggestions: List[str] = Field(default_factory=list)  # Tips de productividad


class TimeEstimateResponse(BaseModel):
    """Respuesta con la estimación de tiempo en minutos para una tarea."""
    
    estimated_minutes: int
    confidence: float  # 0.0 - 1.0
    reasoning: str  # Explicación de la estimación
    suggestions: List[str] = Field(default_factory=list)  # Tips de productividad


class UserFeedback(BaseModel):
    """Modelo para enviar feedback/calificación de logros."""

    achievement_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


# ==================== SISTEMA IA DE GESTIÓN DE TIEMPO ====================

class AITimeManagementTool(str, Enum):
    """Las 3 herramientas de gestión de tiempo recomendadas por IA."""

    ADAPTIVE_LEARNING = "adaptive_learning"  # Ciclos adaptativos
    DEEP_FOCUS = "deep_focus"  # Sprints enfocados
    GOAL_TRACKING = "goal_tracking"  # Seguimiento de metas


class LearningStyle(str, Enum):
    """Estilos de aprendizaje detectados por el test."""

    VISUAL = "visual"
    AUDITORY = "auditory"
    KINESTHETIC = "kinesthetic"
    READING = "reading"
    MIXED = "mixed"


class Checkpoint(BaseModel):
    """Punto de verificación durante una sesión de estudio con IA."""

    id: str
    session_id: str
    checkpoint_number: int
    scheduled_time: datetime
    status: str = "pending"  # pending, completed, failed_verification, approved
    user_description: Optional[str] = None  # Descripción del usuario
    photo_url: Optional[str] = None  # URL de la foto en S3 o storage
    ai_feedback: Optional[str] = None  # Retroalimentación de Iris
    ai_verified: bool = False
    ai_confidence: float = 0.0  # 0-1, confianza de verificación
    completed_at: Optional[datetime] = None
    email_sent: bool = False
    user_email: Optional[str] = None


class AIStudySession(BaseModel):
    """Sesión de estudio usando herramientas de tiempo con IA."""

    id: str
    user_email: str
    task_id: int
    task_title: str
    tool_type: AITimeManagementTool
    checkpoints: List[Checkpoint] = Field(default_factory=list)
    started_at: datetime
    completed_at: Optional[datetime] = None
    performance_score: Optional[float] = None  # 0-100
    total_time_minutes: int = 0
    checkpoints_passed: int = 0
    last_checkpoint_completed: Optional[int] = None


class TestAnalysisResult(BaseModel):
    """Resultado del análisis del test de aprendizaje."""

    learning_style: LearningStyle
    focus_strength: int = Field(ge=0, le=100)  # 0-100
    consistency: int = Field(ge=0, le=100)  # 0-100
    distractibility: int = Field(ge=0, le=100)  # 0-100 (invers)
    preferred_session_length: str  # "short" (15-30), "medium" (30-60), "long" (60+)
    test_completed: bool = False
    timestamp: datetime = Field(default_factory=datetime.now)


class AIToolRecommendation(BaseModel):
    """Recomendación de herramienta de tiempo por IA."""

    tool_type: AITimeManagementTool
    confidence: float = Field(ge=0, le=1)  # 0-1
    reasoning: str  # Explicación de por qué se recomienda
    suggested_checkpoint_interval: int = 20  # Minutos
    estimated_session_length: int = 50  # Minutos
    user_email: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    test_result: Optional[TestAnalysisResult] = None


class CheckpointVerificationRequest(BaseModel):
    """Petición para verificar un checkpoint con evidencia."""

    checkpoint_id: str
    session_id: str
    user_description: str
    photo_base64: Optional[str] = None  # Foto codificada en base64
    photo_url: Optional[str] = None  # URL si ya está en storage
    user_email: str


class CheckpointVerificationResponse(BaseModel):
    """Respuesta de verificación de checkpoint por Iris."""

    checkpoint_id: str
    verified: bool
    confidence: float  # 0-1
    detected_elements: List[str] = Field(default_factory=list)  # Qué detectó la IA
    missing_elements: List[str] = Field(default_factory=list)  # Qué falta
    ai_feedback: str  # Retroalimentación de Iris
    suggestions_for_next: List[str] = Field(default_factory=list)  # Tips
    suggested_break_duration: int = 5  # Minutos de descanso
    performance_trend: str = "stable"  # improving, stable, declining


# ── Diario de Energía ──────────────────────────────────────────────────


class EnergyLevel(str, Enum):
    """Niveles de energía para el diario post-sesión."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class EnergyEntry(BaseModel):
    """Entrada del diario de energía registrada tras una sesión de estudio."""

    id: Optional[int] = None
    user_email: str
    energy_level: EnergyLevel
    mood: Optional[str] = None  # emoji o etiqueta del estado de ánimo
    notes: Optional[str] = None
    session_type: str = "pomodoro"  # pomodoro | free | crisis_recovery
    session_duration_minutes: int = 25
    created_at: Optional[datetime] = None


class EnergyEntryCreate(BaseModel):
    """Payload para crear una entrada de energía."""

    energy_level: EnergyLevel
    mood: Optional[str] = None
    notes: Optional[str] = None
    session_type: str = "pomodoro"
    session_duration_minutes: int = 25


# ── Modo Crisis ─────────────────────────────────────────────────────────


class CrisisSession(BaseModel):
    """Registro de una sesión del modo crisis / botón de pánico."""

    id: Optional[int] = None
    user_email: str
    trigger_reason: Optional[str] = None  # qué desencadenó la crisis
    breathing_completed: bool = False
    micro_tasks_generated: int = 0
    duration_seconds: int = 0  # cuánto duró la sesión de calma
    resolved: bool = False
    created_at: Optional[datetime] = None


class CrisisSessionCreate(BaseModel):
    """Payload para registrar el inicio/cierre de una sesión crisis."""

    trigger_reason: Optional[str] = None
    breathing_completed: bool = False
    micro_tasks_generated: int = 0
    duration_seconds: int = 0
    resolved: bool = False


class MicroTask(BaseModel):
    """Micro-tarea de 5 minutos generada por el modo crisis."""

    title: str
    estimated_minutes: int = 5
    original_task_id: Optional[int] = None
    original_task_title: Optional[str] = None




