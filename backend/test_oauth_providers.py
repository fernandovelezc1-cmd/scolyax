#!/usr/bin/env python3
"""
Test de latencia a Google y Microsoft OAuth.
Ejecuta: python test_oauth_providers.py
"""

import asyncio
import time
import httpx

async def test_oauth_providers():
    """Test de latencia a proveedores OAuth."""
    
    print("=" * 80)
    print("🌐 TEST DE LATENCIA: Google y Microsoft OAuth")
    print("=" * 80)
    
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        
        # Test 1: Google
        print("\n1️⃣ Conectividad a Google OAuth")
        start = time.time()
        try:
            response = await client.head("https://accounts.google.com/o/oauth2/v2/auth")
            elapsed = time.time() - start
            print(f"   ⏱️ Latencia: {elapsed:.2f}s")
            print(f"   ✅ Status: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 2: Google Token Endpoint
        print("\n2️⃣ Conectividad a Google Token Endpoint")
        start = time.time()
        try:
            response = await client.head("https://oauth2.googleapis.com/token")
            elapsed = time.time() - start
            print(f"   ⏱️ Latencia: {elapsed:.2f}s")
            print(f"   ✅ Status: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 3: Google UserInfo Endpoint
        print("\n3️⃣ Conectividad a Google UserInfo Endpoint")
        start = time.time()
        try:
            response = await client.head("https://openidconnect.googleapis.com/v1/userinfo")
            elapsed = time.time() - start
            print(f"   ⏱️ Latencia: {elapsed:.2f}s")
            print(f"   ✅ Status: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 4: Microsoft
        print("\n4️⃣ Conectividad a Microsoft OAuth")
        start = time.time()
        try:
            response = await client.head("https://login.microsoftonline.com/common/oauth2/v2.0/authorize")
            elapsed = time.time() - start
            print(f"   ⏱️ Latencia: {elapsed:.2f}s")
            print(f"   ✅ Status: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 5: Microsoft Token Endpoint
        print("\n5️⃣ Conectividad a Microsoft Token Endpoint")
        start = time.time()
        try:
            response = await client.head("https://login.microsoftonline.com/common/oauth2/v2.0/token")
            elapsed = time.time() - start
            print(f"   ⏱️ Latencia: {elapsed:.2f}s")
            print(f"   ✅ Status: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 6: Microsoft Graph
        print("\n6️⃣ Conectividad a Microsoft Graph Endpoint")
        start = time.time()
        try:
            response = await client.head("https://graph.microsoft.com/v1.0/me")
            elapsed = time.time() - start
            print(f"   ⏱️ Latencia: {elapsed:.2f}s")
            print(f"   ✅ Status: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 80)
    print("📋 ANÁLISIS")
    print("=" * 80)
    print("""
    SI ALGÚN ENDPOINT TARDA >5 SEGUNDOS:
    ➡️ PROBLEMA: Conectividad lenta a Google/Microsoft
    ➡️ CAUSAS POSIBLES:
       - Ubicación geográfica (servidor en otra región)
       - ISP o VPN con latencia alta
       - Problema con DNS
    ➡️ SOLUCIONES:
       1. Verificar ubicación de servidor (debe estar en USA/Europa)
       2. Usar CDN (Cloudflare, AWS CloudFront)
       3. Aumentar timeout en oauth.py a 30s (temporal)
       4. Usar proxy con mejor latencia
    
    SI TODO ESTÁ RÁPIDO (<2s):
    ➡️ El delay NO está en Google/Microsoft
    ➡️ Buscar en otro lado (ver logs backend con timestamps)
    """)

if __name__ == "__main__":
    asyncio.run(test_oauth_providers())
