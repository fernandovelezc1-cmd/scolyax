"""
Scheduler para tareas en segundo plano de Scolyax
Maneja el envío de emails de reactivación a usuarios inactivos
y el despacho de notificaciones push programadas.
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

# Scheduler global
_scheduler: Optional[BackgroundScheduler] = None


def get_inactive_users(days_threshold: int = 1) -> List[dict]:
    """
    Obtiene usuarios que han estado inactivos por al menos days_threshold días.
    
    Args:
        days_threshold: Número mínimo de días de inactividad
    
    Returns:
        Lista de usuarios inactivos con su información
    """
    from .supabase_client import get_supabase_client
    
    try:
        supabase = get_supabase_client()
        
        # Calcular fecha límite
        threshold_date = (datetime.now(timezone.utc) - timedelta(days=days_threshold)).isoformat()
        
        # Buscar usuarios cuya última actividad sea anterior a threshold_date
        # y que no hayan recibido un email de reactivación recientemente
        # Nota: usamos "*" para no fallar si la columna last_reactivation_email_sent
        # aún no existe en la tabla
        response = supabase.table("user_stats").select(
            "*"
        ).lt("last_activity_date", threshold_date).execute()
        
        if not response.data:
            return []
        
        inactive_users = []
        for user_stat in response.data:
            # Calcular días de ausencia
            last_activity = datetime.fromisoformat(user_stat["last_activity_date"].replace('Z', '+00:00'))
            if last_activity.tzinfo is None:
                last_activity = last_activity.replace(tzinfo=timezone.utc)
            days_absent = (datetime.now(timezone.utc) - last_activity).days
            
            # Verificar si ya se envió un email recientemente
            last_email_sent = user_stat.get("last_reactivation_email_sent")
            should_send = True
            
            if last_email_sent:
                last_email_date = datetime.fromisoformat(last_email_sent.replace('Z', '+00:00'))
                if last_email_date.tzinfo is None:
                    last_email_date = last_email_date.replace(tzinfo=timezone.utc)
                days_since_email = (datetime.now(timezone.utc) - last_email_date).days
                
                # Para días 1-2: enviar solo una vez por día
                if days_absent <= 2 and days_since_email < 1:
                    should_send = False
                # Para día 3+: enviar cada 3 días
                elif days_absent >= 3 and days_since_email < 3:
                    should_send = False
            
            if should_send:
                inactive_users.append({
                    "email": user_stat["user_email"],
                    "days_absent": days_absent,
                    "last_activity": user_stat["last_activity_date"]
                })
        
        return inactive_users
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo usuarios inactivos: {e}")
        return []


def get_user_by_email(email: str) -> Optional[dict]:
    """Obtiene información de un usuario por su email"""
    from .supabase_client import get_supabase_client
    
    try:
        supabase = get_supabase_client()
        response = supabase.table("users").select("*").eq("email", email).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"❌ Error obteniendo usuario {email}: {e}")
        return None


def update_reactivation_email_timestamp(user_email: str):
    """Actualiza el timestamp del último email de reactivación enviado"""
    from .supabase_client import get_supabase_client
    
    try:
        supabase = get_supabase_client()
        now = datetime.now(timezone.utc).isoformat()
        
        supabase.table("user_stats").update({
            "last_reactivation_email_sent": now
        }).eq("user_email", user_email).execute()
        
        logger.info(f"✅ Timestamp de reactivación actualizado para {user_email}")
    except Exception as e:
        logger.error(f"❌ Error actualizando timestamp para {user_email}: {e}")


def send_reactivation_emails_job():
    """
    Job que verifica usuarios inactivos y envía emails de reactivación.
    
    Lógica:
    - Días 1-2: Email motivacional con cerebro animado
    - Día 3+: Email triste cada 3 días con cerebro triste
    """
    from .mailer import send_reactivation_email
    from .models import User
    
    logger.info("🔍 Verificando usuarios inactivos para envío de emails de reactivación...")
    
    try:
        # Obtener todos los usuarios inactivos (1+ días)
        inactive_users = get_inactive_users(days_threshold=1)
        
        if not inactive_users:
            logger.info("✅ No hay usuarios inactivos que requieran emails de reactivación")
            return
        
        logger.info(f"📧 Encontrados {len(inactive_users)} usuarios inactivos")
        
        emails_sent = 0
        for user_info in inactive_users:
            try:
                # Obtener información completa del usuario
                user_data = get_user_by_email(user_info["email"])
                if not user_data:
                    logger.warning(f"⚠️ Usuario no encontrado: {user_info['email']}")
                    continue
                
                # Crear objeto User
                user = User(
                    id=user_data.get("id"),
                    email=user_data["email"],
                    display_name=user_data.get("display_name", user_data["email"].split("@")[0]),
                    provider=user_data.get("provider", "google")
                )
                
                days_absent = user_info["days_absent"]
                
                # Determinar tipo de email
                is_sad = days_absent >= 3
                
                # Enviar email
                logger.info(f"📤 Enviando email de reactivación a {user.email} ({days_absent} días ausente, tipo={'triste' if is_sad else 'motivacional'})")
                send_reactivation_email(user, days_absent, is_sad=is_sad)
                
                # Actualizar timestamp
                update_reactivation_email_timestamp(user.email)
                
                emails_sent += 1
                
            except Exception as e:
                logger.error(f"❌ Error procesando usuario {user_info['email']}: {e}")
                continue
        
        logger.info(f"✅ Job de reactivación completado: {emails_sent} emails enviados")
        
    except Exception as e:
        logger.error(f"❌ Error en job de reactivación: {e}")


def check_scheduled_notifications_job():
    """
    Job que procesa notificaciones push programadas.
    Se ejecuta cada 30 segundos. Busca en scheduled_notifications las que ya deben enviarse.
    """
    try:
        from .notification_scheduler import process_pending_notifications
        sent = process_pending_notifications()
        if sent > 0:
            logger.info(f"📬 Scheduler: {sent} notificaciones push programadas enviadas")
        else:
            logger.debug("📬 Scheduler: sin notificaciones pendientes en esta ronda")
    except Exception as e:
        logger.error(f"❌ Error en job de notificaciones programadas: {e}")


def keep_alive_self_ping():
    """
    Self-ping para evitar que el dyno de Railway/Render se duerma.
    Hace un request HTTP al propio health endpoint cada 5 minutos.
    """
    import urllib.request
    try:
        # Intentar determinar la URL del servidor
        port = os.getenv("PORT", "8000")
        railway_url = os.getenv("RAILWAY_PUBLIC_DOMAIN") or os.getenv("RAILWAY_STATIC_URL")
        
        if railway_url:
            # En producción: usar dominio público
            url = f"https://{railway_url}/health/live"
        else:
            # Local: usar localhost
            url = f"http://127.0.0.1:{port}/health/live"
        
        req = urllib.request.Request(url, method="GET")
        req.add_header("User-Agent", "Scolyax-KeepAlive/1.0")
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                logger.debug("💓 Keep-alive ping OK")
    except Exception as e:
        logger.debug(f"💓 Keep-alive ping skip: {e}")


def start_scheduler():
    """Inicia el scheduler de tareas en segundo plano"""
    global _scheduler
    
    if _scheduler is not None:
        logger.warning("⚠️ Scheduler ya está iniciado")
        return
    
    try:
        _scheduler = BackgroundScheduler(daemon=True)
        
        # Ejecutar verificación de usuarios inactivos todos los días a las 10:00 AM
        _scheduler.add_job(
            send_reactivation_emails_job,
            trigger=CronTrigger(hour=10, minute=0),
            id='reactivation_emails',
            name='Envío de emails de reactivación',
            replace_existing=True
        )
        
        # También ejecutar cada 6 horas para usuarios muy inactivos
        _scheduler.add_job(
            send_reactivation_emails_job,
            trigger=CronTrigger(hour='*/6'),
            id='reactivation_emails_frequent',
            name='Verificación frecuente de usuarios inactivos',
            replace_existing=True
        )

        # Push notifications programadas — cada 30 segundos
        from apscheduler.triggers.interval import IntervalTrigger
        _scheduler.add_job(
            check_scheduled_notifications_job,
            trigger=IntervalTrigger(seconds=30),
            id='scheduled_notifications',
            name='Enviar notificaciones push programadas',
            replace_existing=True
        )

        # Keep-alive self-ping — cada 2 minutos para evitar que el dyno duerma
        _scheduler.add_job(
            keep_alive_self_ping,
            trigger=IntervalTrigger(minutes=2),
            id='keep_alive_ping',
            name='Keep-alive self-ping',
            replace_existing=True
        )
        
        _scheduler.start()
        logger.info("✅ Scheduler iniciado exitosamente")
        logger.info("📅 Job 'reactivation_emails' programado para ejecutarse diariamente a las 10:00 AM")
        logger.info("📅 Job 'reactivation_emails_frequent' programado para ejecutarse cada 6 horas")
        logger.info("📅 Job 'scheduled_notifications' programado para ejecutarse cada 30 segundos")
        logger.info("💓 Job 'keep_alive_ping' programado para ejecutarse cada 4 minutos")
        
    except Exception as e:
        logger.error(f"❌ Error iniciando scheduler: {e}")
        raise


def stop_scheduler():
    """Detiene el scheduler"""
    global _scheduler
    
    if _scheduler is None:
        return
    
    try:
        _scheduler.shutdown()
        _scheduler = None
        logger.info("🛑 Scheduler detenido")
    except Exception as e:
        logger.error(f"❌ Error deteniendo scheduler: {e}")


def get_scheduler_status() -> dict:
    """Obtiene el estado actual del scheduler y sus jobs"""
    global _scheduler
    
    if _scheduler is None:
        return {"status": "stopped", "jobs": []}
    
    jobs = []
    for job in _scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger)
        })
    
    return {
        "status": "running" if _scheduler.running else "stopped",
        "jobs": jobs
    }
