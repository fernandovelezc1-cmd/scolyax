#!/usr/bin/env python
"""Ejecutor directo sin supervisión - simplemente se queda corriendo"""

import sys
import os

# Cambiar al directorio backend
os.chdir(r"c:\Users\Fernando\Pictures\scolyax-mvp-main\backend")
sys.path.insert(0, r"c:\Users\Fernando\Pictures\scolyax-mvp-main\backend")

# Load environment
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path('.') / '.env')

# Importar y ejecutar
print("=" * 70)
print("🚀 Scolyax Backend Starting...")
print("=" * 70)
print(f"Python: {sys.executable}")
print(f"Path: {os.getcwd()}")
print(f"URL: http://127.0.0.1:8000")
print(f"Docs: http://127.0.0.1:8000/docs")
print("=" * 70)
print("")

from app.main import app
import uvicorn

# Ejecutar de forma blocking
uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
