"""Execute SQL schema directly using Supabase Admin API."""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")

# Read the simplified SQL schema
with open("supabase_schema_simple.sql", "r") as f:
    sql_content = f.read()

# Split into individual statements (simple parsing)
statements = [s.strip() for s in sql_content.split(";") if s.strip()]

print("=" * 70)
print("EXECUTING SUPABASE SCHEMA")
print("=" * 70)
print(f"\n📍 Project: {SUPABASE_URL}")
print(f"📊 Statements to execute: {len(statements)}\n")

# The official Supabase SDK doesn't expose direct SQL execution for non-admin users
# We need to use the REST API with the service role key (not anon key)
# For now, we'll show instructions instead

print("⚠️  Direct SQL execution via API requires service_role key (admin access)")
print("\nTo create tables, follow these steps:")
print("-" * 70)
print("1. Go to: https://app.supabase.com")
print(f"2. Select your project: {SUPABASE_URL.split('//')[1].split('.')[0]}")
print("3. Go to SQL Editor (left sidebar)")
print("4. Click 'New Query'")
print("5. Paste the contents of: supabase_schema_simple.sql")
print("6. Click 'Run' button")
print("-" * 70)
print("\nThe SQL file contains these tables:")
print("  • users")
print("  • tasks")
print("  • reminders")
print("  • schedule_entries")
print("  • focus_sessions")
print("  • sessions")
print("  • oauth_states")
print("  • tokens")
print("\n" + "=" * 70)
print("After creating the tables, run: python migrate_to_supabase.py")
print("=" * 70)
