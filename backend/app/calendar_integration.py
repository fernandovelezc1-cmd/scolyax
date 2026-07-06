"""Integración con Google Calendar y Outlook Calendar para recordatorios."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException

from .models import AuthProvider, Reminder, Session
from .oauth import get_oauth_client
from .storage import save_token_for_email

logger = logging.getLogger(__name__)

GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
MICROSOFT_GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"


async def create_calendar_event(reminder: Reminder, session: Session, tokens: Dict[str, Any], user_email: Optional[str] = None) -> Optional[str]:
    """Crea un evento en Google Calendar o Outlook Calendar según el proveedor."""
    if reminder.delivery_provider == AuthProvider.GOOGLE:
        return await _create_google_calendar_event(reminder, session, tokens, user_email)
    elif reminder.delivery_provider == AuthProvider.MICROSOFT:
        return await _create_outlook_calendar_event(reminder, session, tokens, user_email)
    return None


async def _create_google_calendar_event(reminder: Reminder, session: Session, tokens: Dict[str, Any], user_email: Optional[str] = None) -> Optional[str]:
    """Crea un evento en Google Calendar para el recordatorio especificado."""

    if not tokens or not tokens.get("access_token"):
        logger.warning("No hay token de acceso disponible para crear evento en Calendar")
        raise HTTPException(
            status_code=401, 
            detail="Necesitas volver a autorizar el acceso a Google Calendar. Por favor, cierra sesión y vuelve a iniciar sesión."
        )

    # Verificar si tenemos los scopes necesarios
    required_scopes = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events"
    ]
    
    # Obtener los scopes del token (si están disponibles)
    token_scopes = tokens.get("scope", "").split(" ")
    
    missing_scopes = [scope for scope in required_scopes if scope not in token_scopes]
    if missing_scopes:
        logger.debug(f"Faltan scopes de Calendar (el usuario no ha conectado su calendario): {missing_scopes}")
        # No lanzar error — simplemente retornar None para que se omita silenciosamente
        return None

    # Configurar la hora de inicio y fin (por defecto 5min)
    start_time = reminder.remind_at
    if start_time.tzinfo is None:
        # Si no tiene zona horaria, asumimos que es hora local
        local_tz = datetime.now().astimezone().tzinfo
        start_time = start_time.replace(tzinfo=local_tz)
    end_time = start_time + timedelta(minutes=5)

    event = {
        "summary": reminder.title,
        "description": reminder.description or "",
        "start": {
            "dateTime": start_time.isoformat(),
                "timeZone": str(start_time.tzinfo)
        },
        "end": {
            "dateTime": end_time.isoformat(),
                "timeZone": str(end_time.tzinfo)
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                    {"method": "email", "minutes": 0},     # Notificar por email al momento
                    {"method": "popup", "minutes": 10},    # Popup 10 minutos antes
                    {"method": "email", "minutes": 1440}   # Email recordatorio 24h antes
            ]
        }
    }

    try:
        headers = {
            "Authorization": f"Bearer {tokens['access_token']}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

        # Logging útil para diagnóstico: evento y cabeceras (ocultando Authorization)
        try:
            logged_headers = {k: ("REDACTED" if k.lower() == "authorization" else v) for k, v in headers.items()}
            logger.debug("Calendar event payload: %s", event)
            logger.debug("Calendar request headers: %s", logged_headers)
        except Exception:
            # No queremos que el logging rompa la ejecución
            logger.debug("No se pudo volcar payload de evento para logging")

        # Crear el evento en el calendario primario del usuario
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{GOOGLE_CALENDAR_API_BASE}/calendars/primary/events",
                json=event,
                headers=headers
            )
            
            if response.status_code == 401 and tokens.get("refresh_token"):
                # Token expirado, intentar refrescar
                oauth_client = get_oauth_client(AuthProvider.GOOGLE)
                new_tokens = await refresh_access_token(oauth_client, tokens["refresh_token"])
                if new_tokens and new_tokens.get("access_token"):
                    # Guardar tokens si se pasó el email
                    try:
                        if user_email:
                            # conservar refresh_token si el endpoint no lo devuelve
                            if not new_tokens.get("refresh_token") and tokens.get("refresh_token"):
                                new_tokens["refresh_token"] = tokens.get("refresh_token")
                            save_token_for_email(user_email, {**tokens, **new_tokens})
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("No se pudieron guardar los tokens refrescados: %s", exc)
                    # Reintentar con el nuevo token usando httpx
                    headers["Authorization"] = f"Bearer {new_tokens['access_token']}"
                    async with httpx.AsyncClient(timeout=30.0) as retry_client:
                        response = await retry_client.post(
                            f"{GOOGLE_CALENDAR_API_BASE}/calendars/primary/events",
                            json=event,
                            headers=headers,
                        )

        if response.status_code >= 400:
            # Intentar parsear la respuesta JSON si es posible
            try:
                error_response = response.json()
            except Exception:
                error_response = {"raw": response.text}

            # Log completo para diagnóstico (sin tokens)
            try:
                logger.error("Error creando evento en Calendar. status=%s, response=%s", response.status_code, error_response)
                logger.debug("Response headers: %s", dict(response.headers))
            except Exception:
                logger.error("Error creando evento en Calendar: status=%s (no se pudo volcar body)", response.status_code)

            error_detail = ""
            if isinstance(error_response, dict):
                error_detail = error_response.get("error", {}).get("message") or error_response.get("raw") or str(error_response)

            if isinstance(error_detail, str) and ("API has not been used" in error_detail or "is disabled" in error_detail):
                # Error específico cuando la API no está habilitada
                raise HTTPException(
                    status_code=400,
                    detail="La API de Google Calendar no está habilitada. Por favor, contacte al administrador del sistema."
                )
            # Permisos denegados
            if response.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail="No tienes permisos suficientes para crear eventos en Google Calendar. Intenta cerrar sesión y volver a iniciar sesión."
                )

            raise HTTPException(
                status_code=response.status_code,
                detail=f"No se pudo crear el evento en Google Calendar: {error_detail or 'Error desconocido'}"
            )

        created_event = response.json()
        return created_event.get("id")  # Devolver el ID del evento creado

    except Exception as e:
        logger.exception("Error inesperado creando evento en Calendar: %s", e)
        return None


async def refresh_access_token(client: Any, refresh_token: str) -> Dict[str, Any]:
    """Refresca el token de acceso usando el refresh token."""
    try:
        data = {
            "client_id": client.config.client_id,
            "client_secret": client.config.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
        
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            response = await http_client.post(
                "https://oauth2.googleapis.com/token",
                data=data
            )
            
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.error("Error refrescando token: %s", e)
    
    return {}


async def _create_outlook_calendar_event(reminder: Reminder, session: Session, tokens: Dict[str, Any], user_email: Optional[str] = None) -> Optional[str]:
    """Crea un evento en Outlook Calendar (Microsoft Graph API) para el recordatorio especificado."""
    if not tokens or not tokens.get("access_token"):
        logger.warning("No hay token de acceso disponible para crear evento en Outlook Calendar")
        raise HTTPException(
            status_code=401,
            detail="Necesitas volver a autorizar el acceso a Outlook Calendar. Por favor, cierra sesión y vuelve a iniciar sesión."
        )

    # Configurar la hora de inicio y fin (por defecto 5min)
    start_time = reminder.remind_at
    if start_time.tzinfo is None:
        # Si no tiene zona horaria, asumimos que es hora local
        local_tz = datetime.now().astimezone().tzinfo
        start_time = start_time.replace(tzinfo=local_tz)
    end_time = start_time + timedelta(minutes=5)

    # Formato de evento para Microsoft Graph API
    event = {
        "subject": reminder.title,
        "body": {
            "contentType": "Text",
            "content": reminder.description or ""
        },
        "start": {
            "dateTime": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "timeZone": str(start_time.tzinfo) or "UTC"
        },
        "end": {
            "dateTime": end_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "timeZone": str(end_time.tzinfo) or "UTC"
        },
        "isReminderOn": True,
        "reminderMinutesBeforeStart": 15
    }

    try:
        headers = {
            "Authorization": f"Bearer {tokens['access_token']}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

        # Logging para diagnóstico
        try:
            logged_headers = {k: ("REDACTED" if k.lower() == "authorization" else v) for k, v in headers.items()}
            logger.debug("Outlook Calendar event payload: %s", event)
            logger.debug("Outlook Calendar request headers: %s", logged_headers)
        except Exception:
            logger.debug("No se pudo volcar payload de evento para logging")

        # Crear el evento en el calendario primario del usuario
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{MICROSOFT_GRAPH_API_BASE}/me/events",
                json=event,
                headers=headers
            )

            if response.status_code == 401 and tokens.get("refresh_token"):
                # Token expirado, intentar refrescar
                oauth_client = get_oauth_client(AuthProvider.MICROSOFT)
                new_tokens = await refresh_microsoft_access_token(oauth_client, tokens["refresh_token"])
                if new_tokens and new_tokens.get("access_token"):
                    # Guardar tokens si se pasó el email
                    try:
                        if user_email:
                            # conservar refresh_token si el endpoint no lo devuelve
                            if not new_tokens.get("refresh_token") and tokens.get("refresh_token"):
                                new_tokens["refresh_token"] = tokens.get("refresh_token")
                            save_token_for_email(user_email, {**tokens, **new_tokens})
                    except Exception as exc:
                        logger.warning("No se pudieron guardar los tokens refrescados: %s", exc)
                    # Reintentar con el nuevo token
                    headers["Authorization"] = f"Bearer {new_tokens['access_token']}"
                    async with httpx.AsyncClient(timeout=30.0) as retry_client:
                        response = await retry_client.post(
                            f"{MICROSOFT_GRAPH_API_BASE}/me/events",
                            json=event,
                            headers=headers
                        )

        if response.status_code >= 400:
            # Intentar parsear la respuesta JSON si es posible
            try:
                error_response = response.json()
            except Exception:
                error_response = {"raw": response.text}

            # Log completo para diagnóstico
            try:
                logger.error("Error creando evento en Outlook Calendar. status=%s, response=%s", response.status_code, error_response)
                logger.debug("Response headers: %s", dict(response.headers))
            except Exception:
                logger.error("Error creando evento en Outlook Calendar: status=%s (no se pudo volcar body)", response.status_code)

            error_detail = ""
            if isinstance(error_response, dict):
                error_detail = error_response.get("error", {}).get("message") or str(error_response)

            # Permisos denegados
            if response.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail="No tienes permisos suficientes para crear eventos en Outlook Calendar. Intenta cerrar sesión y volver a iniciar sesión."
                )

            raise HTTPException(
                status_code=response.status_code,
                detail=f"No se pudo crear el evento en Outlook Calendar: {error_detail or 'Error desconocido'}"
            )

        created_event = response.json()
        return created_event.get("id")  # Devolver el ID del evento creado

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error inesperado creando evento en Outlook Calendar: %s", e)
        return None


async def refresh_microsoft_access_token(client: Any, refresh_token: str) -> Dict[str, Any]:
    """Refresca el token de acceso de Microsoft usando el refresh token."""
    try:
        data = {
            "client_id": client.config.client_id,
            "client_secret": client.config.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": client.config.scope
        }

        async with httpx.AsyncClient(timeout=15.0) as http_client:
            response = await http_client.post(
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                data=data
            )

            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.error("Error refrescando token de Microsoft: %s", e)

    return {}


async def delete_calendar_event(reminder: Reminder, tokens: Dict[str, Any], user_email: Optional[str] = None) -> bool:
    """Elimina un evento de Google Calendar o Outlook Calendar según el proveedor."""
    if not reminder.calendar_event_id:
        logger.info("No hay event_id para eliminar del calendario")
        return True
    
    if reminder.delivery_provider == AuthProvider.GOOGLE:
        return await _delete_google_calendar_event(reminder.calendar_event_id, tokens, user_email)
    elif reminder.delivery_provider == AuthProvider.MICROSOFT:
        return await _delete_outlook_calendar_event(reminder.calendar_event_id, tokens, user_email)
    
    return False


async def _delete_google_calendar_event(event_id: str, tokens: Dict[str, Any], user_email: Optional[str] = None) -> bool:
    """Elimina un evento de Google Calendar."""
    if not tokens or not tokens.get("access_token"):
        logger.warning("No hay token de acceso para eliminar evento de Google Calendar")
        return False

    try:
        headers = {
            "Authorization": f"Bearer {tokens['access_token']}",
            "Accept": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/{event_id}",
                headers=headers
            )

            # Token expirado, intentar refrescar
            if response.status_code == 401 and tokens.get("refresh_token"):
                new_tokens = await refresh_access_token(tokens["refresh_token"])
                if new_tokens and new_tokens.get("access_token"):
                    if user_email:
                        try:
                            if not new_tokens.get("refresh_token"):
                                new_tokens["refresh_token"] = tokens.get("refresh_token")
                            save_token_for_email(user_email, {**tokens, **new_tokens})
                        except Exception as exc:
                            logger.warning("No se pudieron guardar tokens: %s", exc)
                    
                    headers["Authorization"] = f"Bearer {new_tokens['access_token']}"
                    async with httpx.AsyncClient(timeout=30.0) as retry_client:
                        response = await retry_client.delete(
                            f"{GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/{event_id}",
                            headers=headers
                        )

            if response.status_code == 204 or response.status_code == 410:  # 204 = eliminado, 410 = ya no existe
                logger.info("Evento de Google Calendar eliminado: %s", event_id)
                return True
            elif response.status_code == 404:
                logger.info("Evento de Google Calendar no encontrado (ya eliminado): %s", event_id)
                return True
            else:
                logger.warning("Error eliminando evento de Google Calendar: %s", response.status_code)
                return False

    except Exception as e:
        logger.exception("Error inesperado eliminando evento de Google Calendar: %s", e)
        return False


async def _delete_outlook_calendar_event(event_id: str, tokens: Dict[str, Any], user_email: Optional[str] = None) -> bool:
    """Elimina un evento de Outlook Calendar."""
    if not tokens or not tokens.get("access_token"):
        logger.warning("No hay token de acceso para eliminar evento de Outlook Calendar")
        return False

    try:
        headers = {
            "Authorization": f"Bearer {tokens['access_token']}",
            "Accept": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{MICROSOFT_GRAPH_API_BASE}/me/events/{event_id}",
                headers=headers
            )

            # Token expirado, intentar refrescar
            if response.status_code == 401 and tokens.get("refresh_token"):
                oauth_client = get_oauth_client(AuthProvider.MICROSOFT)
                new_tokens = await refresh_microsoft_access_token(oauth_client, tokens["refresh_token"])
                if new_tokens and new_tokens.get("access_token"):
                    if user_email:
                        try:
                            if not new_tokens.get("refresh_token"):
                                new_tokens["refresh_token"] = tokens.get("refresh_token")
                            save_token_for_email(user_email, {**tokens, **new_tokens})
                        except Exception as exc:
                            logger.warning("No se pudieron guardar tokens: %s", exc)
                    
                    headers["Authorization"] = f"Bearer {new_tokens['access_token']}"
                    async with httpx.AsyncClient(timeout=30.0) as retry_client:
                        response = await retry_client.delete(
                            f"{MICROSOFT_GRAPH_API_BASE}/me/events/{event_id}",
                            headers=headers
                        )

            if response.status_code == 204 or response.status_code == 410:  # 204 = eliminado, 410 = ya no existe
                logger.info("Evento de Outlook Calendar eliminado: %s", event_id)
                return True
            elif response.status_code == 404:
                logger.info("Evento de Outlook Calendar no encontrado (ya eliminado): %s", event_id)
                return True
            else:
                logger.warning("Error eliminando evento de Outlook Calendar: %s", response.status_code)
                return False

    except Exception as e:
        logger.exception("Error inesperado eliminando evento de Outlook Calendar: %s", e)
        return False