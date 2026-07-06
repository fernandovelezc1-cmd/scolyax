#!/usr/bin/env python3
"""Test connectivity and backend functionality"""
import sys
import os
import time

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

print("1. Testing environment variables...")
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    print(f"   ✅ SUPABASE_URL: {SUPABASE_URL[:30]}...")
    print(f"   ✅ SUPABASE_KEY: {SUPABASE_KEY[:30]}...")
else:
    print(f"   ❌ Missing Supabase credentials")
    sys.exit(1)

print("\n2. Testing Supabase import...")
try:
    from supabase import create_client
    print("   ✅ Supabase client imported")
except Exception as e:
    print(f"   ❌ Failed to import: {e}")
    sys.exit(1)

print("\n3. Connecting to Supabase...")
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("   ✅ Supabase client created")
except Exception as e:
    print(f"   ❌ Failed to create client: {e}")
    sys.exit(1)

print("\n4. Testing tasks table query...")
try:
    result = supabase.table("tasks").select("COUNT(*)").execute()
    print(f"   ✅ Tasks table accessible: {result}")
except Exception as e:
    print(f"   ❌ Failed to query tasks: {e}")
    sys.exit(1)

print("\n✅ All diagnostics passed!")
