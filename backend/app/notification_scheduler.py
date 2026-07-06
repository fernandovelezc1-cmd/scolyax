"""
Módulo de programación inteligente de notificaciones push para Scolyax.

Reglas de notificación:
- Al crear tarea/recordatorio: notificación inmediata de confirmación.
- Si vence en 2+ días: notificación "vence mañana" el día anterior a las 20:00 hora local.
- Si vence en 1+ día: notificación "vence hoy" 10 minutos antes de la hora de vencimiento.
- Si vence el mismo día: solo confirmación + 10 minutos antes.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

# Zona horaria por defecto si no se proporciona
DEFAULT_TIMEZONE = "America/Bogota"


def _get_supabase():
    from .supabase_client import get_supabase_client
    return get_supabase_client()


# ─── Programar notificaciones al crear tarea / recordatorio ───

def schedule_task_notifications(task_id: int, title: str, course: str,
                                 due_date: Optional[datetime],
                                 user_email: str,
                                 user_timezone: Optional[str] = None) -> int:
    """
    Programa las notificaciones push para una tarea recién creada.
    - La notificación de "creación" se envía INMEDIATAMENTE vía Web Push
      (sin pasar por el scheduler, para que llegue aunque la app esté cerrada).
    - Las notificaciones futuras (day_before, ten_min_before) se programan en la DB.
    Retorna el número total de notificaciones gestionadas.
    """
    from .push_notifications import send_push_to_user

    tz = _get_timezone(user_timezone)
    scheduled_notifications = []
    now = datetime.now(timezone.utc)
    total = 0

    # 1. Notificación inmediata de creación — ENVÍO DIRECTO (no espera al scheduler)
    due_info = ""
    if due_date:
        due_date = _ensure_utc(due_date)
        due_info = f"\n📅 Vence: {_format_date(due_date, tz)}"

    created_title = "✅ Nueva tarea creada"
    created_body = f"{title}\n📚 Curso: {course}{due_info}"
    tag = f"task-{task_id}-created"

    try:
        sent = send_push_to_user(
            user_email,
            title=created_title,
            body=created_body,
            tag=tag,
            url="/",
        )
        if sent > 0:
            logger.info(f"📬 Push inmediato enviado: [{tag}] → {user_email}")
            total += 1
        # Registrar en DB como ya enviada (para historial)
        _insert_notifications([{
            "user_email": user_email,
            "entity_type": "task",
            "entity_id": task_id,
            "notification_type": "created",
            "send_at": now.isoformat(),
            "sent": True,
            "sent_at": now.isoformat(),
            "title": created_title,
            "body": created_body,
        }])
    except Exception as e:
        logger.warning(f"⚠️ No se pudo enviar push inmediato de tarea: {e}")
        # Fallback: programar para el scheduler
        scheduled_notifications.append({
            "user_email": user_email,
            "entity_type": "task",
            "entity_id": task_id,
            "notification_type": "created",
            "send_at": now.isoformat(),
            "title": created_title,
            "body": created_body,
        })

    if due_date:
        days_until = (due_date - now).total_seconds() / 86400

        # Convertir due_date a hora local para calcular "día anterior" correctamente
        due_local = due_date.astimezone(tz)

        # 2. Notificación "vence mañana" — solo si faltan 2+ días
        #    Se envía el día anterior a las 20:00 hora LOCAL del usuario
        if days_until >= 1.5:
            day_before_local = due_local - timedelta(days=1)
            day_before_8pm_local = day_before_local.replace(hour=20, minute=0, second=0, microsecond=0)
            # Convertir de vuelta a UTC para almacenar
            day_before_8pm_utc = day_before_8pm_local.astimezone(timezone.utc)
            # Solo si la hora programada es en el futuro
            if day_before_8pm_utc > now:
                scheduled_notifications.append({
                    "user_email": user_email,
                    "entity_type": "task",
                    "entity_id": task_id,
                    "notification_type": "day_before",
                    "send_at": day_before_8pm_utc.isoformat(),
                    "title": "📋 Tu tarea vence mañana",
                    "body": f"{title}\n📚 Curso: {course}\n📅 Vence: {_format_date(due_date, tz)}",
                })

        # 3. Notificación "vence pronto" — 10 minutos antes
        ten_min_before = due_date - timedelta(minutes=10)
        if ten_min_before > now:
            scheduled_notifications.append({
                "user_email": user_email,
                "entity_type": "task",
                "entity_id": task_id,
                "notification_type": "ten_min_before",
                "send_at": ten_min_before.isoformat(),
                "title": "🔴 ¡Tu tarea vence pronto!",
                "body": f"{title}\n📚 Curso: {course}\n⏰ Vence a las {_format_time(due_date, tz)}",
            })

    total += _insert_notifications(scheduled_notifications)
    return total


def schedule_reminder_notifications(reminder_id: int, title: str,
                                     description: Optional[str],
                                     remind_at: datetime,
                                     user_email: str,
                                     user_timezone: Optional[str] = None) -> int:
    """
    Programa las notificaciones push para un recordatorio recién creado.
    - La notificación de "creación" se envía INMEDIATAMENTE vía Web Push.
    - Las notificaciones futuras se programan en la DB.
    Retorna el número total de notificaciones gestionadas.
    """
    from .push_notifications import send_push_to_user

    tz = _get_timezone(user_timezone)
    scheduled_notifications = []
    now = datetime.now(timezone.utc)
    remind_at = _ensure_utc(remind_at)
    total = 0

    desc_info = f"\n📝 {description}" if description else ""

    # 1. Notificación inmediata de creación — ENVÍO DIRECTO
    created_title = "✅ Nuevo recordatorio creado"
    created_body = f"{title}{desc_info}\n📅 Para: {_format_date(remind_at, tz)}"
    tag = f"reminder-{reminder_id}-created"

    try:
        sent = send_push_to_user(
            user_email,
            title=created_title,
            body=created_body,
            tag=tag,
            url="/",
        )
        if sent > 0:
            logger.info(f"📬 Push inmediato enviado: [{tag}] → {user_email}")
            total += 1
        # Registrar en DB como ya enviada (para historial)
        _insert_notifications([{
            "user_email": user_email,
            "entity_type": "reminder",
            "entity_id": reminder_id,
            "notification_type": "created",
            "send_at": now.isoformat(),
            "sent": True,
            "sent_at": now.isoformat(),
            "title": created_title,
            "body": created_body,
        }])
    except Exception as e:
        logger.warning(f"⚠️ No se pudo enviar push inmediato de recordatorio: {e}")
        # Fallback: programar para el scheduler
        scheduled_notifications.append({
            "user_email": user_email,
            "entity_type": "reminder",
            "entity_id": reminder_id,
            "notification_type": "created",
            "send_at": now.isoformat(),
            "title": created_title,
            "body": created_body,
        })

    days_until = (remind_at - now).total_seconds() / 86400

    # Convertir remind_at a hora local para calcular "día anterior" correctamente
    remind_local = remind_at.astimezone(tz)

    # 2. Notificación "vence mañana" — solo si faltan 2+ días
    if days_until >= 1.5:
        day_before_local = remind_local - timedelta(days=1)
        day_before_8pm_local = day_before_local.replace(hour=20, minute=0, second=0, microsecond=0)
        day_before_8pm_utc = day_before_8pm_local.astimezone(timezone.utc)
        if day_before_8pm_utc > now:
            scheduled_notifications.append({
                "user_email": user_email,
                "entity_type": "reminder",
                "entity_id": reminder_id,
                "notification_type": "day_before",
                "send_at": day_before_8pm_utc.isoformat(),
                "title": "⏰ Tu recordatorio vence mañana",
                "body": f"{title}{desc_info}\n📅 Vence: {_format_date(remind_at, tz)}",
            })

    # 3. Notificación "vence pronto" — 10 minutos antes
    ten_min_before = remind_at - timedelta(minutes=10)
    if ten_min_before > now:
        scheduled_notifications.append({
            "user_email": user_email,
            "entity_type": "reminder",
            "entity_id": reminder_id,
            "notification_type": "ten_min_before",
            "send_at": ten_min_before.isoformat(),
            "title": "🔴 ¡Tu recordatorio vence pronto!",
            "body": f"{title}{desc_info}\n⏰ Vence a las {_format_time(remind_at, tz)}",
        })

    total += _insert_notifications(scheduled_notifications)
    return total


# ─── Cancelar notificaciones (al eliminar tarea/recordatorio) ───

def cancel_entity_notifications(entity_type: str, entity_id: int,
                                 user_email: str) -> int:
    """
    Cancela (elimina) todas las notificaciones pendientes de una entidad.
    Se usa cuando se elimina una tarea o recordatorio.
    """
    try:
        supabase = _get_supabase()
        response = supabase.table("scheduled_notifications").delete().eq(
            "entity_type", entity_type
        ).eq("entity_id", entity_id).eq(
            "user_email", user_email
        ).eq("sent", False).execute()

        deleted = len(response.data) if response.data else 0
        if deleted > 0:
            logger.info(f"🗑️ Canceladas {deleted} notificaciones de {entity_type} #{entity_id}")
        return deleted
    except Exception as e:
        logger.error(f"❌ Error cancelando notificaciones: {e}")
        return 0


# ─── Job del scheduler: enviar notificaciones pendientes ───

def process_pending_notifications() -> int:
    """
    Busca notificaciones cuyo send_at ya pasó y no han sido enviadas.
    Las envía y las marca como sent=True.
    Retorna el número de notificaciones enviadas.
    """
    from .push_notifications import send_push_to_user

    try:
        supabase = _get_supabase()
        now = datetime.now(timezone.utc).isoformat()

        # Buscar notificaciones pendientes cuya hora ya llegó y no han sido enviadas.
        # IMPORTANTE: filtrar sent=False en la query (no en Python) para evitar
        # que las 179+ notificaciones ya enviadas bloqueen el limit(50) y oculten
        # las pendientes reales.
        response = supabase.table("scheduled_notifications").select(
            "id, user_email, entity_type, entity_id, notification_type, title, body, sent"
        ).lte("send_at", now).eq("sent", False).order(
            "send_at", desc=False
        ).limit(50).execute()

        if not response.data:
            return 0

        pending = response.data

        sent_count = 0
        for notif in pending:
            user_email = notif["user_email"]
            title = notif["title"]
            body = notif["body"]
            entity_type = notif["entity_type"]
            entity_id = notif["entity_id"]
            notif_type = notif["notification_type"]

            # ── Atomic claim: marcar como sent=True ANTES de enviar.
            # Si otro worker ya la reclamó (sent ya es True), la query
            # no afecta ninguna fila y data estará vacío → saltar.
            # Esto elimina la race condition con múltiples workers Gunicorn.
            try:
                claim = supabase.table("scheduled_notifications").update({
                    "sent": True,
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", notif["id"]).eq("sent", False).execute()
            except Exception as e:
                logger.error(f"❌ Error reclamando notificación {notif['id']}: {e}")
                continue

            if not claim.data:
                # Otro worker ya la procesó; ignorar para evitar duplicado
                logger.debug(f"⏩ Notificación {notif['id']} ya reclamada por otro worker, omitiendo")
                continue

            # Construir tag único para evitar duplicados en el navegador
            tag = f"{entity_type}-{entity_id}-{notif_type}"

            sent = send_push_to_user(
                user_email,
                title=title,
                body=body,
                tag=tag,
                url="/",
                require_interaction=(notif_type != "created"),
            )

            if sent > 0:
                logger.info(
                    f"📬 Notificación enviada: [{notif_type}] {title} → {user_email}"
                )
                sent_count += 1

        return sent_count

    except Exception as e:
        logger.error(f"❌ Error procesando notificaciones pendientes: {e}")
        return 0


# ─── Utilidades ───

def _ensure_utc(dt: datetime) -> datetime:
    """Asegura que un datetime tenga timezone UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _get_timezone(tz_name: Optional[str] = None):
    """Obtiene un objeto ZoneInfo a partir del nombre de zona horaria."""
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except (KeyError, Exception):
            logger.warning(f"⚠️ Zona horaria inválida: {tz_name}, usando {DEFAULT_TIMEZONE}")
    return ZoneInfo(DEFAULT_TIMEZONE)


def _format_date(dt: datetime, tz=None) -> str:
    """Formatea una fecha para mostrar en la notificación, en la zona horaria del usuario."""
    if tz is None:
        tz = ZoneInfo(DEFAULT_TIMEZONE)
    local_dt = dt.astimezone(tz)
    # Nombres de días y meses en español
    dias = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
    meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
             'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    dia_semana = dias[local_dt.weekday()]
    mes = meses[local_dt.month - 1]
    return f"{dia_semana} {local_dt.day} {mes} {local_dt.year} a las {local_dt.strftime('%I:%M %p')}"


def _format_time(dt: datetime, tz=None) -> str:
    """Formatea solo la hora para mostrar en la notificación."""
    if tz is None:
        tz = ZoneInfo(DEFAULT_TIMEZONE)
    local_dt = dt.astimezone(tz)
    return local_dt.strftime("%I:%M %p")


def _insert_notifications(notifications: List[dict]) -> int:
    """Inserta notificaciones en la tabla scheduled_notifications."""
    if not notifications:
        return 0

    try:
        supabase = _get_supabase()
        for notif in notifications:
            # Asegurar que sent=False est\u00e9 expl\u00edcito para que el scheduler las encuentre
            if "sent" not in notif:
                notif["sent"] = False
            supabase.table("scheduled_notifications").insert(notif).execute()

        logger.info(
            f"📅 {len(notifications)} notificaciones programadas para "
            f"{notifications[0]['entity_type']} #{notifications[0]['entity_id']}"
        )
        return len(notifications)
    except Exception as e:
        logger.error(f"❌ Error insertando notificaciones programadas: {e}")
        return 0
