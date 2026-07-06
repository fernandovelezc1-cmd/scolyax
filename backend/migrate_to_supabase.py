"""Migrate data from JSON files to Supabase."""

import json
import os
from datetime import datetime, time, timezone
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DATA_DIR = Path(__file__).resolve().parent / "app" / "data"

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def load_json(file_path):
    """Load JSON file safely."""
    if not Path(file_path).exists():
        return []
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def migrate_users():
    """Migrate users from JSON to Supabase."""
    print("\n📤 Migrating users...")
    users_data = load_json(DATA_DIR / "users.json")
    
    for user in users_data:
        try:
            # Upsert (insert or update) user
            response = supabase.table("users").upsert({
                "id": user.get("id"),
                "email": user["email"],
                "display_name": user["display_name"],
                "provider": user["provider"],
                "created_at": user.get("created_at", datetime.now(timezone.utc).isoformat()),
            }).execute()
            print(f"  ✓ User: {user['email']}")
        except Exception as e:
            print(f"  ✗ Error migrating user {user.get('email')}: {e}")

def migrate_tasks():
    """Migrate tasks from JSON to Supabase."""
    print("\n📤 Migrating tasks...")
    tasks_data = load_json(DATA_DIR / "tasks.json")
    
    for task in tasks_data:
        try:
            supabase.table("tasks").insert({
                "id": task.get("id"),
                "user_email": task.get("user_email", "unknown@example.com"),
                "title": task["title"],
                "course": task["course"],
                "due_date": task.get("due_date"),
                "status": task.get("status", "pending"),
                "notes": task.get("notes"),
                "tags": task.get("tags", []),
                "linked_schedule_ids": task.get("linked_schedule_ids", []),
            }).execute()
            print(f"  ✓ Task: {task['title']}")
        except Exception as e:
            print(f"  ✗ Error migrating task {task.get('title')}: {e}")

def migrate_reminders():
    """Migrate reminders from JSON to Supabase."""
    print("\n📤 Migrating reminders...")
    reminders_data = load_json(DATA_DIR / "reminders.json")
    
    for reminder in reminders_data:
        try:
            supabase.table("reminders").insert({
                "id": reminder.get("id"),
                "user_email": reminder.get("user_email", "unknown@example.com"),
                "title": reminder["title"],
                "description": reminder.get("description"),
                "remind_at": reminder.get("remind_at"),
                "type": reminder.get("type", "task"),
                "delivery_provider": reminder.get("delivery_provider", "google"),
                "calendar_event_id": reminder.get("calendar_event_id"),
                "notified_at": reminder.get("notified_at"),
            }).execute()
            print(f"  ✓ Reminder: {reminder['title']}")
        except Exception as e:
            print(f"  ✗ Error migrating reminder {reminder.get('title')}: {e}")

def migrate_focus_sessions():
    """Migrate focus sessions from JSON to Supabase."""
    print("\n📤 Migrating focus sessions...")
    sessions_data = load_json(DATA_DIR / "focus_sessions.json")
    
    for session in sessions_data:
        try:
            supabase.table("focus_sessions").insert({
                "id": session.get("id"),
                "user_email": session.get("user_email", "unknown@example.com"),
                "topic": session["topic"],
                "duration_minutes": session["duration_minutes"],
                "completed_at": session.get("completed_at"),
            }).execute()
            print(f"  ✓ Session: {session['topic']}")
        except Exception as e:
            print(f"  ✗ Error migrating session {session.get('topic')}: {e}")

def migrate_schedule():
    """Migrate schedule entries from JSON to Supabase."""
    print("\n📤 Migrating schedule entries...")
    schedule_data = load_json(DATA_DIR / "schedule.json")
    
    for entry in schedule_data:
        try:
            supabase.table("schedule_entries").insert({
                "id": entry.get("id"),
                "user_email": entry.get("user_email", "unknown@example.com"),
                "title": entry["title"],
                "day_of_week": entry["day_of_week"],
                "start_time": entry.get("start_time"),
                "end_time": entry.get("end_time"),
                "location": entry.get("location"),
                "description": entry.get("description"),
            }).execute()
            print(f"  ✓ Schedule: {entry['title']}")
        except Exception as e:
            print(f"  ✗ Error migrating schedule {entry.get('title')}: {e}")

def migrate_sessions():
    """Migrate active sessions from JSON to Supabase."""
    print("\n📤 Migrating active sessions...")
    sessions_data = load_json(DATA_DIR / "sessions.json")
    
    for session in sessions_data:
        try:
            supabase.table("sessions").insert({
                "id": session.get("id"),
                "email": session["email"],
                "provider": session["provider"],
                "display_name": session["display_name"],
            }).execute()
            print(f"  ✓ Session: {session['email']}")
        except Exception as e:
            print(f"  ✗ Error migrating session {session.get('email')}: {e}")

def migrate_tokens():
    """Migrate tokens from JSON to Supabase."""
    print("\n📤 Migrating tokens...")
    tokens_data = load_json(DATA_DIR / "tokens.json")
    
    for email, tokens in tokens_data.items():
        try:
            supabase.table("tokens").insert({
                "email": email,
                "access_token": tokens.get("access_token", ""),
                "refresh_token": tokens.get("refresh_token"),
                "token_type": tokens.get("token_type", "Bearer"),
                "expires_in": tokens.get("expires_in"),
                "expires_at": tokens.get("expires_at"),
                "scope": tokens.get("scope"),
            }).execute()
            print(f"  ✓ Token: {email}")
        except Exception as e:
            print(f"  ✗ Error migrating token for {email}: {e}")

if __name__ == "__main__":
    print("=" * 70)
    print("MIGRATING DATA TO SUPABASE")
    print("=" * 70)
    
    try:
        # Test connection
        supabase.table("users").select("*").limit(0).execute()
        print("✓ Connected to Supabase successfully!\n")
    except Exception as e:
        print(f"✗ Cannot connect to Supabase: {e}")
        print("Make sure to run the SQL schema first!")
        exit(1)
    
    # Migrate all data
    migrate_users()
    migrate_tasks()
    migrate_reminders()
    migrate_focus_sessions()
    migrate_schedule()
    migrate_sessions()
    migrate_tokens()
    
    print("\n" + "=" * 70)
    print("✓ Migration completed!")
    print("=" * 70)
