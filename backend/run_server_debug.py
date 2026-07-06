#!/usr/bin/env python
"""Wrapper para ejecutar el servidor FastAPI sin reload"""

import sys
import logging
import uvicorn

# Configurar logging más verbose
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    try:
        print("Inicializando aplicación...")
        from app.main import app
        print("Aplicación cargada exitosamente")
        
        print("Iniciando servidor Uvicorn...")
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=8000,
            reload=False,
            log_level="debug"
        )
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
