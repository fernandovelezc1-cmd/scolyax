#!/usr/bin/env python
"""Script simple para ejecutar el backend sin problemas"""

import os
import sys

# Setup path
os.chdir(r"c:\Users\Fernando\Pictures\scolyax-mvp-main\backend")
sys.path.insert(0, r"c:\Users\Fernando\Pictures\scolyax-mvp-main\backend")

# Load env
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path('.') / '.env')

# Import and run
from app.main import app
import uvicorn

print("=" * 70)
print("🚀 Scolyax Backend Starting...")
print("=" * 70)
print(f"URL: http://127.0.0.1:8000")
print(f"Docs: http://127.0.0.1:8000/docs")
print("=" * 70)
print()

# Ejecutar directamente sin pasar por uvicorn.run()
if __name__ == "__main__":
    import asyncio
    
    config = uvicorn.Config(
        app=app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        reload=False
    )
    server = uvicorn.Server(config)
    
    # Ejecutar el servidor en el loop async
    try:
        # Usar asyncio sin salir
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(server.serve())
    except KeyboardInterrupt:
        print("\n👋 Backend detenido")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
