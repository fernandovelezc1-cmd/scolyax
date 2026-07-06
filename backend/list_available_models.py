#!/usr/bin/env python3
"""
Script para listar todos los modelos disponibles en Google Generative AI
"""

import os
from dotenv import load_dotenv
import google.generativeai as genai

# Cargar .env
load_dotenv()

api_key = os.getenv("NOTEBOOKLM_API_KEY")
if not api_key:
    print("❌ NOTEBOOKLM_API_KEY no configurada en .env")
    exit(1)

genai.configure(api_key=api_key)

print("📋 Modelos disponibles en tu API key:")
print("=" * 60)

try:
    models = genai.list_models()
    
    for model in models:
        print(f"\n✅ {model.name}")
        print(f"   Display name: {model.display_name}")
        print(f"   Supported methods: {[m.value for m in model.supported_generation_methods]}")
        
except Exception as e:
    print(f"❌ Error listando modelos: {e}")
    exit(1)

print("\n" + "=" * 60)
print("💡 Usa uno de los nombres anteriores (ej: 'gemini-pro')")
