#!/usr/bin/env python
"""Script para debuguear el problema del backend"""

import sys
import os
import traceback
import logging

# Configurar logging al máximo
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

os.chdir(r"c:\Users\Fernando\Pictures\scolyax-mvp-main\backend")
sys.path.insert(0, r"c:\Users\Fernando\Pictures\scolyax-mvp-main\backend")

print("=" * 70)
print("DEBUG: Iniciando proceso de investigación del problema del backend")
print("=" * 70)
print()

# Step 1: Load environment
print("STEP 1: Cargando variables de entorno...")
try:
    from dotenv import load_dotenv
    from pathlib import Path
    load_dotenv(dotenv_path=Path('.') / '.env')
    print("✅ Variables de entorno cargadas")
except Exception as e:
    print(f"❌ Error cargando .env: {e}")
    traceback.print_exc()
    sys.exit(1)

print()

# Step 2: Import app module (this is where the issue might be)
print("STEP 2: Importando módulo app.main...")
try:
    import app.main
    print("✅ Módulo app.main importado exitosamente")
except Exception as e:
    print(f"❌ Error importando app.main: {e}")
    traceback.print_exc()
    sys.exit(1)

print()

# Step 3: Get the app
print("STEP 3: Obteniendo instancia de FastAPI...")
try:
    from app.main import app
    print("✅ Instancia de app obtenida")
except Exception as e:
    print(f"❌ Error obteniendo app: {e}")
    traceback.print_exc()
    sys.exit(1)

print()

# Step 4: Try to create uvicorn config
print("STEP 4: Creando configuración de Uvicorn...")
try:
    import uvicorn
    config = uvicorn.Config(
        app=app,
        host="127.0.0.1",
        port=8000,
        log_level="debug"
    )
    print("✅ Configuración de Uvicorn creada")
except Exception as e:
    print(f"❌ Error creando config: {e}")
    traceback.print_exc()
    sys.exit(1)

print()

# Step 5: Try to create server
print("STEP 5: Creando instancia de servidor...")
try:
    server = uvicorn.Server(config)
    print("✅ Servidor creado exitosamente")
except Exception as e:
    print(f"❌ Error creando servidor: {e}")
    traceback.print_exc()
    sys.exit(1)

print()

# Step 6: Run the server
print("STEP 6: Iniciando servidor...")
print("=" * 70)
print()

try:
    import asyncio
    asyncio.run(server.serve())
except KeyboardInterrupt:
    print("\n👋 Servidor detenido por usuario")
    sys.exit(0)
except Exception as e:
    print(f"❌ Error ejecutando servidor: {e}")
    traceback.print_exc()
    sys.exit(1)
