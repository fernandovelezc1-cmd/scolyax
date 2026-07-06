"""
Sistema de Caching con Invalidación Automática

Este módulo proporciona un sistema de caching en memoria con estrategias
de invalidación por tiempo, evento y cambio de datos.
"""

from typing import Any, Callable, Optional, Dict, List
from datetime import datetime, timedelta
import asyncio
import hashlib
import json
from functools import wraps
import logging

logger = logging.getLogger(__name__)


class CacheEntry:
    """Representa una entrada en el cache."""
    
    def __init__(self, value: Any, ttl_seconds: int = 300):
        self.value = value
        self.created_at = datetime.now()
        self.ttl_seconds = ttl_seconds
        self.access_count = 0
        self.last_accessed = datetime.now()
    
    def is_expired(self) -> bool:
        """Verificar si la entrada ha expirado."""
        elapsed = (datetime.now() - self.created_at).total_seconds()
        return elapsed > self.ttl_seconds
    
    def touch(self):
        """Actualizar tiempo de acceso."""
        self.last_accessed = datetime.now()
        self.access_count += 1


class MemoryCache:
    """Sistema de caching en memoria con invalidación automática."""
    
    def __init__(self, max_entries: int = 1000):
        self._cache: Dict[str, CacheEntry] = {}
        self._max_entries = max_entries
        self._invalidation_hooks: Dict[str, List[Callable]] = {}
        self._dependencies: Dict[str, List[str]] = {}
    
    def _make_key(self, key: str, params: Optional[Dict] = None) -> str:
        """Crear key consistente incluyendo parámetros."""
        if not params:
            return key
        
        params_str = json.dumps(params, sort_keys=True)
        params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
        return f"{key}:{params_hash}"
    
    def set(self, key: str, value: Any, ttl_seconds: int = 300, params: Optional[Dict] = None):
        """Guardar en cache."""
        cache_key = self._make_key(key, params)
        
        # Si alcanzamos max_entries, hacer cleanup
        if len(self._cache) >= self._max_entries:
            self._cleanup()
        
        self._cache[cache_key] = CacheEntry(value, ttl_seconds)
        logger.debug(f"Cache SET: {cache_key}")
    
    def get(self, key: str, params: Optional[Dict] = None) -> Optional[Any]:
        """Obtener del cache."""
        cache_key = self._make_key(key, params)
        
        if cache_key not in self._cache:
            logger.debug(f"Cache MISS: {cache_key}")
            return None
        
        entry = self._cache[cache_key]
        
        if entry.is_expired():
            del self._cache[cache_key]
            logger.debug(f"Cache EXPIRED: {cache_key}")
            return None
        
        entry.touch()
        logger.debug(f"Cache HIT: {cache_key}")
        return entry.value
    
    def delete(self, key: str, params: Optional[Dict] = None):
        """Eliminar del cache."""
        cache_key = self._make_key(key, params)
        if cache_key in self._cache:
            del self._cache[cache_key]
            logger.debug(f"Cache DELETE: {cache_key}")
    
    def invalidate(self, pattern: str):
        """Invalidar todas las keys que coincidan con el patrón."""
        keys_to_delete = [k for k in self._cache.keys() if pattern in k]
        for key in keys_to_delete:
            del self._cache[key]
        logger.info(f"Cache INVALIDATE: pattern={pattern}, deleted={len(keys_to_delete)}")
    
    def clear(self):
        """Limpiar todo el cache."""
        self._cache.clear()
        logger.info("Cache CLEAR: all entries removed")
    
    def _cleanup(self):
        """Cleanup: remover entradas expiradas o menos usadas."""
        # Remover expiradas
        expired_keys = [k for k, v in self._cache.items() if v.is_expired()]
        for key in expired_keys:
            del self._cache[key]
        
        # Si aún estamos sobre el límite, remover las menos accedidas
        if len(self._cache) >= self._max_entries:
            # Ordenar por access_count y eliminar las menos usadas
            sorted_items = sorted(
                self._cache.items(),
                key=lambda x: (x[1].access_count, x[1].last_accessed)
            )
            
            # Eliminar el 10% menos usado
            remove_count = max(1, len(sorted_items) // 10)
            for key, _ in sorted_items[:remove_count]:
                del self._cache[key]
        
        logger.debug(f"Cache CLEANUP: removed {len(expired_keys)} expired, cache size={len(self._cache)}")
    
    def stats(self) -> Dict[str, Any]:
        """Obtener estadísticas del cache."""
        total_accesses = sum(e.access_count for e in self._cache.values())
        avg_ttl = sum(e.ttl_seconds for e in self._cache.values()) / len(self._cache) if self._cache else 0
        
        return {
            "entries": len(self._cache),
            "max_entries": self._max_entries,
            "total_accesses": total_accesses,
            "avg_ttl_seconds": avg_ttl,
            "capacity_percent": (len(self._cache) / self._max_entries) * 100
        }


# Instancia global del cache
_global_cache = MemoryCache(max_entries=1000)


def cached(
    key: str,
    ttl_seconds: int = 300,
    invalidate_on: Optional[List[str]] = None,
    use_params: bool = True
):
    """
    Decorator para cachear resultados de funciones.
    
    Args:
        key: Key para el cache
        ttl_seconds: Tiempo de vida en segundos
        invalidate_on: Eventos que invalidan el cache
        use_params: Si True, incluir parámetros en la key
    
    Example:
        @cached("user_stats", ttl_seconds=600)
        def get_user_stats(user_id: int):
            return expensive_query(user_id)
    """
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Construir params para la key
            params = None
            if use_params and (args or kwargs):
                params = {
                    "args": str(args),
                    "kwargs": str(kwargs)
                }
            
            # Intentar obtener del cache
            cached_value = _global_cache.get(key, params)
            if cached_value is not None:
                return cached_value
            
            # Ejecutar función
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            # Guardar en cache
            _global_cache.set(key, result, ttl_seconds, params)
            
            return result
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            params = None
            if use_params and (args or kwargs):
                params = {
                    "args": str(args),
                    "kwargs": str(kwargs)
                }
            
            cached_value = _global_cache.get(key, params)
            if cached_value is not None:
                return cached_value
            
            result = func(*args, **kwargs)
            _global_cache.set(key, result, ttl_seconds, params)
            return result
        
        # Agregar método para invalidar manualmente
        if asyncio.iscoroutinefunction(func):
            async_wrapper.invalidate = lambda: _global_cache.invalidate(key)
        else:
            sync_wrapper.invalidate = lambda: _global_cache.invalidate(key)
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    
    return decorator


class CacheInvalidationStrategy:
    """Estrategia de invalidación de cache basada en eventos."""
    
    @staticmethod
    def invalidate_user_cache(user_id: int):
        """Invalidar cache cuando un usuario cambia datos."""
        _global_cache.invalidate(f"user:{user_id}")
        _global_cache.invalidate(f"stats:user:{user_id}")
    
    @staticmethod
    def invalidate_task_cache(user_id: int):
        """Invalidar cache de tareas."""
        _global_cache.invalidate(f"tasks:user:{user_id}")
        _global_cache.invalidate(f"stats:user:{user_id}")
    
    @staticmethod
    def invalidate_reminder_cache(user_id: int):
        """Invalidar cache de recordatorios."""
        _global_cache.invalidate(f"reminders:user:{user_id}")
    
    @staticmethod
    def invalidate_dashboard_cache(user_id: int):
        """Invalidar cache de dashboard."""
        _global_cache.invalidate(f"dashboard:user:{user_id}")
        _global_cache.invalidate(f"stats:")
    
    @staticmethod
    def invalidate_all():
        """Limpiar todo el cache."""
        _global_cache.clear()


# Decoradores convenientes para casos comunes
def cache_user_data(ttl: int = 600):
    """Cachear datos de usuario."""
    return cached("user_data", ttl_seconds=ttl)


def cache_user_tasks(ttl: int = 300):
    """Cachear tareas de usuario."""
    return cached("tasks", ttl_seconds=ttl)


def cache_user_reminders(ttl: int = 300):
    """Cachear recordatorios de usuario."""
    return cached("reminders", ttl_seconds=ttl)


def cache_dashboard_stats(ttl: int = 600):
    """Cachear estadísticas del dashboard."""
    return cached("dashboard_stats", ttl_seconds=ttl)


# Función para obtener el cache global
def get_cache() -> MemoryCache:
    """Obtener instancia global del cache."""
    return _global_cache
