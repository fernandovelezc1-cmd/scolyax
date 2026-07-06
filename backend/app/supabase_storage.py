"""Supabase storage implementation for Scolyax.

This module replaces the JSON file storage with Supabase PostgreSQL.
It maintains the same interface as storage.py for backward compatibility.
"""

import logging
from datetime import datetime, time, timedelta, timezone
from typing import List, Optional
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from pathlib import Path

from .models import (
    AuthProvider,
    CrisisSession,
    DashboardStats,
    EnergyEntry,
    EnergyLevel,
    FocusSession,
    Reminder,
    ScheduleEntry,
    Session,
    Task,
    TaskStatus,
    User,
)

# Load .env from backend directory
env_path = Path(__file__).resolve().parents[1] / '.env'
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
OFFLINE_MODE = os.getenv("OFFLINE_MODE", "0").lower() in ("1", "true", "yes")

# Cache simple para sesiones (evita queries repetidas)
_sessions_cache = None
_sessions_cache_time = None
_CACHE_TTL_SECONDS = 60  # Cache válido por 60 segundos

# Cache para tokens de sesión (crítico para rendimiento)
_session_tokens_cache = {}  # {token: (session_data, cached_at)}
_session_last_activity_update = {}  # {token: last_db_write_time} para actualizar last_activity periódicamente
_SESSION_TOKEN_CACHE_TTL = 300  # 5 minutos
_LAST_ACTIVITY_UPDATE_INTERVAL = 60  # actualizar last_activity en DB cada 60s aunque el token esté cacheado

# Cache para usuarios
_users_cache = None
_users_cache_time = None

# Cache local para OAuth states (fallback si Supabase está lento)
_oauth_states_cache = {}  # {state: payload}
_oauth_states_cache_time = None
_OAUTH_STATES_CACHE_TTL = 30  # 30 segundos

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("SUPABASE_URL or SUPABASE_KEY not configured. Storage operations may fail.")

if OFFLINE_MODE:
    logger.warning("⚠️  OFFLINE_MODE enabled - Using in-memory storage only. Data will NOT persist!")

_supabase_client: Optional[Client] = None

def get_supabase() -> Client:
    """Get or create the Supabase client. Returns None in offline mode."""
    global _supabase_client
    
    if OFFLINE_MODE:
        return None
    
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be configured")
        try:
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            logger.error(f"❌ Failed to create Supabase client: {e}")
            return None
    return _supabase_client


# ==================== USERS ====================

def load_users() -> List[User]:
    """Recupera los usuarios registrados desde Supabase con cache."""
    global _users_cache, _users_cache_time
    
    # Verificar cache
    now = datetime.now(timezone.utc)
    if _users_cache is not None and _users_cache_time is not None:
        cache_age = (now - _users_cache_time).total_seconds()
        if cache_age < _CACHE_TTL_SECONDS:
            logger.debug(f"load_users() - usando cache (edad: {cache_age:.1f}s)")
            return _users_cache
    
    # En modo offline, retornar cache o vacío
    if OFFLINE_MODE or get_supabase() is None:
        if _users_cache is not None:
            logger.warning("🔌 Offline mode: Using cached users")
            return _users_cache
        logger.warning("🔌 Offline mode: No cached users available, returning empty list")
        return []
    
    try:
        supabase = get_supabase()
        logger.info("load_users() - cargando desde Supabase")
        response = supabase.table("users").select("*").execute()
        
        users: List[User] = []
        for item in response.data:
            provider = item.get("provider", AuthProvider.GOOGLE.value)
            if not isinstance(provider, AuthProvider):
                provider = AuthProvider(provider)
            
            created_at = item.get("created_at")
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            
            last_activity_date = item.get("last_activity_date")
            if isinstance(last_activity_date, str):
                last_activity_date = datetime.fromisoformat(last_activity_date)
            
            # Parse recommended_tools
            recommended_tools = item.get("recommended_tools", [])
            if isinstance(recommended_tools, str):
                import json
                try:
                    recommended_tools = json.loads(recommended_tools)
                except:
                    recommended_tools = []
            
            user = User(
                id=item["id"],
                email=item["email"],
                provider=provider,
                display_name=item["display_name"],
                created_at=created_at,
                streak_days=item.get("streak_days", 0),
                total_xp=item.get("total_xp", 0),
                level=item.get("level", 1),
                last_activity_date=last_activity_date,
                has_completed_onboarding=item.get("has_completed_onboarding", False),
                selected_tool=item.get("selected_tool"),
                recommended_tools=recommended_tools if isinstance(recommended_tools, list) else [],
            )
            users.append(user)
        
        # Actualizar cache
        _users_cache = users
        _users_cache_time = now
        
        return users
    except Exception as e:
        logger.error(f"Error loading users: {e}")
        # Fallback a cache expirado si existe
        if _users_cache is not None:
            logger.warning("Usando cache expirado debido a error")
            return _users_cache
        return []


def save_users(users: List[User]) -> None:
    """Persiste la lista de usuarios en Supabase e invalida cache."""
    global _users_cache, _users_cache_time
    
    try:
        supabase = get_supabase()
        
        for user in users:
            # Convertir recommended_tools a JSON si es lista
            import json
            recommended_tools = user.recommended_tools if hasattr(user, 'recommended_tools') else []
            if isinstance(recommended_tools, list):
                recommended_tools = json.dumps(recommended_tools)
            
            data = {
                "id": getattr(user, "id", None),
                "email": getattr(user, "email", ""),
                "display_name": getattr(user, "display_name", ""),
                "provider": user.provider.value if isinstance(user.provider, AuthProvider) else str(user.provider),
                "created_at": user.created_at.isoformat() if hasattr(user, "created_at") else datetime.utcnow().isoformat(),
                "streak_days": getattr(user, "streak_days", 0),
                "total_xp": getattr(user, "total_xp", 0),
                "level": getattr(user, "level", 1),
                "last_activity_date": user.last_activity_date.isoformat() if hasattr(user, "last_activity_date") and user.last_activity_date else None,
                "has_completed_onboarding": getattr(user, "has_completed_onboarding", False),
                "selected_tool": getattr(user, "selected_tool", None),
                "recommended_tools": recommended_tools,
            }
            
            # Upsert (insert or update)
            supabase.table("users").upsert(data).execute()
        
        # Invalidar cache
        _users_cache = None
        _users_cache_time = None
            
    except Exception as e:
        logger.error(f"Error saving users: {e}")
        # Invalidar cache en caso de error
        _users_cache = None
        _users_cache_time = None


# ==================== TASKS ====================

def load_tasks(user_email: Optional[str] = None) -> List[Task]:
    """Load tasks from Supabase; if user_email is provided filter by user."""
    try:
        supabase = get_supabase()
        
        if user_email:
            response = supabase.table("tasks").select("*").eq("user_email", user_email).execute()
        else:
            response = supabase.table("tasks").select("*").execute()
        
        tasks: List[Task] = []
        for item in response.data:
            due_date = item.get("due_date")
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date)
            
            last_worked_at = item.get("last_worked_at")
            if isinstance(last_worked_at, str):
                last_worked_at = datetime.fromisoformat(last_worked_at)
            
            task = Task(
                id=item["id"],
                title=item["title"],
                course=item["course"],
                due_date=due_date,
                status=TaskStatus(item.get("status", "pending")),
                notes=item.get("notes"),
                tags=item.get("tags", []),
                linked_schedule_ids=item.get("linked_schedule_ids", []),
                user_email=item.get("user_email"),
                estimated_pomodoros=item.get("estimated_pomodoros", 0),
                pomodoros_completed=item.get("pomodoros_completed", 0),
                time_spent_minutes=item.get("time_spent_minutes", 0),
                last_worked_at=last_worked_at,
            )
            tasks.append(task)
        
        return tasks
    except OSError as e:
        # Handle Windows socket errors gracefully
        logger.warning(f"Network error loading tasks (retrying): {e}")
        return []
    except Exception as e:
        logger.error(f"Error loading tasks: {e}")
        return []


def save_tasks(tasks: List[Task], user_email: Optional[str] = None) -> None:
    """Save tasks to Supabase. Replaces all tasks for a user with the new list."""
    try:
        supabase = get_supabase()
        email = user_email or "unknown@example.com"
        
        logger.info(f"💾 Saving {len(tasks)} tasks for user {email}")
        
        # Get current tasks in Supabase for this user
        current_response = supabase.table("tasks").select("*").eq("user_email", email).execute()
        current_ids = {item["id"] for item in current_response.data}
        
        # IDs that should remain
        new_ids = {task.id for task in tasks}
        
        # Delete tasks that are no longer in the list
        ids_to_delete = current_ids - new_ids
        if ids_to_delete:
            logger.info(f"🗑️ Deleting {len(ids_to_delete)} tasks: {ids_to_delete}")
            for task_id in ids_to_delete:
                result = supabase.table("tasks").delete().eq("id", task_id).eq("user_email", email).execute()
                logger.info(f"✅ Deleted task {task_id}: {result}")
        
        # Upsert remaining tasks
        for task in tasks:
            # Ensure user_email is never null
            task_user_email = getattr(task, "user_email", None) or user_email or "unknown@example.com"
            
            data = {
                "id": task.id,
                "user_email": task_user_email,
                "title": task.title,
                "course": task.course,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "status": task.status.value if isinstance(task.status, TaskStatus) else task.status,
                "notes": task.notes,
                "tags": task.tags,
                "linked_schedule_ids": task.linked_schedule_ids,
                "estimated_pomodoros": getattr(task, "estimated_pomodoros", 0),
                "pomodoros_completed": getattr(task, "pomodoros_completed", 0),
                "time_spent_minutes": getattr(task, "time_spent_minutes", 0),
                "last_worked_at": task.last_worked_at.isoformat() if getattr(task, "last_worked_at", None) else None,
            }
            supabase.table("tasks").upsert(data).execute()
        
        logger.info(f"✅ Successfully saved {len(tasks)} tasks for {email}")
            
    except Exception as e:
        logger.error(f"❌ Error saving tasks: {e}", exc_info=True)
        raise  # Re-raise para que el endpoint devuelva error al cliente


# ==================== REMINDERS ====================

def load_reminders(user_email: Optional[str] = None) -> List[Reminder]:
    """Load reminders from Supabase; if user_email is provided filter by user."""
    try:
        supabase = get_supabase()
        
        if user_email:
            response = supabase.table("reminders").select("*").eq("user_email", user_email).execute()
        else:
            response = supabase.table("reminders").select("*").execute()
        
        reminders: List[Reminder] = []
        for item in response.data:
            remind_at = item.get("remind_at")
            if isinstance(remind_at, str):
                remind_at = datetime.fromisoformat(remind_at)
            
            notified_at = item.get("notified_at")
            if isinstance(notified_at, str):
                notified_at = datetime.fromisoformat(notified_at)
            
            delivery_provider = item.get("delivery_provider", AuthProvider.GOOGLE.value)
            if not isinstance(delivery_provider, AuthProvider):
                delivery_provider = AuthProvider(delivery_provider)
            
            reminder = Reminder(
                id=item["id"],
                title=item["title"],
                description=item.get("description"),
                remind_at=remind_at,
                type=item.get("type", "task"),
                delivery_provider=delivery_provider,
                calendar_event_id=item.get("calendar_event_id"),
                notified_at=notified_at,
                user_email=item.get("user_email"),
            )
            reminders.append(reminder)
        
        return reminders
    except OSError as e:
        # Handle Windows socket errors gracefully
        logger.warning(f"Network error loading reminders (retrying): {e}")
        return []
    except Exception as e:
        logger.error(f"Error loading reminders: {e}")
        return []


def save_reminders(reminders: List[Reminder], user_email: Optional[str] = None) -> None:
    """Save reminders to Supabase. Replaces all reminders for a user with the new list."""
    try:
        supabase = get_supabase()
        email = user_email or "unknown@example.com"
        
        logger.info(f"💾 Saving {len(reminders)} reminders for user {email}")
        
        # Get current reminders in Supabase for this user
        current_response = supabase.table("reminders").select("*").eq("user_email", email).execute()
        current_ids = {item["id"] for item in current_response.data}
        
        # IDs that should remain
        new_ids = {reminder.id for reminder in reminders}
        
        # Delete reminders that are no longer in the list
        ids_to_delete = current_ids - new_ids
        if ids_to_delete:
            logger.info(f"🗑️ Deleting {len(ids_to_delete)} reminders: {ids_to_delete}")
            for reminder_id in ids_to_delete:
                result = supabase.table("reminders").delete().eq("id", reminder_id).eq("user_email", email).execute()
                logger.info(f"✅ Deleted reminder {reminder_id}: {result}")
        
        # Upsert remaining reminders
        for reminder in reminders:
            # Ensure user_email is never null
            reminder_user_email = (reminder.user_email or user_email) or "unknown@example.com"
            data = {
                "id": reminder.id,
                "user_email": reminder_user_email,
                "title": reminder.title,
                "description": reminder.description,
                "remind_at": reminder.remind_at.isoformat() if reminder.remind_at else None,
                "type": reminder.type,
                "delivery_provider": reminder.delivery_provider.value if isinstance(reminder.delivery_provider, AuthProvider) else reminder.delivery_provider,
                "calendar_event_id": reminder.calendar_event_id,
                "notified_at": reminder.notified_at.isoformat() if reminder.notified_at else None,
            }
            supabase.table("reminders").upsert(data).execute()
        
        logger.info(f"✅ Successfully saved {len(reminders)} reminders for {email}")
            
    except Exception as e:
        logger.error(f"❌ Error saving reminders: {e}", exc_info=True)
        raise  # Re-raise para que el endpoint devuelva error al cliente


# ==================== SCHEDULE ====================

def load_schedule(user_email: Optional[str] = None) -> List[ScheduleEntry]:
    """Obtiene los bloques del horario semanal desde Supabase."""
    try:
        supabase = get_supabase()
        
        # Filtrar por usuario si se proporciona email
        if user_email:
            response = supabase.table("schedule_entries").select("*").eq("user_email", user_email).execute()
        else:
            response = supabase.table("schedule_entries").select("*").execute()
        
        entries: List[ScheduleEntry] = []
        for item in response.data:
            start_time = item.get("start_time")
            end_time = item.get("end_time")
            
            if isinstance(start_time, str):
                start_time = time.fromisoformat(start_time)
            if isinstance(end_time, str):
                end_time = time.fromisoformat(end_time)
            
            entry = ScheduleEntry(
                id=item["id"],
                title=item["title"],
                day_of_week=item["day_of_week"],
                start_time=start_time,
                end_time=end_time,
                location=item.get("location"),
                description=item.get("description"),
            )
            entries.append(entry)
        
        return entries
    except Exception as e:
        logger.error(f"Error loading schedule: {e}")
        return []


def save_schedule(entries: List[ScheduleEntry], user_email: Optional[str] = None) -> None:
    """Guarda el horario semanal en Supabase."""
    try:
        supabase = get_supabase()
        
        # Use upsert to avoid duplicate key errors
        for entry in entries:
            # Ensure user_email is never null
            entry_user_email = (user_email or getattr(entry, "user_email", None)) or "unknown@example.com"
            data = {
                "id": entry.id,
                "user_email": entry_user_email,
                "title": entry.title,
                "day_of_week": entry.day_of_week,
                "start_time": entry.start_time.isoformat(),
                "end_time": entry.end_time.isoformat(),
                "location": entry.location,
                "description": entry.description,
            }
            supabase.table("schedule_entries").upsert(data).execute()
            
    except Exception as e:
        logger.error(f"Error saving schedule: {e}")


# ==================== FOCUS SESSIONS ====================

def load_focus_sessions() -> List[FocusSession]:
    """Carga el historial de sesiones de enfoque desde Supabase."""
    try:
        supabase = get_supabase()
        response = supabase.table("focus_sessions").select("*").execute()
        
        sessions = []
        for item in response.data:
            completed_at = item.get("completed_at")
            if isinstance(completed_at, str):
                completed_at = datetime.fromisoformat(completed_at)
            
            session = FocusSession(
                id=item["id"],
                topic=item["topic"],
                duration_minutes=item["duration_minutes"],
                completed_at=completed_at,
                user_email=item.get("user_email"),
            )
            sessions.append(session)
        
        return sessions
    except Exception as e:
        logger.error(f"Error loading focus sessions: {e}")
        return []


def load_focus_sessions_for_user(user_email: str) -> List[FocusSession]:
    """Carga el historial de sesiones de enfoque de un usuario específico desde Supabase."""
    try:
        supabase = get_supabase()
        response = supabase.table("focus_sessions").select("*").eq("user_email", user_email).execute()
        
        sessions = []
        for item in response.data:
            completed_at = item.get("completed_at")
            if isinstance(completed_at, str):
                completed_at = datetime.fromisoformat(completed_at)
            
            session = FocusSession(
                id=item["id"],
                topic=item["topic"],
                duration_minutes=item["duration_minutes"],
                completed_at=completed_at,
                user_email=item.get("user_email"),
            )
            sessions.append(session)
        
        return sessions
    except Exception as e:
        logger.error(f"Error loading focus sessions for user {user_email}: {e}")
        return []


def save_focus_sessions(sessions: List[FocusSession]) -> None:
    """Persiste las sesiones de enfoque en Supabase."""
    try:
        supabase = get_supabase()
        
        for session in sessions:
            data = {
                "id": session.id,
                "user_email": getattr(session, "user_email", "unknown@example.com"),
                "topic": session.topic,
                "duration_minutes": session.duration_minutes,
                "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            }
            supabase.table("focus_sessions").upsert(data).execute()
            
    except Exception as e:
        logger.error(f"Error saving focus sessions: {e}")


# ==================== STATS ====================

def load_stats() -> DashboardStats:
    """Obtiene los indicadores del tablero."""
    raw = {
        "tasks_completed": 0,
        "focus_hours": 0.0,
        "milestones_completed": 0,
        "upcoming_reminders": 0,
        "streak_days": 0,
    }
    return DashboardStats(**raw)


def save_stats(stats: DashboardStats) -> None:
    """Guarda los indicadores agregados del tablero."""
    # Stats are computed on-the-fly, no persistent storage needed
    pass


def compute_dashboard_stats(tasks: List[Task], reminders: List[Reminder], sessions: List[FocusSession]) -> DashboardStats:
    """Genera estadísticas combinando tareas, recordatorios y sesiones."""
    tasks_completed = sum(1 for task in tasks if task.status == TaskStatus.COMPLETED)
    focus_minutes = sum(session.duration_minutes for session in sessions)
    focus_hours = round(focus_minutes / 60, 1)
    now_utc = datetime.now(timezone.utc)
    upcoming_reminders = sum(
        1
        for reminder in reminders
        if reminder.remind_at.replace(tzinfo=timezone.utc) > now_utc
    )

    return DashboardStats(
        tasks_completed=tasks_completed,
        focus_hours=focus_hours,
        milestones_completed=0,
        upcoming_reminders=upcoming_reminders,
        streak_days=0,
    )


# ==================== SESSIONS ====================

def load_sessions() -> List[Session]:
    """Carga las sesiones desde Supabase con cache de 60 segundos."""
    global _sessions_cache, _sessions_cache_time
    
    # Verificar si el cache es válido
    now = datetime.now(timezone.utc)
    if _sessions_cache is not None and _sessions_cache_time is not None:
        cache_age = (now - _sessions_cache_time).total_seconds()
        if cache_age < _CACHE_TTL_SECONDS:
            logger.debug(f"load_sessions() - usando cache (edad: {cache_age:.1f}s)")
            return _sessions_cache
    
    try:
        supabase = get_supabase()
        logger.info("load_sessions() - cargando desde Supabase")
        response = supabase.table("sessions").select("*").execute()
        logger.info(f"load_sessions() - {len(response.data)} sesiones cargadas")
        
        sessions: List[Session] = []
        for item in response.data:
            provider = item.get("provider", AuthProvider.GOOGLE.value)
            if not isinstance(provider, AuthProvider):
                provider = AuthProvider(provider)
            
            session = Session(
                id=item["id"],
                email=item["email"],
                provider=provider,
                display_name=item["display_name"],
            )
            sessions.append(session)
        
        # Actualizar cache
        _sessions_cache = sessions
        _sessions_cache_time = now
        
        return sessions
    except Exception as e:
        logger.error(f"Error loading sessions: {e}")
        # Si hay cache anterior, usarlo aunque esté expirado
        if _sessions_cache is not None:
            logger.warning("Usando cache expirado debido a error")
            return _sessions_cache
        return []


def save_sessions(sessions: List[Session]) -> None:
    """Guarda las sesiones en Supabase e invalida el cache."""
    global _sessions_cache, _sessions_cache_time
    
    try:
        supabase = get_supabase()
        
        if not sessions:
            # If clearing sessions, we don't update the sessions table
            # Instead, invalidate tokens in user_sessions table
            logger.warning("Clearing sessions - user_sessions table handles token invalidation")
            # Invalidar cache
            _sessions_cache = None
            _sessions_cache_time = None
            return
        else:
            # Use upsert to save/update session data
            for session in sessions:
                data = {
                    "id": getattr(session, "id", None),
                    "email": getattr(session, "email", ""),
                    "provider": session.provider.value if isinstance(session.provider, AuthProvider) else str(session.provider),
                    "display_name": getattr(session, "display_name", ""),
                }
                supabase.table("sessions").upsert(data).execute()
            
            # Invalidar cache después de guardar
            _sessions_cache = None
            _sessions_cache_time = None
            
    except Exception as e:
        logger.error(f"Error saving sessions: {e}")
        # Invalidar cache en caso de error
        _sessions_cache = None
        _sessions_cache_time = None


# ==================== OAUTH STATES ====================

def load_oauth_states() -> dict:
    """Carga el mapa de estados OAuth desde cache local (rápido) con Supabase como respaldo."""
    global _oauth_states_cache, _oauth_states_cache_time
    
    # Usar cache local si está disponible y no ha expirado
    if _oauth_states_cache_time is not None:
        from datetime import datetime as dt
        if (dt.now() - _oauth_states_cache_time).total_seconds() < _OAUTH_STATES_CACHE_TTL:
            return _oauth_states_cache.copy()
    
    # Intentar cargar desde Supabase con timeout corto
    try:
        from datetime import datetime as dt, timedelta
        supabase = get_supabase()
        # No intentar cargar datos viejos - simplemente retornar cache local
        # porque el callback validará el state de todas formas
        return _oauth_states_cache.copy()
    except Exception as e:
        logger.debug(f"Could not sync oauth states from Supabase: {e}")
        return _oauth_states_cache.copy()


def save_oauth_states(states: dict) -> None:
    """Guarda el mapa de estados OAuth en cache local (rápido)."""
    global _oauth_states_cache, _oauth_states_cache_time
    from datetime import datetime as dt
    
    # Actualizar cache local inmediatamente (rápido y confiable)
    _oauth_states_cache = states.copy()
    _oauth_states_cache_time = dt.now()
    logger.debug(f"[OAUTH] {len(states)} states cached locally")
    
    # Intentar guardar en Supabase en background (sin bloquear)
    # pero no esperamos respuesta
    try:
        supabase = get_supabase()
        for state, data in states.items():
            # Convertir payload a formato simple para Supabase
            insert_data = {
                "state": state,
                "payload": str(data),  # Guardar como string JSON
                "created_at": dt.utcnow().isoformat(),
            }
            try:
                # Non-blocking: intentar pero no esperar
                supabase.table("oauth_states").upsert(insert_data).execute()
            except Exception as inner_e:
                logger.debug(f"Background: Failed to save state {state}: {inner_e}")
                # No importa - tenemos el cache local
                continue
    except Exception as e:
        logger.debug(f"Background: Could not save oauth states to Supabase: {e}")
        # No importa - el cache local es suficiente


# ==================== TOKENS ====================

def load_tokens() -> dict:
    """Devuelve el diccionario de tokens por email desde Supabase."""
    try:
        supabase = get_supabase()
        response = supabase.table("tokens").select("*").execute()
        
        tokens = {}
        for item in response.data:
            tokens[item["email"]] = {
                "access_token": item.get("access_token"),
                "refresh_token": item.get("refresh_token"),
                "token_type": item.get("token_type", "Bearer"),
                "expires_in": item.get("expires_in"),
                "expires_at": item.get("expires_at"),
                "scope": item.get("scope"),
            }
        
        return tokens
    except Exception as e:
        logger.error(f"Error loading tokens: {e}")
        return {}


def save_token_for_email(email: str, tokens: dict) -> None:
    """Almacena o actualiza los tokens para un email dado en Supabase."""
    try:
        supabase = get_supabase()
        
        data = {
            "email": email,
            "access_token": tokens.get("access_token", ""),
            "refresh_token": tokens.get("refresh_token"),
            "token_type": tokens.get("token_type", "Bearer"),
            "expires_in": tokens.get("expires_in"),
            "expires_at": tokens.get("expires_at"),
            "scope": tokens.get("scope"),
        }
        
        # Upsert (insert or update)
        supabase.table("tokens").upsert(data).execute()
        
    except Exception as e:
        logger.error(f"Error saving token for {email}: {e}")


# ==================== UTILITIES ====================

def next_id(items: List) -> int:
    """Calcula el próximo identificador incremental."""
    if not items:
        return 1
    return max(item.id for item in items) + 1


# ==================== USER SESSIONS ====================

import secrets

def generate_session_token() -> str:
    """Generates a secure random session token."""
    return secrets.token_urlsafe(32)


def create_user_session(email: str, user_agent: Optional[str] = None, ip_address: Optional[str] = None) -> str:
    """Creates a new session for a user and returns the session token."""
    try:
        supabase = get_supabase()
        session_token = generate_session_token()
        
        data = {
            "email": email,
            "session_token": session_token,
            "user_agent": user_agent,
            "ip_address": ip_address,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + __import__('datetime').timedelta(days=30)).isoformat(),
        }
        
        supabase.table("user_sessions").insert(data).execute()
        logger.info(f"Created session for {email}")
        return session_token
        
    except Exception as e:
        logger.error(f"Error creating session for {email}: {e}")
        raise


def validate_session_token(session_token: str) -> Optional[dict]:
    """Validates a session token with aggressive caching and returns session + user data."""
    global _session_tokens_cache, _session_last_activity_update
    
    # Check cache first
    now = datetime.now(timezone.utc)
    if session_token in _session_tokens_cache:
        cached_data, cached_time = _session_tokens_cache[session_token]
        cache_age = (now - cached_time).total_seconds()
        
        if cache_age < _SESSION_TOKEN_CACHE_TTL:
            logger.debug(f"✅ Token validated from cache (age: {cache_age:.1f}s)")
            # Actualizar last_activity en DB si han pasado más de 60s desde la última escritura
            last_written = _session_last_activity_update.get(session_token)
            seconds_since_write = (now - last_written).total_seconds() if last_written else 9999
            if seconds_since_write >= _LAST_ACTIVITY_UPDATE_INTERVAL:
                try:
                    get_supabase().table("user_sessions").update({
                        "last_activity": now.isoformat()
                    }).eq("session_token", session_token).execute()
                    _session_last_activity_update[session_token] = now
                except Exception:
                    pass
            return cached_data
        else:
            # Cache expired, remove it
            del _session_tokens_cache[session_token]
    
    # Retry logic for connection errors
    max_retries = 2
    retry_delay = 0.5  # seconds
    
    for attempt in range(max_retries):
        try:
            supabase = get_supabase()
            logger.info(f"🔍 Validating session token from DB: {session_token[:20]}... (attempt {attempt + 1}/{max_retries})")
            
            # Fetch session and check if it's valid
            response = supabase.table("user_sessions").select("*").eq(
                "session_token", session_token
            ).execute()
            
            if not response.data or len(response.data) == 0:
                logger.error(f"❌ Token not found in user_sessions table")
                return None
            
            session = response.data[0]
            
            # Check if session is active and not expired
            if not session.get("is_active"):
                logger.error(f"❌ Session is inactive")
                return None
            
            expires_at = datetime.fromisoformat(session.get("expires_at"))
            if now > expires_at:
                # Mark as inactive if expired
                logger.error(f"❌ Session expired")
                supabase.table("user_sessions").update({
                    "is_active": False
                    }).eq("session_token", session_token).execute()
                return None
            
            # Fetch user data in the same transaction (avoid second query in get_session)
            email = session.get("email")
            if email:
                try:
                    user_response = supabase.table("users").select("*").eq("email", email).execute()
                    if user_response.data:
                        # Agregar datos del usuario al session dict
                        session["user_data"] = user_response.data[0]
                except Exception as user_err:
                    logger.warning(f"Could not fetch user data: {user_err}")
            
            # Update last activity asynchronously (no need to wait)
            # Only update if more than 1 minute since last cache
            try:
                supabase.table("user_sessions").update({
                    "last_activity": now.isoformat()
                }).eq("session_token", session_token).execute()
            except Exception as e:
                logger.warning(f"Failed to update last_activity: {e}")
            
            # Cache the validated session (now includes user data)
            _session_tokens_cache[session_token] = (session, now)
            
            logger.info(f"✅ Session validated successfully and cached")
            return session
            
        except Exception as e:
            # Check if it's a connection error
            error_msg = str(e).lower()
            is_connection_error = any(x in error_msg for x in ['server disconnected', 'connection', 'timeout', 'network'])
            
            if is_connection_error and attempt < max_retries - 1:
                logger.warning(f"⚠️ Connection error on attempt {attempt + 1}/{max_retries}: {e}")
                import time
                time.sleep(retry_delay)
                continue
            else:
                logger.error(f"❌ Error validating session token: {e}")
                return None
    
    # If all retries failed
    return None


def cleanup_expired_token_cache():
    """Limpia tokens expirados del cache para evitar memory leaks."""
    global _session_tokens_cache, _session_last_activity_update
    
    now = datetime.now(timezone.utc)
    expired_tokens = []
    
    for token, (data, cached_time) in _session_tokens_cache.items():
        cache_age = (now - cached_time).total_seconds()
        if cache_age >= _SESSION_TOKEN_CACHE_TTL:
            expired_tokens.append(token)
    
    for token in expired_tokens:
        del _session_tokens_cache[token]
        _session_last_activity_update.pop(token, None)
    
    if expired_tokens:
        logger.info(f"Cleaned {len(expired_tokens)} expired tokens from cache")


def invalidate_token_cache(session_token: str = None):
    """Invalida el cache de tokens. Si no se especifica token, limpia todo."""
    global _session_tokens_cache, _session_last_activity_update
    
    if session_token:
        if session_token in _session_tokens_cache:
            del _session_tokens_cache[session_token]
            _session_last_activity_update.pop(session_token, None)
            logger.info(f"Token cache invalidated for: {session_token[:20]}...")
    else:
        _session_tokens_cache.clear()
        _session_last_activity_update.clear()
        logger.info("All token cache cleared")


def count_realtime_users() -> int:
    """Cuenta usuarios con actividad en los últimos 5 minutos.
    
    Usa primero el caché en memoria (más confiable) y luego la DB como complemento.
    """
    now = datetime.now(timezone.utc)
    # Resta 300 segundos (5 min) sin usar timedelta para evitar problemas de importación
    five_min_ago = datetime.fromtimestamp(now.timestamp() - 300, tz=timezone.utc)

    # Recopilar emails activos desde el caché de tokens (validados en los últimos 5 min)
    active_emails: set = set()
    for token, (session_data, cached_time) in list(_session_tokens_cache.items()):
        if (now - cached_time).total_seconds() < 300:
            email = session_data.get("email")
            if email:
                active_emails.add(email)

    # Complementar con la consulta a la DB
    try:
        sb = get_supabase()
        if sb:
            resp = sb.table("user_sessions").select("email").gte(
                "last_activity", five_min_ago.isoformat()
            ).eq("is_active", True).execute()
            for row in (resp.data or []):
                if row.get("email"):
                    active_emails.add(row["email"])
    except Exception as e:
        logger.warning(f"⚠️ No se pudo consultar user_sessions para realtime: {e}")

    return len(active_emails)


def increment_summaries_count() -> int:
    """Incrementa el contador global de resúmenes en system_metrics."""
    try:
        sb = get_supabase()
        if not sb:
            logger.warning("⚠️ increment_summaries_count: no hay cliente Supabase")
            return 0
        # Leer fila actual
        resp = sb.table("system_metrics").select("id,summaries_generated").limit(1).execute()
        rows = resp.data or []
        logger.warning(f"📊 system_metrics rows: {rows}")
        if rows:
            row = rows[0]
            new_count = (row.get("summaries_generated") or 0) + 1
            update_resp = sb.table("system_metrics").update(
                {"summaries_generated": new_count, "updated_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", row["id"]).execute()
            logger.warning(f"📊 summaries actualizado a {new_count}, resp: {update_resp.data}")
        else:
            new_count = 1
            insert_resp = sb.table("system_metrics").insert(
                {"summaries_generated": 1, "total_users": 0, "active_users_30d": 0,
                 "tasks_completed": 0, "retention_rate": 0, "avg_session_duration": 0}
            ).execute()
            logger.warning(f"📊 system_metrics fila creada, resp: {insert_resp.data}")
        return new_count
    except Exception as e:
        logger.warning(f"⚠️ No se pudo incrementar summaries_count en system_metrics: {e}")
        return 0


def get_summaries_count() -> int:
    """Lee el contador global de resúmenes desde system_metrics."""
    try:
        sb = get_supabase()
        if not sb:
            return 0
        rows = sb.table("system_metrics").select("summaries_generated").limit(1).execute().data or []
        if rows:
            return rows[0].get("summaries_generated") or 0
        return 0
    except Exception as e:
        logger.warning(f"⚠️ No se pudo leer summaries_count de system_metrics: {e}")
        return 0


def get_focus_sessions_count() -> int:
    """Cuenta todas las sesiones de enfoque del sistema."""
    try:
        sb = get_supabase()
        if not sb:
            return 0
        resp = sb.table("focus_sessions").select("id").execute()
        count = len(resp.data or [])
        logger.warning(f"📊 focus_sessions count: {count}")
        return count
    except Exception as e:
        logger.warning(f"⚠️ No se pudo contar focus_sessions: {e}")
        return 0


def increment_cache_hits() -> int:
    """Incrementa el contador acumulado de cache hits en system_metrics."""
    try:
        sb = get_supabase()
        if not sb:
            logger.error("❌ No se pudo conectar a Supabase")
            return 0
        
        # Obtener o crear el registro de system_metrics
        rows = sb.table("system_metrics").select("id,cache_hits").limit(1).execute().data or []
        
        if rows:
            row = rows[0]
            new_count = (row.get("cache_hits") or 0) + 1
            result = sb.table("system_metrics").update(
                {"cache_hits": new_count, "updated_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", row["id"]).execute()
            logger.info(f"✅ Cache hits actualizado a {new_count} en Supabase")
            return new_count
        else:
            # Si no hay registro, crear uno
            result = sb.table("system_metrics").insert(
                {"cache_hits": 1, "summaries_generated": 0, "total_users": 0,
                 "active_users_30d": 0, "tasks_completed": 0, "retention_rate": 0, "avg_session_duration": 0}
            ).execute()
            logger.info(f"✅ Registro de system_metrics creado con cache_hits=1")
            return 1
    except Exception as e:
        logger.error(f"❌ Error incrementando cache_hits: {e}", exc_info=True)
        return 0


def get_cache_hits() -> int:
    """Lee el contador acumulado de cache hits desde system_metrics."""
    try:
        sb = get_supabase()
        if not sb:
            logger.error("❌ No se pudo conectar a Supabase")
            return 0
        
        rows = sb.table("system_metrics").select("cache_hits").limit(1).execute().data or []
        
        if rows and len(rows) > 0:
            cache_hits = rows[0].get("cache_hits") or 0
            logger.info(f"📊 Cache hits leídos: {cache_hits}")
            return cache_hits
        
        # Si no hay registro, crear uno con valores por defecto
        logger.warning("⚠️ No hay registro en system_metrics, creando uno...")
        try:
            sb.table("system_metrics").insert(
                {"cache_hits": 0, "summaries_generated": 0, "total_users": 0,
                 "active_users_30d": 0, "tasks_completed": 0, "retention_rate": 0, "avg_session_duration": 0}
            ).execute()
            logger.info(f"✅ Registro de system_metrics creado (cache_hits=0)")
        except Exception as insert_err:
            logger.error(f"❌ Error creando registro inicial: {insert_err}")
        
        return 0
    except Exception as e:
        logger.error(f"❌ Error leyendo cache_hits: {e}", exc_info=True)
        return 0


def get_session_by_email(email: str) -> Optional[str]:
    """Gets the active session token for an email, if one exists."""
    try:
        supabase = get_supabase()
        
        response = supabase.table("user_sessions").select("session_token").eq(
            "email", email
        ).eq("is_active", True).gt(
            "expires_at", datetime.now(timezone.utc).isoformat()
        ).order("created_at", desc=True).limit(1).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0].get("session_token")
        return None
        
    except Exception as e:
        logger.error(f"Error getting session for {email}: {e}")
        return None


def invalidate_session(session_token: str) -> None:
    """Marks a session as inactive (logout) and clears cache."""
    try:
        supabase = get_supabase()
        supabase.table("user_sessions").update({
            "is_active": False
        }).eq("session_token", session_token).execute()
        logger.info(f"Invalidated session token")
        
        # Invalidar cache del token
        invalidate_token_cache(session_token)
        
    except Exception as e:
        logger.error(f"Error invalidating session: {e}")


def invalidate_all_sessions(email: str) -> None:
    """Marks all sessions for an email as inactive."""
    try:
        supabase = get_supabase()
        supabase.table("user_sessions").update({
            "is_active": False
        }).eq("email", email).execute()
        logger.info(f"Invalidated all sessions for {email}")
        
    except Exception as e:
        logger.error(f"Error invalidating sessions for {email}: {e}")


def update_session_onboarding(email: str, selected_tool: str, recommended_tools: list) -> None:
    """Updates the onboarding fields for a user's sessions."""
    try:
        supabase = get_supabase()
        
        # Convert recommended_tools to JSON string for storage
        import json
        recommended_tools_json = json.dumps(recommended_tools) if isinstance(recommended_tools, list) else recommended_tools
        
        logger.info(f"💾 Saving onboarding for {email}: tool={selected_tool}, recommended={recommended_tools}")
        
        # Update user record
        response = supabase.table("users").update({
            "has_completed_onboarding": True,
            "selected_tool": selected_tool,
            "recommended_tools": recommended_tools_json
        }).eq("email", email).execute()
        
        logger.info(f"✅ Updated onboarding for {email}: tool={selected_tool}")
        logger.info(f"   Response: {response}")
        
        # Invalidate cache for this user's sessions
        global _session_tokens_cache, _session_last_activity_update, _users_cache, _users_cache_time
        # Clear all tokens for this user to force refresh
        _session_tokens_cache.clear()
        _session_last_activity_update.clear()
        # Also invalidate users cache so it reloads
        _users_cache = None
        _users_cache_time = None
        
    except Exception as e:
        logger.error(f"❌ Error updating onboarding for {email}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


def save_user_stats(user_email: str, xp: int, streak_days: int, last_activity_date: Optional[str], 
                    total_tasks_ever_completed: int, unlocked_achievements: List[str]) -> None:
    """Guarda estadísticas de gamificación del usuario en la base de datos."""
    try:
        supabase = get_supabase()
        
        import json
        achievements_json = json.dumps(unlocked_achievements or [])
        
        logger.info(f"💾 Saving user stats for {user_email}:")
        logger.info(f"   XP: {xp}")
        logger.info(f"   Streak: {streak_days}")
        logger.info(f"   Total Tasks: {total_tasks_ever_completed}")
        logger.info(f"   🏆 Achievements ({len(unlocked_achievements or [])}): {unlocked_achievements}")
        
        data = {
            "user_email": user_email,
            "xp": xp,
            "streak_days": streak_days,
            "last_activity_date": last_activity_date,
            "total_tasks_ever_completed": total_tasks_ever_completed,
            "unlocked_achievements": achievements_json
        }
        
        # Primero intentar UPDATE
        try:
            response = supabase.table("user_stats").update(data).eq("user_email", user_email).execute()
            if response.data and len(response.data) > 0:
                # UPDATE exitoso
                logger.info(f"✅ User stats updated successfully for {user_email}")
                logger.info(f"   Response data count: {len(response.data)}")
                return
        except Exception as update_error:
            logger.warning(f"Update failed, will try insert: {update_error}")
        
        # Si UPDATE no funcionó, intentar INSERT
        try:
            response = supabase.table("user_stats").insert(data).execute()
            logger.info(f"✅ User stats inserted successfully for {user_email}")
            logger.info(f"   Response data count: {len(response.data)}")
        except Exception as insert_error:
            # Si INSERT también falla por duplicado, es que el UPDATE anterior funcionó
            if "duplicate" in str(insert_error).lower():
                logger.info(f"✅ User stats already exists (updated or skipped)")
            else:
                raise
        
    except Exception as e:
        logger.error(f"❌ Error saving user stats for {user_email}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        # No lanzar excepción para no bloquear el flujo


def load_user_stats(user_email: str) -> dict:
    """Carga estadísticas de gamificación del usuario desde la base de datos."""
    try:
        supabase = get_supabase()
        
        logger.info(f"🔄 Loading user stats for {user_email}...")
        response = supabase.table("user_stats").select("*").eq("user_email", user_email).execute()
        
        logger.info(f"   Response data count: {len(response.data)}")
        
        if response.data and len(response.data) > 0:
            stats = response.data[0]
            
            import json
            try:
                unlocked_achievements = json.loads(stats.get("unlocked_achievements", "[]"))
            except:
                unlocked_achievements = []
            
            logger.info(f"✅ User stats loaded for {user_email}:")
            logger.info(f"   XP: {stats.get('xp', 0)}")
            logger.info(f"   Streak: {stats.get('streak_days', 0)}")
            logger.info(f"   Total Tasks: {stats.get('total_tasks_ever_completed', 0)}")
            logger.info(f"   🏆 Achievements ({len(unlocked_achievements)}): {unlocked_achievements}")
            
            return {
                "xp": stats.get("xp", 0),
                "streak_days": stats.get("streak_days", 0),
                "last_activity_date": stats.get("last_activity_date"),
                "total_tasks_ever_completed": stats.get("total_tasks_ever_completed", 0),
                "unlocked_achievements": unlocked_achievements
            }
        else:
            logger.info(f"⚠️  No user stats found for {user_email}, returning defaults")
            return {
                "xp": 0,
                "streak_days": 0,
                "last_activity_date": None,
                "total_tasks_ever_completed": 0,
                "unlocked_achievements": []
            }
    except Exception as e:
        logger.error(f"❌ Error loading user stats for {user_email}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        # Retornar valores por defecto en caso de error
        return {
            "xp": 0,
            "streak_days": 0,
            "last_activity_date": None,
            "total_tasks_ever_completed": 0,
            "unlocked_achievements": []
        }


# ==================== USER FEEDBACK ====================

def save_user_feedback(user_email: str, user_name: Optional[str], achievement_id: str, 
                       rating: int, comment: str) -> None:
    """Guarda el feedback de calificación de un usuario en la base de datos.
    
    Los datos de feedback NUNCA se borran - son datos valiosos para reportes y análisis.
    """
    try:
        supabase = get_supabase()
        
        # Validar rating
        if not (1 <= rating <= 5):
            raise ValueError(f"Rating must be between 1 and 5, got {rating}")
        
        # Truncar comentario a 200 caracteres
        comment = (comment or "").strip()[:200]
        
        logger.info(f"💬 Saving user feedback for {user_email}:")
        logger.info(f"   Achievement: {achievement_id}")
        logger.info(f"   Rating: {rating}/5")
        logger.info(f"   Comment length: {len(comment)} chars")
        
        now = datetime.now(timezone.utc).isoformat()
        
        data = {
            "user_email": user_email,
            "user_name": user_name or "Anonymous",
            "achievement_id": achievement_id,
            "rating": rating,
            "comment": comment,
            "created_at": now,
            "updated_at": now
        }
        
        # Insert feedback (NUNCA se borra)
        response = supabase.table("user_feedback").insert(data).execute()
        logger.info(f"✅ User feedback saved successfully for {user_email}")
        logger.info(f"   ID: {response.data[0].get('id') if response.data else 'unknown'}")
        
    except Exception as e:
        logger.error(f"❌ Error saving user feedback for {user_email}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


def check_user_feedback_exists(user_email: str, achievement_id: str) -> bool:
    """Verifica si un usuario ya ha calificado un logro específico.
    
    Retorna True si ya existe feedback para este usuario + achievement combination.
    """
    try:
        supabase = get_supabase()
        
        response = supabase.table("user_feedback").select("id").eq(
            "user_email", user_email
        ).eq("achievement_id", achievement_id).execute()
        
        exists = len(response.data) > 0
        logger.info(f"📋 Check feedback exists for {user_email} + {achievement_id}: {exists}")
        
        return exists
        
    except Exception as e:
        logger.error(f"❌ Error checking user feedback: {e}")
        return False


def load_all_user_feedback() -> List[dict]:
    """Carga TODOS los feedback de usuarios para el panel administrativo.
    
    Los datos NUNCA se borran, por lo que este será un archivo histórico permanente.
    """
    try:
        supabase = get_supabase()
        
        logger.info(f"📊 Loading all user feedback from database...")
        
        # Ordenar por fecha descente para ver más recientes primero
        response = supabase.table("user_feedback").select(
            "id, user_email, user_name, achievement_id, rating, comment, created_at, updated_at"
        ).order("created_at", desc=True).execute()
        
        feedback_list = response.data or []
        logger.info(f"✅ Loaded {len(feedback_list)} feedback records")
        
        return feedback_list
        
    except Exception as e:
        logger.error(f"❌ Error loading all user feedback: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []


def get_feedback_stats() -> dict:
    """Calcula estadísticas agregadas del feedback para dashboard."""
    try:
        supabase = get_supabase()
        
        response = supabase.table("user_feedback").select(
            "rating, id"
        ).execute()
        
        feedback_list = response.data or []
        
        if not feedback_list:
            return {
                "total_feedback": 0,
                "average_rating": 0,
                "five_star_count": 0,
                "four_star_count": 0,
                "three_star_count": 0,
                "two_star_count": 0,
                "one_star_count": 0
            }
        
        ratings = [fb.get("rating", 0) for fb in feedback_list]
        
        return {
            "total_feedback": len(feedback_list),
            "average_rating": round(sum(ratings) / len(ratings), 1),
            "five_star_count": sum(1 for r in ratings if r == 5),
            "four_star_count": sum(1 for r in ratings if r == 4),
            "three_star_count": sum(1 for r in ratings if r == 3),
            "two_star_count": sum(1 for r in ratings if r == 2),
            "one_star_count": sum(1 for r in ratings if r == 1),
        }
        
    except Exception as e:
        logger.error(f"❌ Error calculating feedback stats: {e}")
        return {}


# ==================== ENERGY JOURNAL ====================


def load_energy_entries(user_email: str, limit: int = 30) -> List[EnergyEntry]:
    """Recupera las entradas de energía del usuario (últimas `limit` entradas)."""
    try:
        supabase = get_supabase()
        if supabase is None:
            return []

        response = (
            supabase.table("energy_entries")
            .select("*")
            .eq("user_email", user_email)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        entries = []
        for row in response.data or []:
            entries.append(
                EnergyEntry(
                    id=row.get("id"),
                    user_email=row.get("user_email", user_email),
                    energy_level=row.get("energy_level", "medium"),
                    mood=row.get("mood"),
                    notes=row.get("notes"),
                    session_type=row.get("session_type", "pomodoro"),
                    session_duration_minutes=row.get("session_duration_minutes", 25),
                    created_at=row.get("created_at"),
                )
            )
        return entries

    except Exception as e:
        logger.error(f"❌ Error loading energy entries for {user_email}: {e}")
        return []


def save_energy_entry(entry: EnergyEntry, user_email: str) -> Optional[EnergyEntry]:
    """Guarda una nueva entrada de energía en Supabase."""
    try:
        supabase = get_supabase()
        if supabase is None:
            return None

        data = {
            "user_email": user_email,
            "energy_level": entry.energy_level.value if isinstance(entry.energy_level, EnergyLevel) else entry.energy_level,
            "mood": entry.mood,
            "notes": entry.notes,
            "session_type": entry.session_type,
            "session_duration_minutes": entry.session_duration_minutes,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        response = supabase.table("energy_entries").insert(data).execute()

        if response.data:
            row = response.data[0]
            return EnergyEntry(
                id=row.get("id"),
                user_email=row.get("user_email"),
                energy_level=row.get("energy_level"),
                mood=row.get("mood"),
                notes=row.get("notes"),
                session_type=row.get("session_type"),
                session_duration_minutes=row.get("session_duration_minutes"),
                created_at=row.get("created_at"),
            )
        return None

    except Exception as e:
        logger.error(f"❌ Error saving energy entry for {user_email}: {e}")
        return None


# ==================== CRISIS MODE ====================


def load_crisis_sessions(user_email: str, limit: int = 20) -> List[CrisisSession]:
    """Recupera las sesiones de crisis del usuario."""
    try:
        supabase = get_supabase()
        if supabase is None:
            return []

        response = (
            supabase.table("crisis_sessions")
            .select("*")
            .eq("user_email", user_email)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        sessions = []
        for row in response.data or []:
            sessions.append(
                CrisisSession(
                    id=row.get("id"),
                    user_email=row.get("user_email", user_email),
                    trigger_reason=row.get("trigger_reason"),
                    breathing_completed=row.get("breathing_completed", False),
                    micro_tasks_generated=row.get("micro_tasks_generated", 0),
                    duration_seconds=row.get("duration_seconds", 0),
                    resolved=row.get("resolved", False),
                    created_at=row.get("created_at"),
                )
            )
        return sessions

    except Exception as e:
        logger.error(f"❌ Error loading crisis sessions for {user_email}: {e}")
        return []


def save_crisis_session(session: CrisisSession, user_email: str) -> Optional[CrisisSession]:
    """Guarda una sesión de crisis en Supabase."""
    try:
        supabase = get_supabase()
        if supabase is None:
            return None

        data = {
            "user_email": user_email,
            "trigger_reason": session.trigger_reason,
            "breathing_completed": session.breathing_completed,
            "micro_tasks_generated": session.micro_tasks_generated,
            "duration_seconds": session.duration_seconds,
            "resolved": session.resolved,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        response = supabase.table("crisis_sessions").insert(data).execute()

        if response.data:
            row = response.data[0]
            return CrisisSession(
                id=row.get("id"),
                user_email=row.get("user_email"),
                trigger_reason=row.get("trigger_reason"),
                breathing_completed=row.get("breathing_completed"),
                micro_tasks_generated=row.get("micro_tasks_generated"),
                duration_seconds=row.get("duration_seconds"),
                resolved=row.get("resolved"),
                created_at=row.get("created_at"),
            )
        return None

    except Exception as e:
        logger.error(f"❌ Error saving crisis session for {user_email}: {e}")
        return None