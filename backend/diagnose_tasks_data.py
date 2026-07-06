#!/usr/bin/env python3
"""
Diagnostica el estado de las tareas en la BD para encontrar datos compartidos entre usuarios.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL o SUPABASE_KEY no configuradas")
    print(f"SUPABASE_URL: {SUPABASE_URL}")
    print(f"SUPABASE_KEY: {SUPABASE_KEY}")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 80)
print("DIAGNÓSTICO DE TAREAS EN LA BD")
print("=" * 80)

# 1. Obtener TODAS las tareas (sin filtro)
print("\n1️⃣  TODAS LAS TAREAS EN LA BD (sin filtro):")
print("-" * 80)
try:
    all_tasks = supabase.table("tasks").select("*").execute()
    print(f"Total de tareas: {len(all_tasks.data)}\n")
    
    for task in all_tasks.data:
        user_email = task.get("user_email", "❌ NULL/MISSING")
        task_id = task.get("id", "?")
        title = task.get("title", "?")
        status = task.get("status", "?")
        print(f"  • ID: {task_id} | Título: '{title}' | Estado: {status}")
        print(f"    User Email: {user_email}")
        print()
except Exception as e:
    print(f"ERROR: {e}\n")

# 2. Tareas agrupadas por user_email
print("\n2️⃣  TAREAS AGRUPADAS POR USER_EMAIL:")
print("-" * 80)
try:
    all_tasks = supabase.table("tasks").select("*").execute()
    
    email_map = {}
    for task in all_tasks.data:
        email = task.get("user_email") or "NULL/MISSING"
        if email not in email_map:
            email_map[email] = []
        email_map[email].append(task)
    
    for email, tasks in sorted(email_map.items()):
        print(f"\n👤 {email}: {len(tasks)} tareas")
        for task in tasks:
            task_id = task.get("id")
            title = task.get("title")
            status = task.get("status")
            print(f"   - ID {task_id}: {title} ({status})")
except Exception as e:
    print(f"ERROR: {e}\n")

# 3. Usuarios en la BD
print("\n3️⃣  USUARIOS EN LA BD:")
print("-" * 80)
try:
    users = supabase.table("users").select("id, email, display_name, created_at").execute()
    print(f"Total de usuarios: {len(users.data)}\n")
    for user in users.data:
        email = user.get("email", "?")
        name = user.get("display_name", "?")
        created = user.get("created_at", "?")
        print(f"  • Email: {email}")
        print(f"    Name: {name}")
        print(f"    Created: {created}\n")
except Exception as e:
    print(f"ERROR: {e}\n")

# 4. Tareas SIN user_email (huérfanas)
print("\n4️⃣  TAREAS SIN USER_EMAIL (PROBLEMA):")
print("-" * 80)
try:
    orphan_tasks = supabase.table("tasks").select("*").is_("user_email", None).execute()
    print(f"Tareas huérfanas: {len(orphan_tasks.data)}\n")
    for task in orphan_tasks.data:
        print(f"  • ID: {task.get('id')} | Título: {task.get('title')}")
except Exception as e:
    print(f"ERROR: {e}\n")

# 5. Verificar si el filtro by user_email funciona
print("\n5️⃣  VERIFICAR FILTRO BY USER_EMAIL:")
print("-" * 80)
try:
    users = supabase.table("users").select("email").execute()
    user_emails = [u["email"] for u in users.data]
    
    for email in user_emails[:3]:  # Solo primeros 3 usuarios
        tasks_for_user = supabase.table("tasks").select("*").eq("user_email", email).execute()
        print(f"  Tareas de {email}: {len(tasks_for_user.data)} tareas")
        for task in tasks_for_user.data[:2]:  # Solo primeras 2
            print(f"    - {task.get('title')} ({task.get('id')})")
except Exception as e:
    print(f"ERROR: {e}\n")

print("\n" + "=" * 80)
print("FIN DEL DIAGNÓSTICO")
print("=" * 80)
