"""
Script para aplicar la migración de onboarding a Supabase.
Agrega las columnas necesarias para el sistema de test cognitivo.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

from app.supabase_storage import get_supabase

def apply_onboarding_migration():
    """Aplica la migración para agregar columnas de onboarding."""
    
    print("🔄 Aplicando migración de onboarding...")
    
    try:
        supabase = get_supabase()
        
        # Leer el archivo SQL
        sql_path = Path(__file__).parent / 'add_onboarding_columns.sql'
        with open(sql_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        print(f"📄 Leyendo SQL desde: {sql_path}")
        print(f"📝 Contenido SQL:\n{sql_content}\n")
        
        # Nota: Supabase Python client no soporta ejecutar SQL directo
        # Necesitas ejecutar esto manualmente en Supabase SQL Editor
        
        print("⚠️  IMPORTANTE:")
        print("   El cliente de Python de Supabase no soporta ejecutar SQL directo.")
        print("   Por favor, ejecuta manualmente el siguiente SQL en Supabase SQL Editor:")
        print("\n" + "="*80)
        print(sql_content)
        print("="*80 + "\n")
        
        print("📍 Pasos:")
        print("   1. Ve a tu proyecto Supabase: https://app.supabase.com")
        print("   2. Navega a SQL Editor")
        print("   3. Copia y pega el SQL de arriba")
        print("   4. Ejecuta el script")
        print("   5. Verifica que las columnas se crearon correctamente")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    apply_onboarding_migration()
