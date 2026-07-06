"""Setup script to create Supabase tables via SQL editor."""

import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")

# Extract project ID from URL
project_id = SUPABASE_URL.split("//")[1].split(".")[0]

print("=" * 70)
print("SUPABASE TABLE CREATION GUIDE")
print("=" * 70)
print(f"\n✓ Project ID: {project_id}")
print(f"✓ SUPABASE_URL: {SUPABASE_URL}")
print("\nInstructions to create tables:")
print("-" * 70)
print("1. Go to your Supabase Dashboard")
print(f"   URL: {SUPABASE_URL}/project/{project_id}/sql/new")
print("\n2. Create a new SQL query and paste the schema from supabase_schema.sql")
print("\n3. Run the query")
print("\n4. After tables are created, run: python migrate_to_supabase.py")
print("=" * 70)

# Verify connection
try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Try to list tables (this will fail if not authenticated)
    result = supabase.table("users").select("*").limit(0).execute()
    print("\n✓ Successfully connected to Supabase!")
    print("✓ Tables are ready. You can now migrate data.")
    
except Exception as e:
    print(f"\n⚠ Could not verify connection: {e}")
    print("Make sure to run the SQL schema first!")

