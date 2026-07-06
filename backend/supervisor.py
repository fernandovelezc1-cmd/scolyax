#!/usr/bin/env python
"""Supervisor que mantiene el backend ejecutándose"""

import sys
import subprocess
import time
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s'
)

logger = logging.getLogger(__name__)

PYTHON_EXE = r"C:\Users\Fernando\Pictures\scolyax-mvp-main\.venv\Scripts\python.exe"
BACKEND_DIR = r"c:\Users\Fernando\Pictures\scolyax-mvp-main\backend"

def run_backend():
    """Inicia el servidor backend"""
    logger.info("=" * 70)
    logger.info("Iniciando Scolyax Backend...")
    logger.info("=" * 70)
    logger.info(f"Python: {PYTHON_EXE}")
    logger.info(f"Dir: {BACKEND_DIR}")
    logger.info(f"URL: http://127.0.0.1:8000")
    logger.info(f"Docs: http://127.0.0.1:8000/docs")
    logger.info("=" * 70)
    logger.info("")
    
    cmd = [
        PYTHON_EXE,
        "-m", "uvicorn",
        "app.main:app",
        "--host", "127.0.0.1",
        "--port", "8000",
        "--log-level", "info"
    ]
    
    try:
        process = subprocess.Popen(
            cmd,
            cwd=BACKEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        # Mostrar output del proceso
        for line in process.stdout:
            logger.info(line.rstrip())
        
        # Si termina, retorna el código
        return_code = process.wait()
        logger.error(f"❌ Backend terminó con código: {return_code}")
        return False
        
    except KeyboardInterrupt:
        logger.info("👋 Backend detenido por usuario")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Error ejecutando backend: {e}")
        return False

def main():
    """Loop principal que mantiene el backend vivo"""
    attempt = 0
    max_attempts = 5
    
    while attempt < max_attempts:
        attempt += 1
        logger.info(f"\n🔄 Intento {attempt}/{max_attempts}")
        
        if run_backend():
            logger.info("✅ Backend ejecutándose correctamente")
            break
        else:
            if attempt < max_attempts:
                wait_time = min(5, attempt * 2)  # Esperar 2-5 segundos
                logger.warning(f"⏳ Reintentando en {wait_time} segundos...")
                time.sleep(wait_time)
            else:
                logger.error("❌ No se puede mantener el backend vivo después de varios intentos")
                sys.exit(1)

if __name__ == "__main__":
    main()
