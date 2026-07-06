"""JSON file storage for Scolyax.

This module handles persistent storage using JSON files in the data directory.
"""

import json
import logging
from datetime import datetime, time, timezone
from pathlib import Path
from typing import List, Optional
from .models import (
    AuthProvider,
    DashboardStats,
    FocusSession,
    Reminder,
    ScheduleEntry,
    Session,
    Task,
    TaskStatus,
    User,
)

logger = logging.getLogger(__name__)

# Developer-friendly defaults: use JSON files in backend/app/data/ so the app runs
# out-of-the-box in developer mode without requiring a DB. Tests may monkeypatch
# these constants to point to temporary files.
DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

TASKS_FILE = DATA_DIR / "tasks.json"
REMINDERS_FILE = DATA_DIR / "reminders.json"
SCHEDULE_FILE = DATA_DIR / "schedule.json"
FOCUS_FILE = DATA_DIR / "focus_sessions.json"
STATS_FILE = DATA_DIR / "stats.json"
SESSIONS_FILE = DATA_DIR / "sessions.json"
USERS_FILE = DATA_DIR / "users.json"
OAUTH_STATES_FILE = DATA_DIR / "oauth_states.json"
TOKENS_FILE = DATA_DIR / "tokens.json"


def _read_json(path, default=None):
    """Read JSON from a path-like object; return default if missing."""
    if path is None:
        return default
    p = Path(path)
    try:
        if not p.exists():
            return default
        with p.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return default


def _write_json(path, payload) -> None:
    if path is None:
        raise RuntimeError("No file path configured for JSON storage")
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)


def _ensure_attributes(model, payload: dict, fields: List[str]):
    """Helper function to ensure model has all required fields from payload."""
    for field in fields:
        if hasattr(model, field):
            continue
        if field in payload:
            setattr(model, field, payload[field])
    return model


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _model_dump(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()  # type: ignore[call-arg]
    if hasattr(model, "dict"):
        return model.dict()  # type: ignore[call-arg]
    return {key: getattr(model, key) for key in getattr(model, "__dict__", {})}


def load_tasks(user_email: Optional[str] = None) -> List[Task]:
    """Load tasks from JSON file; if user_email is provided filter by user."""
    raw = _read_json(TASKS_FILE, [])
    out: List[Task] = []
    for item in raw:
        # convert optional lists
        item.setdefault("tags", [])
        item.setdefault("linked_schedule_ids", [])
        if user_email is None or item.get("user_email") == user_email:
            out.append(Task(**item))
    return out


def save_tasks(tasks: List[Task], user_email: Optional[str] = None) -> None:
    """Save tasks to JSON file. If user_email is provided, only update tasks for that user."""
    if user_email is not None:
        # Keep tasks from other users
        existing = [t for t in load_tasks() if t.user_email != user_email]
        # Add the new/updated tasks for this user
        existing.extend(tasks)
        tasks = existing

    payload = []
    for task in tasks:
        task_data = _model_dump(task)
        if isinstance(task_data.get("due_date"), datetime):
            task_data["due_date"] = task_data["due_date"].isoformat()
        payload.append(task_data)
    _write_json(TASKS_FILE, payload)


def load_schedule() -> List[ScheduleEntry]:
    """Obtiene los bloques del horario semanal y sus horas en formato `time`."""
    raw = _read_json(SCHEDULE_FILE, [])
    entries: List[ScheduleEntry] = []
    for item in raw:
        item["start_time"] = time.fromisoformat(item["start_time"])
        item["end_time"] = time.fromisoformat(item["end_time"])
        entries.append(ScheduleEntry(**item))
    return entries


def save_schedule(entries: List[ScheduleEntry]) -> None:
    """Guarda el horario semanal convirtiendo las horas a texto ISO."""
    payload = []
    for entry in entries:
        data = _model_dump(entry)
        data["start_time"] = entry.start_time.isoformat()
        data["end_time"] = entry.end_time.isoformat()
        payload.append(data)
    _write_json(SCHEDULE_FILE, payload)


def load_reminders(user_email: Optional[str] = None) -> List[Reminder]:
    """Load reminders from JSON file; if user_email is provided filter by user."""
    raw = _read_json(REMINDERS_FILE, [])
    out: List[Reminder] = []
    for item in raw:
        item.setdefault("description", None)
        item.setdefault("calendar_event_id", None)
        item.setdefault("notified_at", None)
        item["remind_at"] = datetime.fromisoformat(item["remind_at"]) if isinstance(item.get("remind_at"), str) else item.get("remind_at")
        item["delivery_provider"] = AuthProvider(item.get("delivery_provider", AuthProvider.GOOGLE.value))
        if user_email is None or item.get("user_email") == user_email:
            out.append(Reminder(**item))
    return out


def save_reminders(reminders: List[Reminder], user_email: Optional[str] = None) -> None:
    """Save reminders to JSON file. If user_email is provided, only update reminders for that user."""
    if user_email is not None:
        # Keep reminders from other users
        existing = [r for r in load_reminders() if r.user_email != user_email]
        # Add the new/updated reminders for this user
        existing.extend(reminders)
        reminders = existing
    
    payload = []
    for reminder in reminders:
        data = _model_dump(reminder)
        # Convert datetime to isoformat for JSON
        if isinstance(data.get("remind_at"), datetime):
            data["remind_at"] = data["remind_at"].isoformat()
        if data.get("notified_at") and isinstance(data["notified_at"], datetime):
            data["notified_at"] = data["notified_at"].isoformat()
        if hasattr(reminder.delivery_provider, "value"):
            data["delivery_provider"] = reminder.delivery_provider.value
        payload.append(data)
    _write_json(REMINDERS_FILE, payload)


def load_focus_sessions() -> List[FocusSession]:
    """Carga el historial de sesiones de enfoque convertidas a `datetime`."""
    raw = _read_json(FOCUS_FILE, [])
    sessions = []
    for item in raw:
        item["completed_at"] = datetime.fromisoformat(item["completed_at"]) if isinstance(item.get("completed_at"), str) else item.get("completed_at")
        sessions.append(FocusSession(**item))
    return sessions


def save_focus_sessions(sessions: List[FocusSession]) -> None:
    """Persiste las sesiones de enfoque con sus marcas de tiempo en ISO."""
    payload = []
    for session in sessions:
        data = _model_dump(session)
        data["completed_at"] = session.completed_at.isoformat()
        payload.append(data)
    _write_json(FOCUS_FILE, payload)


def load_stats() -> DashboardStats:
    """Obtiene los indicadores del tablero o usa valores base si no existen."""
    raw = _read_json(
        STATS_FILE,
        {
            "tasks_completed": 0,
            "focus_hours": 0.0,
            "milestones_completed": 0,
            "upcoming_reminders": 0,
            "streak_days": 0,
        },
    )
    return DashboardStats(**raw)


def save_stats(stats: DashboardStats) -> None:
    """Guarda los indicadores agregados del tablero."""
    _write_json(STATS_FILE, _model_dump(stats))


def next_id(items: List) -> int:
    """Calcula el próximo identificador incremental."""
    if not items:
        return 1
    return max(item.id for item in items) + 1


def compute_dashboard_stats(tasks: List[Task], reminders: List[Reminder], sessions: List[FocusSession]) -> DashboardStats:
    """Genera estadísticas combinando tareas, recordatorios y sesiones."""
    tasks_completed = sum(1 for task in tasks if task.status == TaskStatus.COMPLETED)
    focus_minutes = sum(session.duration_minutes for session in sessions)
    focus_hours = round(focus_minutes / 60, 1)
    now_utc = datetime.now(timezone.utc)
    upcoming_reminders = sum(
        1
        for reminder in reminders
        if _ensure_utc(reminder.remind_at) > now_utc
    )

    base = load_stats()
    return DashboardStats(
        tasks_completed=tasks_completed,
        focus_hours=focus_hours,
        milestones_completed=base.milestones_completed,
        upcoming_reminders=upcoming_reminders,
        streak_days=base.streak_days,
    )


def load_sessions() -> List[Session]:
    """Carga las sesiones activas desde el almacenamiento."""
    raw = _read_json(SESSIONS_FILE, [])
    sessions: List[Session] = []
    for item in raw:
        provider_value = item.get("provider", AuthProvider.GOOGLE.value)
        if not isinstance(provider_value, AuthProvider):
            provider_value = AuthProvider(provider_value)
        item["provider"] = provider_value
        session = Session(**item)
        _ensure_attributes(session, item, ("id", "email", "provider", "display_name"))
        sessions.append(session)
    return sessions


def save_sessions(sessions: List[Session]) -> None:
    """Guarda las sesiones activas serializando el proveedor como texto."""
    payload = []
    for session in sessions:
        data = {"id": getattr(session, "id", None)}
        provider = session.provider
        if isinstance(provider, AuthProvider):
            data["provider"] = provider.value
        else:
            data["provider"] = str(provider)
        data["email"] = getattr(session, "email", "")
        data["display_name"] = getattr(session, "display_name", "")
        payload.append(data)
    _write_json(SESSIONS_FILE, payload)


def load_users() -> List[User]:
    """Recupera los usuarios registrados convirtiendo `created_at` a datetime."""
    raw = _read_json(USERS_FILE, [])
    users: List[User] = []
    for item in raw:
        item["created_at"] = datetime.fromisoformat(item["created_at"]) if isinstance(item.get("created_at"), str) else item.get("created_at")
        provider_value = item.get("provider", AuthProvider.GOOGLE.value)
        if not isinstance(provider_value, AuthProvider):
            provider_value = AuthProvider(provider_value)
        item["provider"] = provider_value
        user = User(**item)
        _ensure_attributes(
            user,
            item,
            ("id", "email", "provider", "display_name", "created_at"),
        )
        users.append(user)
    return users


def save_users(users: List[User]) -> None:
    """Persiste la lista de usuarios en disco."""
    payload = []
    for user in users:
        created_at = getattr(user, "created_at", None)
        provider = user.provider
        data = {
            "id": getattr(user, "id", None),
            "email": getattr(user, "email", ""),
            "display_name": getattr(user, "display_name", ""),
        }
        if created_at is not None:
            data["created_at"] = created_at.isoformat()
        if isinstance(provider, AuthProvider):
            data["provider"] = provider.value
        else:
            data["provider"] = str(provider)
        payload.append(data)
    _write_json(USERS_FILE, payload)


def load_oauth_states() -> dict:
    """Carga el mapa de estados OAuth (usado por `oauth.OAuthStateStore`)."""
    return _read_json(OAUTH_STATES_FILE, {})


def save_oauth_states(states: dict) -> None:
    """Guarda el mapa de estados OAuth en JSON."""
    _write_json(OAUTH_STATES_FILE, states)


def load_tokens() -> dict:
    """Devuelve el diccionario de tokens por email (access/refresh)."""
    return _read_json(TOKENS_FILE, {})


def save_token_for_email(email: str, tokens: dict) -> None:
    """Almacena o actualiza los tokens para un email dado."""
    all_tokens = _read_json(TOKENS_FILE, {})
    all_tokens[email] = tokens
    _write_json(TOKENS_FILE, all_tokens)


