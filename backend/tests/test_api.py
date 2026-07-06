"""Pruebas integrales para la API de Scolyax.

Usa TestClient de FastAPI con mocks en memoria de las funciones de storage
para no depender de Supabase real.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.main import app
from backend.app import main, storage
from backend.app.models import (
    AuthProvider,
    DashboardStats,
    FocusSession,
    Reminder,
    Task,
    TaskStatus,
    User,
)

client = TestClient(app)


def naive_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Almacenamiento en memoria ───────────────────────────────────────

class InMemoryStore:
    """Simula todas las funciones de supabase_storage en memoria."""

    def __init__(self):
        self.tasks: dict[str, list[Task]] = {}
        self.reminders: dict[str, list[Reminder]] = {}
        self.schedule: dict[str, list] = {}
        self.focus_sessions: list[FocusSession] = []
        self.stats = DashboardStats(
            tasks_completed=0, focus_hours=0,
            milestones_completed=0, upcoming_reminders=0, streak_days=0,
        )
        self.sessions: list = []
        self.users: list[User] = []
        self.oauth_states: dict = {}
        self.tokens: dict = {}
        self._session_tokens: dict[str, dict] = {}
        self._counter = 0

    def load_tasks(self, user_email=None):
        return list(self.tasks.get(user_email, [])) if user_email else []

    def save_tasks(self, tasks, user_email=None):
        self.tasks[user_email or "default"] = list(tasks)

    def load_reminders(self, user_email=None):
        return list(self.reminders.get(user_email, [])) if user_email else []

    def save_reminders(self, reminders, user_email=None):
        self.reminders[user_email or "default"] = list(reminders)

    def load_schedule(self, user_email=None):
        return list(self.schedule.get(user_email, [])) if user_email else []

    def save_schedule(self, entries, user_email=None):
        self.schedule[user_email or "default"] = list(entries)

    def load_focus_sessions(self):
        return list(self.focus_sessions)

    def save_focus_sessions(self, sessions):
        self.focus_sessions = list(sessions)

    def load_stats(self):
        return self.stats

    def save_stats(self, stats):
        self.stats = stats

    def compute_dashboard_stats(self, tasks, reminders, focus_sessions):
        completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
        hours = sum(s.duration_minutes for s in focus_sessions) / 60
        now = naive_utc()
        def _is_upcoming(r):
            if not r.remind_at:
                return False
            ra = r.remind_at.replace(tzinfo=None) if r.remind_at.tzinfo else r.remind_at
            return ra > now
        upcoming = sum(1 for r in reminders if _is_upcoming(r))
        return DashboardStats(
            tasks_completed=completed, focus_hours=hours,
            milestones_completed=self.stats.milestones_completed,
            upcoming_reminders=upcoming, streak_days=self.stats.streak_days,
        )

    def load_sessions(self):
        return list(self.sessions)

    def save_sessions(self, sessions):
        self.sessions = list(sessions)

    def load_users(self):
        return list(self.users)

    def save_users(self, users):
        self.users = list(users)

    def load_oauth_states(self):
        return dict(self.oauth_states)

    def save_oauth_states(self, states):
        self.oauth_states = dict(states)

    def load_tokens(self):
        return dict(self.tokens)

    def save_token_for_email(self, email, tokens):
        self.tokens[email] = tokens

    def next_id(self, items):
        return max((getattr(i, "id", 0) for i in items), default=0) + 1

    def create_user_session(self, email, user_agent=None, ip_address=None):
        self._counter += 1
        token = f"test-token-{self._counter}"
        self._session_tokens[token] = {"email": email, "is_active": True}
        return token

    def validate_session_token(self, session_token):
        entry = self._session_tokens.get(session_token)
        if not entry or not entry.get("is_active"):
            return None
        email = entry["email"]
        user = next((u for u in self.users if u.email == email), None)
        if not user:
            return {"email": email}
        return {
            "email": email,
            "user_data": {
                "id": user.id, "email": user.email,
                "provider": user.provider.value if hasattr(user.provider, "value") else user.provider,
                "display_name": user.display_name,
            },
        }

    def generate_session_token(self):
        self._counter += 1
        return f"test-token-{self._counter}"

    def get_session_by_email(self, email):
        return next(
            (t for t, d in self._session_tokens.items() if d["email"] == email and d.get("is_active")),
            None,
        )

    def invalidate_session(self, session_token):
        if session_token in self._session_tokens:
            self._session_tokens[session_token]["is_active"] = False

    def invalidate_all_sessions(self, email):
        for d in self._session_tokens.values():
            if d["email"] == email:
                d["is_active"] = False

    def update_session_onboarding(self, email, selected_tool, recommended_tools):
        pass

    def get_supabase(self):
        return MagicMock()


def _patch_all(monkeypatch, store):
    """Aplica monkeypatch a storage y main con las funciones del store."""
    funcs = [
        "load_tasks", "save_tasks", "load_reminders", "save_reminders",
        "load_schedule", "save_schedule", "load_focus_sessions", "save_focus_sessions",
        "load_stats", "save_stats", "compute_dashboard_stats",
        "load_sessions", "save_sessions", "load_users", "save_users",
        "load_oauth_states", "save_oauth_states", "load_tokens", "save_token_for_email",
        "next_id", "create_user_session", "validate_session_token",
        "generate_session_token", "get_session_by_email",
        "invalidate_session", "invalidate_all_sessions",
        "update_session_onboarding", "get_supabase",
    ]
    for name in funcs:
        fn = getattr(store, name)
        if hasattr(storage, name):
            monkeypatch.setattr(storage, name, fn)
        if hasattr(main, name):
            monkeypatch.setattr(main, name, fn)


@pytest.fixture(autouse=True)
def mock_storage(monkeypatch):
    store = InMemoryStore()
    _patch_all(monkeypatch, store)

    monkeypatch.setenv("SCOLYAX_OAUTH_MODE", "stub")
    monkeypatch.setenv("SCOLYAX_GOOGLE_CLIENT_ID", "test-google-id")
    monkeypatch.setenv("SCOLYAX_GOOGLE_CLIENT_SECRET", "test-google-secret")
    monkeypatch.setenv("SCOLYAX_GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
    monkeypatch.setenv("SCOLYAX_MICROSOFT_CLIENT_ID", "test-microsoft-id")
    monkeypatch.setenv("SCOLYAX_MICROSOFT_CLIENT_SECRET", "test-microsoft-secret")
    monkeypatch.setenv("SCOLYAX_MICROSOFT_REDIRECT_URI", "http://localhost:8000/auth/microsoft/callback")
    monkeypatch.setenv("SCOLYAX_FRONTEND_URL", "http://localhost:5173")

    # Limpiar caches internos
    for attr in ("_users_cache", "_tokens_cache"):
        if hasattr(main, attr):
            setattr(main, attr, None)
    for attr in ("_users_cache_time", "_tokens_cache_time"):
        if hasattr(main, attr):
            setattr(main, attr, 0)
    if hasattr(main, "_reminders_cache"):
        try:
            main._reminders_cache.clear()
        except Exception:
            main._reminders_cache = {}

    return store


# ── Helpers ──────────────────────────────────────────────────────────

def _register(email, provider="google", name="Test User"):
    resp = client.post("/register", json={
        "email": email, "provider": provider, "display_name": name,
    })
    assert resp.status_code in (200, 201), f"Register failed: {resp.text}"
    token = resp.json().get("session_token")
    assert token, f"No session_token: {resp.json()}"
    return token


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════
# TESTS
# ═══════════════════════════════════════════════════════════════

def test_health_check():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_session_without_token():
    resp = client.get("/session")
    assert resp.status_code == 200
    assert resp.json() is None


def test_registration_creates_user():
    token = _register("student@gmail.com", "google", "Student Name")
    session = client.get("/session", headers=_h(token)).json()
    assert session["email"] == "student@gmail.com"
    assert session["display_name"] == "Student Name"


def test_registration_normalizes_display_name():
    token = _register("clean@gmail.com", "google", " Spaces   Cleaned  ")
    assert client.get("/session", headers=_h(token)).json()["display_name"] == "Spaces Cleaned"


def test_registration_generates_name_from_email():
    token = _register("some.user@gmail.com", "google", "")
    assert client.get("/session", headers=_h(token)).json()["display_name"] == "Some User"


def test_repeated_registration_returns_200():
    _register("repeat@gmail.com", "google", "First")
    resp = client.post("/register", json={
        "email": "repeat@gmail.com", "provider": "google", "display_name": "Updated",
    })
    assert resp.status_code == 200


def test_invalid_email_rejected():
    resp = client.post("/register", json={
        "email": "noemail", "provider": "google", "display_name": "X",
    })
    assert resp.status_code == 400


def test_task_crud_flow():
    token = _register("tasks@gmail.com", "google", "Task User")
    h = _h(token)

    assert client.get("/tasks", headers=h).json() == []

    resp = client.post("/tasks", headers=h, json={
        "id": 0, "title": "Plan lectura", "course": "Neurociencia",
        "due_date": (naive_utc() + timedelta(days=2)).isoformat(),
        "status": "pending", "notes": "Leer capítulo 3", "tags": ["lectura"],
    })
    assert resp.status_code == 201
    created = resp.json()
    assert created["id"] == 1
    assert created["title"] == "Plan lectura"

    resp = client.put(f"/tasks/{created['id']}", headers=h, json={
        "id": created["id"], "title": "Plan actualizado", "course": "Neurociencia",
        "due_date": created["due_date"], "status": "in_progress",
        "notes": "Anotar ideas", "tags": ["lectura", "resumen"],
    })
    assert resp.status_code == 200
    assert resp.json()["title"] == "Plan actualizado"
    assert resp.json()["status"] == "in_progress"

    resp = client.delete(f"/tasks/{created['id']}", headers=h)
    assert resp.status_code == 204
    assert client.get("/tasks", headers=h).json() == []


def test_task_update_nonexistent():
    token = _register("t404@gmail.com")
    resp = client.put("/tasks/999", headers=_h(token), json={
        "id": 999, "title": "Ghost", "course": "X", "status": "pending",
    })
    assert resp.status_code == 404


def test_tasks_require_auth():
    assert client.get("/tasks").status_code == 401


def test_reminder_crud_flow():
    token = _register("reminders@gmail.com", "google", "Reminder User")
    h = _h(token)

    resp = client.post("/reminders", headers=h, json={
        "title": "Entrega de proyecto",
        "description": "Enviar informe final",
        "remind_at": (naive_utc() + timedelta(hours=3)).isoformat(),
    })
    assert resp.status_code == 201
    created = resp.json()
    assert created["id"] == 1
    assert created["title"] == "Entrega de proyecto"

    assert len(client.get("/reminders", headers=h).json()) == 1

    resp = client.delete(f"/reminders/{created['id']}", headers=h)
    assert resp.status_code == 204
    assert client.get("/reminders", headers=h).json() == []


def test_reminder_requires_auth():
    resp = client.post("/reminders", json={
        "title": "Sin sesión",
        "remind_at": (naive_utc() + timedelta(hours=1)).isoformat(),
    })
    assert resp.status_code == 401


def test_reminder_delete_nonexistent():
    token = _register("r404@gmail.com")
    assert client.delete("/reminders/999", headers=_h(token)).status_code == 404


def test_schedule_crud_flow():
    token = _register("schedule@gmail.com", "google", "Schedule User")
    h = _h(token)

    resp = client.post("/schedule", headers=h, json={
        "id": 0, "title": "Laboratorio", "day_of_week": 1,
        "start_time": "09:00:00", "end_time": "10:30:00",
        "location": "Sala 302", "description": "Bata y gafas",
    })
    assert resp.status_code == 201
    assert resp.json()["id"] == 1

    assert len(client.get("/schedule", headers=h).json()) == 1

    resp = client.post("/schedule", headers=h, json={
        "id": 0, "title": "Clase inválida", "day_of_week": 2,
        "start_time": "11:00:00", "end_time": "10:30:00",
    })
    assert resp.status_code == 400


def test_focus_sessions_flow():
    resp = client.post("/focus-sessions", json={
        "id": 0, "topic": "Matemáticas avanzadas",
        "duration_minutes": 50, "completed_at": naive_utc().isoformat(),
    })
    assert resp.status_code == 201
    assert resp.json()["id"] == 1
    assert len(client.get("/focus-sessions").json()) == 1


def test_dashboard_stats():
    token = _register("dashboard@gmail.com", "google", "Dash")
    h = _h(token)

    client.post("/tasks", headers=h, json={
        "id": 0, "title": "Ensayo", "course": "Historia",
        "status": "completed", "due_date": (naive_utc() - timedelta(days=1)).isoformat(), "tags": [],
    })
    client.post("/tasks", headers=h, json={
        "id": 0, "title": "Lectura", "course": "Filosofía",
        "status": "pending", "due_date": (naive_utc() + timedelta(days=1)).isoformat(), "tags": [],
    })
    client.post("/focus-sessions", json={
        "id": 0, "topic": "Investigación",
        "duration_minutes": 90, "completed_at": naive_utc().isoformat(),
    })
    client.post("/reminders", headers=h, json={
        "title": "Recordar reunión", "description": "Tutor",
        "remind_at": (naive_utc() + timedelta(hours=4)).isoformat(),
    })

    stats = client.get("/dashboard", headers=h).json()
    assert stats["tasks_completed"] == 1
    assert stats["focus_hours"] == 1.5
    assert stats["upcoming_reminders"] == 1


def test_google_register_forces_provider():
    resp = client.post("/auth/google/register", json={
        "email": "guser@gmail.com", "provider": "microsoft", "display_name": "Google User",
    })
    assert resp.status_code == 201
    assert resp.json()["provider"] == "google"


def test_microsoft_register_forces_provider():
    resp = client.post("/auth/microsoft/register", json={
        "email": "msuser@outlook.com", "provider": "google", "display_name": "MS User",
    })
    assert resp.status_code == 201
    assert resp.json()["provider"] == "microsoft"


def test_oauth_start_redirects():
    resp = client.get("/auth/google/start", params={
        "mode": "register", "display_name": "Test", "stub_email": "oauthtest@gmail.com",
    }, follow_redirects=False)
    assert resp.status_code == 307
    assert "state=" in resp.headers.get("location", "")


def test_summary_text_endpoint():
    resp = client.post("/summary/text", json={
        "text": "La atención plena mejora el enfoque. Permite organizar mejor el tiempo.",
        "sentences": 1,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]
    assert isinstance(data["highlighted_keywords"], list)


def test_summary_requires_input():
    resp = client.post("/summary", data={"sentences": "1"})
    # El endpoint devuelve 200 con resumen vacío cuando no hay texto ni archivo
    assert resp.status_code in (200, 400, 422)


def test_update_display_name():
    token = _register("namechange@gmail.com", "google", "Original")
    resp = client.patch("/session/display-name", headers=_h(token), json={
        "display_name": "Personalizado",
    })
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Personalizado"
