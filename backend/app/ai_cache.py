"""
Sistema de caché inteligente para respuestas de IA
Reduce consumo de cuota guardando respuestas previas
"""

import json
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

CACHE_DIR = Path(__file__).parent.parent / "data" / "ai_cache"
CACHE_DURATION_HOURS = 24  # Caché válido por 24 horas

def init_cache():
    """Crea el directorio de caché si no existe."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

def get_cache_key(prompt: str, model: str = "gemini-2.5-flash") -> str:
    """Genera un hash único para el prompt."""
    content = f"{model}:{prompt}".encode('utf-8')
    return hashlib.sha256(content).hexdigest()[:16]

def get_cached_response(prompt: str) -> Optional[Dict[str, Any]]:
    """
    Obtiene respuesta del caché si existe y es válida.
    Intenta primero Supabase (persistente), luego archivo local.
    
    Returns:
        dict con 'response' y 'cached_at' si existe, None si no
    """
    # Intentar primero Supabase (persiste entre deploys)
    try:
        from .supabase_storage import get_supabase
        
        sb = get_supabase()
        if sb:
            cache_key = get_cache_key(prompt)
            rows = sb.table("ai_responses_cache").select("response,cached_at").eq(
                "cache_key", cache_key
            ).limit(1).execute().data or []
            
            if rows:
                cached = rows[0]
                # Verificar expiración
                cached_time = datetime.fromisoformat(cached['cached_at'])
                expiry_time = cached_time + timedelta(hours=CACHE_DURATION_HOURS)
                
                if datetime.now() < expiry_time:
                    return {
                        'response': cached['response'],
                        'cached_at': cached['cached_at'],
                        'source': 'supabase'
                    }
    except Exception as e:
        print(f"⚠️ Error leyendo caché de Supabase: {e}")
    
    # Fallback: caché local (para desarrollo)
    init_cache()
    cache_key = get_cache_key(prompt)
    cache_file = CACHE_DIR / f"{cache_key}.json"
    
    if not cache_file.exists():
        return None
    
    try:
        with open(cache_file, 'r', encoding='utf-8') as f:
            cached = json.load(f)
        
        # Verificar si el caché aún es válido
        cached_time = datetime.fromisoformat(cached['cached_at'])
        expiry_time = cached_time + timedelta(hours=CACHE_DURATION_HOURS)
        
        if datetime.now() < expiry_time:
            return cached
        else:
            # Caché expirado, eliminar
            cache_file.unlink()
            return None
    except Exception as e:
        print(f"Error leyendo caché local: {e}")
        return None

def save_to_cache(prompt: str, response: str):
    """
    Guarda respuesta en caché (Supabase + local).
    
    Args:
        prompt: Prompt original
        response: Respuesta de la IA
    """
    cache_key = get_cache_key(prompt)
    cached_at = datetime.now().isoformat()
    
    # Guardar en Supabase (persistente entre deploys)
    try:
        from .supabase_storage import get_supabase
        sb = get_supabase()
        if sb:
            # Intentar actualizar si existe, si no insertar
            existing = sb.table("ai_responses_cache").select("id").eq(
                "cache_key", cache_key
            ).limit(1).execute().data or []
            
            if existing:
                sb.table("ai_responses_cache").update({
                    "response": response,
                    "cached_at": cached_at
                }).eq("id", existing[0]["id"]).execute()
            else:
                sb.table("ai_responses_cache").insert({
                    "cache_key": cache_key,
                    "prompt": prompt[:500],
                    "response": response,
                    "cached_at": cached_at
                }).execute()
            print(f"✅ Caché guardado en Supabase: {cache_key}")
    except Exception as e:
        print(f"⚠️ Error guardando en Supabase: {e}")
    
    # Guardar también en archivo local (fallback)
    init_cache()
    cache_file = CACHE_DIR / f"{cache_key}.json"
    
    try:
        cache_data = {
            'prompt': prompt[:200],
            'response': response,
            'cached_at': cached_at
        }
        
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error guardando en caché local: {e}")

def clear_cache():
    """Limpia todo el caché."""
    init_cache()
    for cache_file in CACHE_DIR.glob("*.json"):
        cache_file.unlink()
    print("✅ Caché limpiado")

def get_cache_stats() -> Dict[str, int]:
    """Obtiene estadísticas del caché."""
    init_cache()
    cache_files = list(CACHE_DIR.glob("*.json"))
    
    valid_count = 0
    expired_count = 0
    
    for cache_file in cache_files:
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached = json.load(f)
            
            cached_time = datetime.fromisoformat(cached['cached_at'])
            expiry_time = cached_time + timedelta(hours=CACHE_DURATION_HOURS)
            
            if datetime.now() < expiry_time:
                valid_count += 1
            else:
                expired_count += 1
                cache_file.unlink()  # Limpiar caché expirado
        except:
            expired_count += 1
    
    return {
        'valid': valid_count,
        'expired': expired_count,
        'total': valid_count + expired_count
    }
