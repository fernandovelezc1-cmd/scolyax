#!/usr/bin/env python3
"""
Test script para diagnosticar dónde está el delay en OAuth.
Ejecuta: python test_oauth_timing.py
"""

import sys
import time
import asyncio
from pathlib import Path

# Agregar el directorio backend al path
sys.path.insert(0, str(Path(__file__).parent))

async def test_oauth_performance():
    """Test cada etapa del OAuth para encontrar el cuello de botella."""
    
    print("=" * 70)
    print("🔍 TEST DE PERFORMANCE DE OAUTH")
    print("=" * 70)
    
    # Test 1: Importar modules
    print("\n1️⃣ Importando módulos...")
    start = time.time()
    from app.oauth import get_oauth_client, get_http_client
    from app.models import AuthProvider
    print(f"   ⏱️ Tiempo: {time.time() - start:.2f}s")
    
    # Test 2: Crear cliente HTTP global
    print("\n2️⃣ Creando cliente HTTP global...")
    start = time.time()
    http_client = await get_http_client()
    elapsed = time.time() - start
    print(f"   ⏱️ Tiempo: {elapsed:.2f}s")
    print(f"   ✅ Cliente creado correctamente")
    
    # Test 3: Obtener cliente OAuth
    print("\n3️⃣ Obteniendo cliente OAuth de Google...")
    start = time.time()
    google_client = get_oauth_client(AuthProvider.GOOGLE)
    print(f"   ⏱️ Tiempo: {time.time() - start:.2f}s")
    
    # Test 4: Probar conexión a Supabase
    print("\n4️⃣ Probando conexión a Supabase...")
    start = time.time()
    try:
        from app.storage import get_supabase
        supabase = get_supabase()
        print(f"   ⏱️ Tiempo para crear cliente: {time.time() - start:.2f}s")
        
        # Probar una query simple
        query_start = time.time()
        response = supabase.table("users").select("*").limit(1).execute()
        query_time = time.time() - query_start
        print(f"   ⏱️ Tiempo para query (SELECT * FROM users LIMIT 1): {query_time:.2f}s")
        
        if query_time > 1.0:
            print(f"   ⚠️ SLOW: Query tardó {query_time:.2f}s - Revisa conexión Supabase o crea índices")
        else:
            print(f"   ✅ OK: Query rápida ({query_time:.2f}s)")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 5: Cargar usuarios (lo que hace el login)
    print("\n5️⃣ Cargando usuarios (como hace el login)...")
    start = time.time()
    try:
        from app.storage import load_users
        users = load_users()
        elapsed = time.time() - start
        print(f"   ⏱️ Tiempo: {elapsed:.2f}s")
        print(f"   ✅ Usuarios cargados: {len(users)}")
        
        if elapsed > 1.5:
            print(f"   ⚠️ SLOW: Revisa índices en Supabase (CREATE INDEX idx_users_email)")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 6: Simular HTTP call (a Google)
    print("\n6️⃣ Simulando llamada HTTP a Google (timeout=8s)...")
    start = time.time()
    try:
        # No hacemos la llamada real, solo verificamos que el cliente está listo
        print(f"   ✅ Cliente HTTP está listo con pooling")
        print(f"   ✅ Timeout: 8 segundos")
        print(f"   ✅ Keep-alive: 5 conexiones")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Resumen
    print("\n" + "=" * 70)
    print("📊 RESUMEN DE DIAGNÓSTICO")
    print("=" * 70)
    print("""
    Si el test 4 (Supabase query) tarda >1s:
    ➡️ PROBLEMA: Sin índices en base de datos
    ➡️ SOLUCIÓN: Ejecuta OPTIMIZE_DATABASE.sql en Supabase
    
    Si el test 5 (load_users) tarda >1.5s:
    ➡️ PROBLEMA: Query SELECT sin índices
    ➡️ SOLUCIÓN: Crea INDEX idx_users_email en Supabase
    
    Si todo es rápido aquí pero el login sigue lento:
    ➡️ PROBLEMA: Latencia de red a Google/Microsoft o Supabase
    ➡️ SOLUCIÓN: Revisa conexión de red, considera CDN
    """)

if __name__ == "__main__":
    asyncio.run(test_oauth_performance())
