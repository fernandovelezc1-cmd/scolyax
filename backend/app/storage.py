"""Storage module for Scolyax - Uses Supabase PostgreSQL.

This module delegates to supabase_storage.py for all database operations.
For JSON-based storage (legacy), see storage_json.py.
"""

from pathlib import Path

# Data directory for file-based storage (outbox, etc)
DATA_DIR = Path(__file__).parent / "data"

# Import all functions from supabase_storage
from .supabase_storage import (
    get_supabase,
    load_tasks,
    save_tasks,
    load_reminders,
    save_reminders,
    load_schedule,
    save_schedule,
    load_focus_sessions,
    load_focus_sessions_for_user,
    save_focus_sessions,
    load_stats,
    save_stats,
    compute_dashboard_stats,
    load_sessions,
    save_sessions,
    load_users,
    save_users,
    load_oauth_states,
    save_oauth_states,
    load_tokens,
    save_token_for_email,
    next_id,
    create_user_session,
    validate_session_token,
    get_session_by_email,
    invalidate_session,
    invalidate_all_sessions,
    generate_session_token,
    update_session_onboarding,
    increment_cache_hits,
    get_cache_hits,
)

__all__ = [
    "DATA_DIR",
    "get_supabase",
    "load_tasks",
    "save_tasks",
    "load_reminders",
    "save_reminders",
    "load_schedule",
    "save_schedule",
    "load_focus_sessions",
    "load_focus_sessions_for_user",
    "save_focus_sessions",
    "load_stats",
    "save_stats",
    "compute_dashboard_stats",
    "load_sessions",
    "save_sessions",
    "load_users",
    "save_users",
    "load_oauth_states",
    "save_oauth_states",
    "load_tokens",
    "save_token_for_email",
    "next_id",
    "create_user_session",
    "validate_session_token",
    "get_session_by_email",
    "invalidate_session",
    "invalidate_all_sessions",
    "generate_session_token",
    "update_session_onboarding",
    "increment_cache_hits",
    "get_cache_hits",
]
