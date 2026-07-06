"""
Health Check y Monitoring Endpoints para Scolyax API

Este módulo proporciona endpoints para verificar la salud de la aplicación,
monitoring de rendimiento y verificación de conectividad con servicios externos.
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional
import logging
import psutil
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["health"])


class HealthStatus(BaseModel):
    status: str  # "healthy" | "degraded" | "unhealthy"
    timestamp: str
    version: str
    uptime_seconds: float
    services: Dict[str, Any]
    system: Dict[str, Any]


class ServiceHealth(BaseModel):
    name: str
    status: str  # "operational" | "degraded" | "down"
    response_time_ms: float
    last_check: str


# Variables globales para tracking
app_start_time: Optional[datetime] = None


def initialize_health_check(app):
    """Inicializar el health check cuando arranca la app."""
    global app_start_time
    app_start_time = datetime.now(timezone.utc)
    logger.info("Health check system initialized")


@router.get("/", response_model=HealthStatus)
async def health_check():
    """
    Endpoint principal de health check.
    
    Retorna:
    - status: Estado general (healthy/degraded/unhealthy)
    - timestamp: Hora del check
    - version: Versión de la API
    - uptime_seconds: Tiempo que lleva la app corriendo
    - services: Estado de cada servicio
    - system: Métricas del sistema
    """
    try:
        global app_start_time
        if not app_start_time:
            app_start_time = datetime.now(timezone.utc)
        
        now = datetime.now(timezone.utc)
        uptime = (now - app_start_time).total_seconds()
        
        # Verificar servicios
        services = await check_services()
        
        # Obtener métricas del sistema
        system_metrics = get_system_metrics()
        
        # Determinar estado general
        service_statuses = [s.get("status") for s in services.values()]
        if all(s == "operational" for s in service_statuses):
            overall_status = "healthy"
        elif any(s == "down" for s in service_statuses):
            overall_status = "unhealthy"
        else:
            overall_status = "degraded"
        
        return HealthStatus(
            status=overall_status,
            timestamp=now.isoformat(),
            version="1.0.0",
            uptime_seconds=uptime,
            services=services,
            system=system_metrics
        )
    except Exception as e:
        logger.error(f"Error en health check: {e}")
        raise HTTPException(status_code=503, detail="Health check failed")


@router.get("/live")
async def liveness_check():
    """
    Verificación de que la aplicación está corriendo.
    Usado por Kubernetes/Railway para restart automático.
    """
    return {"status": "alive", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/ready")
async def readiness_check():
    """
    Verificación de que la aplicación está lista para recibir requests.
    Usado por Kubernetes/Railway para load balancing.
    """
    try:
        services = await check_services()
        
        # Si database no está disponible, no estamos ready
        if services.get("database", {}).get("status") != "operational":
            raise HTTPException(status_code=503, detail="Database not ready")
        
        return {
            "status": "ready",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "services": {k: v.get("status") for k, v in services.items()}
        }
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail="Service not ready")


@router.get("/metrics")
async def metrics():
    """
    Endpoint de métricas para Prometheus/Grafana.
    Retorna métricas en formato Prometheus.
    """
    metrics = get_system_metrics()
    
    # Formato Prometheus
    lines = [
        "# HELP system_cpu_percent CPU usage percentage",
        "# TYPE system_cpu_percent gauge",
        f"system_cpu_percent {metrics.get('cpu_percent', 0)}",
        "",
        "# HELP system_memory_percent Memory usage percentage",
        "# TYPE system_memory_percent gauge",
        f"system_memory_percent {metrics.get('memory_percent', 0)}",
        "",
        "# HELP system_memory_available_mb Available memory in MB",
        "# TYPE system_memory_available_mb gauge",
        f"system_memory_available_mb {metrics.get('memory_available_mb', 0)}",
        "",
        "# HELP process_uptime_seconds Process uptime in seconds",
        "# TYPE process_uptime_seconds gauge",
        f"process_uptime_seconds {get_uptime_seconds()}",
    ]
    
    return "\n".join(lines)


async def check_services() -> Dict[str, Dict[str, Any]]:
    """
    Verificar estado de todos los servicios.
    
    Returns:
        Dict con estado de cada servicio
    """
    services = {}
    
    # Check Database
    services["database"] = await check_database()
    
    # Check Google OAuth
    services["google_oauth"] = await check_oauth_service("google")
    
    # Check Microsoft OAuth
    services["microsoft_oauth"] = await check_oauth_service("microsoft")
    
    # Check Supabase Connection
    services["supabase"] = await check_supabase()
    
    # Check Storage
    services["storage"] = check_storage_service()
    
    return services


async def check_database() -> Dict[str, Any]:
    """Verificar conexión a la base de datos."""
    try:
        # Aquí deberías hacer una query simple a tu DB
        # Ejemplo: SELECT 1
        # response_time = time.time()
        # result = db.query("SELECT 1")
        # response_time = time.time() - response_time
        
        # Por ahora, retornamos un check simulado
        return {
            "status": "operational",
            "response_time_ms": 5.2,
            "last_check": datetime.now(timezone.utc).isoformat(),
            "connection_pool": "active"
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "down",
            "error": str(e),
            "last_check": datetime.now(timezone.utc).isoformat()
        }


async def check_oauth_service(provider: str) -> Dict[str, Any]:
    """Verificar servicio OAuth."""
    try:
        # En producción, hacer request real al OAuth provider
        status = "operational"
        response_time = 50.0  # ms
        
        return {
            "status": status,
            "provider": provider,
            "response_time_ms": response_time,
            "last_check": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"OAuth health check failed for {provider}: {e}")
        return {
            "status": "degraded",
            "provider": provider,
            "error": str(e),
            "last_check": datetime.now(timezone.utc).isoformat()
        }


async def check_supabase() -> Dict[str, Any]:
    """Verificar conexión a Supabase."""
    try:
        # En producción, hacer request a Supabase
        return {
            "status": "operational",
            "response_time_ms": 12.5,
            "region": "us-east-1",
            "last_check": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Supabase health check failed: {e}")
        return {
            "status": "down",
            "error": str(e),
            "last_check": datetime.now(timezone.utc).isoformat()
        }


def check_storage_service() -> Dict[str, Any]:
    """Verificar servicio de almacenamiento."""
    try:
        # Verificar si storage está accesible
        storage_path = os.getenv("STORAGE_PATH", "./data")
        is_accessible = os.path.exists(storage_path)
        
        return {
            "status": "operational" if is_accessible else "degraded",
            "path": storage_path,
            "accessible": is_accessible,
            "last_check": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Storage health check failed: {e}")
        return {
            "status": "down",
            "error": str(e),
            "last_check": datetime.now(timezone.utc).isoformat()
        }


def get_system_metrics() -> Dict[str, Any]:
    """
    Obtener métricas del sistema.
    
    Returns:
        Dict con CPU, memoria, procesos, etc.
    """
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        
        return {
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "memory_available_mb": memory.available / (1024 * 1024),
            "memory_total_mb": memory.total / (1024 * 1024),
            "memory_used_mb": memory.used / (1024 * 1024),
            "disk_percent": disk.percent,
            "disk_free_mb": disk.free / (1024 * 1024),
            "process_count": len(psutil.pids()),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting system metrics: {e}")
        return {
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


def get_uptime_seconds() -> float:
    """Obtener tiempo de uptime de la aplicación."""
    global app_start_time
    if not app_start_time:
        return 0.0
    
    now = datetime.now(timezone.utc)
    return (now - app_start_time).total_seconds()


@router.post("/alert")
async def send_alert(message: str, severity: str = "info"):
    """
    Endpoint para enviar alertas (para testing).
    En producción, conectar con Slack/PagerDuty.
    """
    logger.warning(f"Alert [{severity}]: {message}")
    return {
        "status": "alert_sent",
        "message": message,
        "severity": severity,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
