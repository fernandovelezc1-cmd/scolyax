#!/usr/bin/env python
"""Wrapper para ejecutar el servidor FastAPI (producción)"""

import sys
import logging
import uvicorn

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    try:
        print("=" * 60)
        print("Inicializando Scolyax Backend...")
        print("=" * 60)
        
        from app.main import app
        print("✅ Aplicación cargada exitosamente")
        print("")
        
        print("Iniciando servidor Uvicorn (producción - sin reload)...")
        print(f"URL: http://127.0.0.1:8000")
        print(f"Swagger: http://127.0.0.1:8000/docs")
        print("")
        print("=" * 60)
        print("")
        
        # Ejecutar con uvicorn - modo producción sin reload
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=8000,
            reload=False,  # Sin reload en producción
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n\n👋 Servidor detenido por usuario")
        sys.exit(0)
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
