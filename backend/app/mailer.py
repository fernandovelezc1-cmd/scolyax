"""Utilidades para enviar correos transaccionales de Scolyax."""
from __future__ import annotations

import os
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
import logging

from .models import AuthProvider, Reminder, User
from .storage import DATA_DIR

logger = logging.getLogger(__name__)


def _build_message(user: User) -> EmailMessage:
    """Construye el mensaje de bienvenida personalizado para la persona usuaria."""
    message = EmailMessage()
    message["Subject"] = "Bienvenido a Scolyax"
    message["To"] = user.email
    message["From"] = os.getenv("SCOLYAX_EMAIL_FROM", "no-reply@scolyax.local")

    # Plantilla minimalista: saludo corto y línea de acción implícita
    body = f"Hola {user.display_name}\n\nBienvenido a Scolyax. Ya puedes crear tareas y recordatorios.\n\n— Scolyax"
    message.set_content(body)
    return message


def _write_to_outbox(message: EmailMessage, prefix: str = "message") -> Path:
    """Guarda el correo generado en disco cuando no hay SMTP disponible."""
    outbox_dir = Path(os.getenv("SCOLYAX_EMAIL_OUTBOX", DATA_DIR / "outbox"))
    outbox_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    recipient = message["To"].replace("@", "_at_").replace("/", "_")
    file_path = outbox_dir / f"{prefix}_{timestamp}_{recipient}.eml"
    file_path.write_text(message.as_string(), encoding="utf-8")
    return file_path


def _send_message_or_outbox(message: EmailMessage, prefix: str = 'message') -> Path | None:
    """Intenta enviar el mensaje vía SMTP; si falta configuración o falla la conexión,
    guarda el correo en el outbox y devuelve la ruta al archivo.
    """
    smtp_host = os.getenv("SCOLYAX_SMTP_HOST")
    if not smtp_host:
        return _write_to_outbox(message, prefix=prefix)

    smtp_port = int(os.getenv("SCOLYAX_SMTP_PORT", "587"))
    smtp_user = os.getenv("SCOLYAX_SMTP_USER")
    smtp_password = os.getenv("SCOLYAX_SMTP_PASSWORD", "")
    use_tls = os.getenv("SCOLYAX_SMTP_USE_TLS", "true").lower() != "false"
    smtp_timeout = int(os.getenv("SCOLYAX_SMTP_TIMEOUT", "10"))
    smtp_retries = int(os.getenv("SCOLYAX_SMTP_RETRIES", "1"))

    last_exc = None
    for attempt in range(1, smtp_retries + 1):
        try:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=smtp_timeout) as server:
                if use_tls:
                    server.starttls()
                if smtp_user:
                    server.login(smtp_user, smtp_password)
                server.send_message(message)
            return None
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "Intento %d/%d: fallo al enviar correo vía SMTP (%s:%s): %s",
                attempt,
                smtp_retries,
                smtp_host,
                smtp_port,
                exc,
            )
    # Si llegamos aquí, todos los intentos con STARTTLS fallaron: intentar SMTP_SSL como fallback
    logger.warning(
        "Todos los intentos de envío con STARTTLS fallaron (%s:%s): %s. Intentando SMTP_SSL...",
        smtp_host,
        smtp_port,
        last_exc,
    )
    try:
        ssl_port = int(os.getenv("SCOLYAX_SMTP_SSL_PORT", "465"))
        with smtplib.SMTP_SSL(smtp_host, ssl_port, timeout=smtp_timeout) as ssl_server:
            if smtp_user:
                ssl_server.login(smtp_user, smtp_password)
            ssl_server.send_message(message)
        return None
    except Exception as ssl_exc:
        logger.warning("Fallback SMTP_SSL falló (%s:%s): %s. Guardando en outbox.", smtp_host, ssl_port, ssl_exc)
    try:
        return _write_to_outbox(message, prefix=prefix)
    except Exception as inner:
        logger.exception("No se pudo escribir el correo en outbox: %s", inner)
        raise


def resend_outbox() -> int:
    """Intenta reenviar todos los correos almacenados en el outbox.

    Devuelve el número de correos reenviados correctamente. Si falla el envío,
    los archivos permanecen para reintentos futuros.
    """
    outbox_dir = Path(os.getenv("SCOLYAX_EMAIL_OUTBOX", DATA_DIR / "outbox"))
    if not outbox_dir.exists():
        return 0
    sent = 0
    for path in sorted(outbox_dir.iterdir()):
        if not path.is_file() or not path.name.endswith(".eml"):
            continue
        try:
            raw = path.read_text(encoding="utf-8")
            smtp_host = os.getenv("SCOLYAX_SMTP_HOST")
            smtp_port = int(os.getenv("SCOLYAX_SMTP_PORT", "587"))
            smtp_user = os.getenv("SCOLYAX_SMTP_USER")
            smtp_password = os.getenv("SCOLYAX_SMTP_PASSWORD", "")
            use_tls = os.getenv("SCOLYAX_SMTP_USE_TLS", "true").lower() != "false"
            smtp_timeout = int(os.getenv("SCOLYAX_SMTP_TIMEOUT", "30"))

            # Obtener destinatario desde nombre de archivo si está presente
            try:
                recipient = path.name.split("_")[-1].replace("_at_", "@").replace('.eml','')
            except Exception:
                recipient = None

            with smtplib.SMTP(smtp_host, smtp_port, timeout=smtp_timeout) as server:
                if use_tls:
                    server.starttls()
                if smtp_user:
                    server.login(smtp_user, smtp_password)
                if recipient:
                    server.sendmail(smtp_user or "no-reply@scolyax.local", [recipient], raw)
                else:
                    server.sendmail(smtp_user or "no-reply@scolyax.local", [], raw)
            path.unlink()
            sent += 1
        except Exception as exc:
            logger.debug("No se pudo reenviar %s: %s", path, exc)
            continue
    return sent


def send_registration_email(user: User) -> Path | None:
    """Envía el correo de bienvenida o lo escribe en el buzón local.

    Si no se configuró un servidor SMTP, el mensaje se almacena en la carpeta
    de outbox para poder revisar el contenido durante el desarrollo local.
    """

    message = _build_message(user)
    return _send_message_or_outbox(message, prefix='welcome')


def _build_signin_message(user: User) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = "Inicio de sesión detectado"
    message["To"] = user.email
    message["From"] = os.getenv("SCOLYAX_EMAIL_FROM", "no-reply@scolyax.local")
    # Minimalista y claro
    body = (
        f"Hola {user.display_name or user.email}\n\n"
        "Detectamos un inicio de sesión en tu cuenta. Si fuiste tú, no es necesario hacer nada."
        "\nSi no reconoces esta actividad, revisa tu cuenta en el proveedor.\n\n— Scolyax"
    )
    message.set_content(body)
    return message


def send_signin_email(user: User) -> None | Path:
    """Notifica un inicio de sesión. Usa el mismo backend SMTP que el registro."""
    message = _build_signin_message(user)
    return _send_message_or_outbox(message, prefix='signin')



def _normalize_to_utc(dt: datetime) -> datetime:
    """Asegura que la fecha cuente con información de zona horaria."""

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _build_reminder_message(reminder: Reminder, user: User) -> EmailMessage:
    """Construye un correo con detalles del recordatorio programado."""

    message = EmailMessage()
    message["Subject"] = f"Recordatorio: {reminder.title}"
    message["To"] = user.email
    message["From"] = os.getenv("SCOLYAX_EMAIL_FROM", "no-reply@scolyax.local")

    # Calcular hora local simple (fallback a UTC si no es posible)
    try:
        local_tz = datetime.now().astimezone().tzinfo
        if reminder.remind_at.tzinfo is None:
            local_dt = reminder.remind_at.replace(tzinfo=local_tz)
        else:
            local_dt = reminder.remind_at.astimezone(local_tz)
        scheduled_label = local_dt.strftime("%d %b %Y • %H:%M %Z")
    except Exception:
        scheduled_label = _normalize_to_utc(reminder.remind_at).strftime("%d %b %Y • %H:%M UTC")

    # Mensaje minimalista, directo y fácil de escanear
    lines = [
        f"Hola {user.display_name},",
        "",
        f"{reminder.title}",
        scheduled_label,
    ]
    if reminder.description:
        desc = reminder.description.strip()
        if desc:
            lines.extend(["", desc])

    lines.append("")
    lines.append("— Scolyax")

    body = "\n".join(lines)
    message.set_content(body)
    return message


def send_reminder_email(reminder: Reminder, user: User) -> Path | None:
    """Envía un aviso por correo cuando se programa o actualiza un recordatorio."""

    message = _build_reminder_message(reminder, user)
    return _send_message_or_outbox(message, prefix='reminder')


def _build_reactivation_message(user: User, days_absent: int, is_sad: bool = False) -> EmailMessage:
    """Construye un mensaje de reactivación con plantilla HTML animada."""
    from .email_templates import get_motivation_email_template, get_sad_email_template
    
    message = EmailMessage()
    
    if is_sad:
        message["Subject"] = f"😢 ¿Volverás pronto a Scolyax?"
        html_content = get_sad_email_template(user.display_name or "amigo", days_absent)
    else:
        message["Subject"] = f"🔥 ¡Te extrañamos en Scolyax! - Día {days_absent}"
        html_content = get_motivation_email_template(user.display_name or "amigo", days_absent)
    
    message["To"] = user.email
    message["From"] = os.getenv("SCOLYAX_EMAIL_FROM", "no-reply@scolyax.local")
    
    # Agregar contenido HTML
    message.add_alternative(html_content, subtype='html')
    
    # Fallback texto plano
    if is_sad:
        plain_text = f"""
Hola {user.display_name or "amigo"},

Hace {days_absent} días que no te vemos en Scolyax 😢

¿Qué pasó? ¿Por qué no has vuelto?

Extrañamos verte alcanzar tus metas. Sabemos que la vida puede ser complicada, 
pero incluso 5 minutos al día pueden marcar la diferencia.

¿Nos das otra oportunidad?

Vuelve a Scolyax: {os.getenv("SCOLYAX_FRONTEND_URL", "https://scolyax.vercel.app")}

Siempre estaremos aquí para apoyarte.

— Tu equipo de Scolyax 💜
"""
    else:
        plain_text = f"""
¡Hola {user.display_name or "amigo"}!

Te hemos extrañado estos últimos {days_absent} día{"s" if days_absent > 1 else ""} 🔥

Tu racha de productividad te está esperando. Cada día cuenta, y sabemos que 
tienes metas increíbles por alcanzar.

¡No pierdas tu momentum! Vuelve hoy y continúa construyendo tus hábitos ganadores.

Volver a Scolyax: {os.getenv("SCOLYAX_FRONTEND_URL", "https://scolyax.vercel.app")}

Recuerda: La consistencia es más poderosa que la perfección.
¡Estamos aquí para apoyarte! 💪

— Tu equipo de Scolyax
"""
    
    message.set_content(plain_text)
    return message


def send_reactivation_email(user: User, days_absent: int, is_sad: bool = False) -> Path | None:
    """
    Envía un email de reactivación a un usuario inactivo.
    
    Args:
        user: Usuario al que enviar el email
        days_absent: Número de días que el usuario ha estado ausente
        is_sad: Si True, envía la versión triste (para 3+ días), 
                si False, envía la versión motivacional (para 1-2 días)
    
    Returns:
        Path al archivo en outbox si no se pudo enviar, None si se envió exitosamente
    """
    try:
        message = _build_reactivation_message(user, days_absent, is_sad)
        result = _send_message_or_outbox(message, prefix='reactivation')
        
        if result is None:
            logger.info(f"✅ Email de reactivación enviado a {user.email} ({days_absent} días ausente, sad={is_sad})")
        else:
            logger.info(f"📧 Email de reactivación guardado en outbox para {user.email}")
        
        return result
    except Exception as e:
        logger.error(f"❌ Error enviando email de reactivación a {user.email}: {e}")
        raise
