#!/usr/bin/env python3
"""
Script para añadir columnas de onboarding a la tabla users en Supabase
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: SUPABASE_URL y SUPABASE_KEY deben estar en .env")
    exit(1)

print(f"🔗 Conectando a Supabase: {SUPABASE_URL}")

# Crear cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Leer el script SQL
with open('add_onboarding_columns_fix.sql', 'r') as f:
    sql_script = f.read()

print("📝 Ejecutando script SQL...")
print(sql_script)

try:
    # Ejecutar el script usando la función RPC o directamente
    # Nota: Supabase Python client no ejecuta SQL directamente por seguridad
    # Debes ejecutar este SQL en el SQL Editor de Supabase Dashboard
    
    print("\n⚠️  IMPORTANTE: Este script debe ejecutarse manualmente en Supabase")
    print("\n📋 PASOS:")
    print("1. Ve a https://app.supabase.com/project/_/sql")
    print("2. Copia y pega el contenido de 'add_onboarding_columns_fix.sql'")
    print("3. Haz clic en 'Run' para ejecutar")
    print("\n✅ Una vez hecho esto, el backend podrá guardar el onboarding correctamente")
    
    # Verificar si las columnas existen intentando leer un usuario
    print("\n🔍 Intentando verificar columnas...")
    result = supabase.table('users').select('email, has_completed_onboarding').limit(1).execute()
    
    if result.data:
        print("✅ La columna 'has_completed_onboarding' existe!")
    else:
        print("⚠️  No hay usuarios para verificar, pero la tabla debería estar lista")
        
except Exception as e:
    if "has_completed_onboarding" in str(e):
        print(f"\n❌ La columna aún no existe: {e}")
        print("\n📋 Ejecuta el SQL manualmente en Supabase Dashboard:")
        print("   https://app.supabase.com/project/_/sql")
    else:
        print(f"❌ Error: {e}")
