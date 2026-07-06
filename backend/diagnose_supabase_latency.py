#!/usr/bin/env python3
"""
Diagnóstico avanzado de latencia Supabase.
Ejecuta: python diagnose_supabase_latency.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

def test_supabase_latency():
    """Test detallado de latencia a Supabase."""
    
    print("=" * 80)
    print("🔍 DIAGNÓSTICO DE LATENCIA SUPABASE")
    print("=" * 80)
    
    from app.storage import get_supabase
    
    supabase = get_supabase()
    
    # Test 1: Query simple SELECT
    print("\n1️⃣ Query: SELECT * FROM users (sin LIMIT)")
    start = time.time()
    try:
        response = supabase.table("users").select("*").execute()
        elapsed = time.time() - start
        print(f"   ⏱️ Tiempo: {elapsed:.2f}s")
        print(f"   📊 Registros: {len(response.data)}")
        if elapsed > 2:
            print(f"   ⚠️ MUY LENTO - Sin índices o problema de conexión")
        elif elapsed > 1:
            print(f"   🟡 LENTO - Los índices no están siendo usados")
        else:
            print(f"   ✅ RÁPIDO - Índices funcionando")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 2: Query con LIMIT (como hace load_users en caché)
    print("\n2️⃣ Query: SELECT * FROM users LIMIT 1")
    start = time.time()
    try:
        response = supabase.table("users").select("*").limit(1).execute()
        elapsed = time.time() - start
        print(f"   ⏱️ Tiempo: {elapsed:.2f}s")
        if elapsed > 2:
            print(f"   ⚠️ MUY LENTO")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: Query con filtro por email (usa índice)
    print("\n3️⃣ Query: SELECT * FROM users WHERE email = '...' (usa idx_users_email)")
    test_email = "test@example.com"
    start = time.time()
    try:
        response = supabase.table("users").select("*").eq("email", test_email).execute()
        elapsed = time.time() - start
        print(f"   ⏱️ Tiempo: {elapsed:.2f}s")
        if elapsed > 2:
            print(f"   ⚠️ ÍNDICE NO ESTÁ SIENDO USADO")
        else:
            print(f"   ✅ ÍNDICE FUNCIONANDO")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 4: Insert (crea sesión)
    print("\n4️⃣ Query: INSERT INTO user_sessions")
    start = time.time()
    try:
        import secrets
        from datetime import datetime, timezone, timedelta
        
        token = secrets.token_urlsafe(32)
        data = {
            "email": "test@example.com",
            "session_token": token,
            "user_agent": "test",
            "ip_address": "127.0.0.1",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        }
        
        response = supabase.table("user_sessions").insert(data).execute()
        elapsed = time.time() - start
        print(f"   ⏱️ Tiempo: {elapsed:.2f}s")
        
        # Limpiar
        supabase.table("user_sessions").delete().eq("session_token", token).execute()
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 5: Validar índices
    print("\n5️⃣ Validar que los índices existen en Supabase")
    print("   Ejecuta en Supabase SQL Editor:")
    print("""
    SELECT indexname FROM pg_indexes 
    WHERE tablename IN ('users', 'user_sessions')
    ORDER BY tablename, indexname;
    """)
    
    print("\n" + "=" * 80)
    print("📋 ANÁLISIS")
    print("=" * 80)
    print("""
    SI TODO TARDA >2 SEGUNDOS:
    ➡️ PROBLEMA: Conexión muy lenta a Supabase
    ➡️ CAUSAS POSIBLES:
       - Supabase en otra región (latencia de red)
       - Base de datos sin connection pooling
       - Queries sin índices
    ➡️ SOLUCIONES:
       1. Verificar región de Supabase
       2. Crear índices (ya hecho)
       3. Usar connection pooling en Supabase
       4. Cambiar a provider local (ej: Vercel PostgreSQL)
    
    SI EL TEST 3 (con índice) TARDA >1s:
    ➡️ Los índices NO están siendo usados
    ➡️ Solución: Ejecutar REINDEX en Supabase
    """)

if __name__ == "__main__":
    test_supabase_latency()
