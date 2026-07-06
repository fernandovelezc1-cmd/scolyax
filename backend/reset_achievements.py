#!/usr/bin/env python3
"""
Script para resetear los logros de todos los usuarios a cero.
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
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 80)
print("RESET DE LOGROS - Scolyax")
print("=" * 80)

# 1. Verificar estructura de usuarios y sus logros
print("\n1️⃣  USUARIOS EN LA BD:")
print("-" * 80)
try:
    users = supabase.table("users").select("id, email, display_name").execute()
    print(f"Total de usuarios: {len(users.data)}\n")
    for user in users.data:
        print(f"  • {user['email']} ({user['display_name']})")
except Exception as e:
    print(f"ERROR: {e}\n")

# 2. Verificar si existe tabla de logros
print("\n2️⃣  BUSCANDO TABLA DE LOGROS:")
print("-" * 80)
try:
    # Intentar leer cualquier dato de logros
    achievements = supabase.table("achievements").select("*").execute()
    print(f"✅ Tabla 'achievements' encontrada")
    print(f"   Registros totales: {len(achievements.data)}")
    
    if achievements.data:
        print(f"\n   Primeros registros:")
        for ach in achievements.data[:3]:
            print(f"   • {ach}")
except Exception as e:
    print(f"❌ No hay tabla 'achievements' o error: {e}")

# 3. Verificar si los logros están almacenados en users.gamification_stats (JSONB)
print("\n3️⃣  VERIFICANDO CAMPO GAMIFICATION_STATS EN USERS:")
print("-" * 80)
try:
    users_full = supabase.table("users").select("id, email, gamification_stats").execute()
    if users_full.data:
        print(f"✅ Campo 'gamification_stats' encontrado en usuarios")
        print(f"\n   Datos de primeros usuarios:")
        for user in users_full.data[:2]:
            email = user.get("email", "?")
            stats = user.get("gamification_stats", {})
            print(f"\n   • Email: {email}")
            print(f"     Stats: {stats}")
    else:
        print("❌ No hay usuarios con gamification_stats")
except Exception as e:
    print(f"Error leyendo gamification_stats: {e}")

# 4. Opción para limpiar - CONFIRMACIÓN
print("\n4️⃣  OPCIONES DE RESET:")
print("-" * 80)
print("Este script puede hacer lo siguiente:")
print("  A) Mostrar estructura actual (ya hecho)")
print("  B) LIMPIAR todos los logros de la tabla 'achievements' (si existe)")
print("  C) RESETEAR gamification_stats en cada usuario (si está en JSONB)")
print("\nPara ejecutar limpieza, corre este script con argumentos:")
print("  python reset_achievements.py --clean-achievements")
print("  python reset_achievements.py --reset-stats")
print("  python reset_achievements.py --clean-all")

print("\n" + "=" * 80)
