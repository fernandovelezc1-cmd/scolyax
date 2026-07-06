#!/usr/bin/env python
"""Wrapper simple para ejecutar FastAPI sin cerrar"""

import os
import sys
sys.path.insert(0, '.')

# Cargar variables de entorno
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path('.') / '.env')

# Importar y ejecutar
from app.main import app
import uvicorn

if __name__ == "__main__":
    config = uvicorn.Config(
        app=app,
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info",
        access_log=True
    )
    server = uvicorn.Server(config)
    # Ejecutar en el event loop actual
    import asyncio
    asyncio.run(server.serve())
