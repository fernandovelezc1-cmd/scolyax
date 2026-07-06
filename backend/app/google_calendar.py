"""Cliente de Google Calendar API para Scolyax.

Permite obtener, crear y gestionar eventos del calendario de Google del usuario
utilizando las credenciales OAuth ya configuradas.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class GoogleCalendarClient:
    """Cliente para interactuar con Google Calendar API."""
    
    CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
    
    def __init__(self, access_token: str):
        """Inicializa el cliente con el token de acceso OAuth del usuario.
        
        Args:
            access_token: Token de acceso OAuth2 válido con scopes de Calendar
        """
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        }
    
    async def get_events(
        self,
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
        max_results: int = 50,
        calendar_id: str = "primary"
    ) -> List[Dict[str, Any]]:
        """Obtiene eventos del calendario del usuario.
        
        Args:
            time_min: Inicio del rango de tiempo (default: hoy)
            time_max: Fin del rango de tiempo (default: 30 días desde hoy)
            max_results: Número máximo de eventos a retornar
            calendar_id: ID del calendario (default: "primary")
            
        Returns:
            Lista de eventos en formato simplificado
        """
        if time_min is None:
            time_min = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        if time_max is None:
            time_max = time_min + timedelta(days=30)
        
        params = {
            "timeMin": time_min.isoformat(),
            "timeMax": time_max.isoformat(),
            "maxResults": max_results,
            "singleEvents": True,  # Expandir eventos recurrentes
            "orderBy": "startTime",
        }
        
        url = f"{self.CALENDAR_API_BASE}/calendars/{calendar_id}/events"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=self.headers, params=params, timeout=10.0)
                
                if response.status_code == 401:
                    raise HTTPException(
                        status_code=401,
                        detail="Token de acceso inválido o expirado. Por favor, vuelve a autenticarte."
                    )
                
                if response.status_code != 200:
                    logger.error(f"Error al obtener eventos de Google Calendar: {response.status_code} - {response.text}")
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Error al obtener eventos: {response.text}"
                    )
                
                data = response.json()
                events = data.get("items", [])
                
                # Simplificar formato de eventos
                simplified_events = []
                for event in events:
                    simplified = self._simplify_event(event)
                    if simplified:
                        simplified_events.append(simplified)
                
                logger.info(f"✅ Obtenidos {len(simplified_events)} eventos de Google Calendar")
                return simplified_events
                
        except httpx.HTTPError as e:
            logger.error(f"Error de red al obtener eventos: {e}")
            raise HTTPException(
                status_code=503,
                detail="Error de conexión con Google Calendar"
            )
    
    async def create_event(
        self,
        summary: str,
        start: datetime,
        end: datetime,
        description: Optional[str] = None,
        location: Optional[str] = None,
        calendar_id: str = "primary"
    ) -> Dict[str, Any]:
        """Crea un nuevo evento en Google Calendar.
        
        Args:
            summary: Título del evento
            start: Fecha/hora de inicio
            end: Fecha/hora de fin
            description: Descripción opcional del evento
            location: Ubicación opcional
            calendar_id: ID del calendario (default: "primary")
            
        Returns:
            Evento creado en formato simplificado
        """
        event_body = {
            "summary": summary,
            "start": {
                "dateTime": start.isoformat(),
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": end.isoformat(),
                "timeZone": "UTC",
            },
        }
        
        if description:
            event_body["description"] = description
        if location:
            event_body["location"] = location
        
        url = f"{self.CALENDAR_API_BASE}/calendars/{calendar_id}/events"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers=self.headers,
                    json=event_body,
                    timeout=10.0
                )
                
                if response.status_code == 401:
                    raise HTTPException(
                        status_code=401,
                        detail="Token de acceso inválido o expirado"
                    )
                
                if response.status_code not in [200, 201]:
                    logger.error(f"Error al crear evento: {response.status_code} - {response.text}")
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Error al crear evento: {response.text}"
                    )
                
                event = response.json()
                logger.info(f"✅ Evento creado en Google Calendar: {summary}")
                return self._simplify_event(event)
                
        except httpx.HTTPError as e:
            logger.error(f"Error de red al crear evento: {e}")
            raise HTTPException(
                status_code=503,
                detail="Error de conexión con Google Calendar"
            )
    
    async def delete_event(
        self,
        event_id: str,
        calendar_id: str = "primary"
    ) -> bool:
        """Elimina un evento del Google Calendar del usuario.
        
        Args:
            event_id: ID del evento en Google Calendar
            calendar_id: ID del calendario (default: "primary")
            
        Returns:
            True si la eliminación fue exitosa
        """
        url = f"{self.CALENDAR_API_BASE}/calendars/{calendar_id}/events/{event_id}"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    url,
                    headers=self.headers,
                    timeout=10.0
                )
                
                if response.status_code == 401:
                    raise HTTPException(
                        status_code=401,
                        detail="Token de acceso inválido o expirado"
                    )
                
                if response.status_code == 404:
                    logger.warning(f"Evento {event_id} no encontrado en Google Calendar")
                    raise HTTPException(
                        status_code=404,
                        detail=f"Evento no encontrado"
                    )
                
                if response.status_code not in [200, 204]:
                    logger.error(f"Error al eliminar evento: {response.status_code} - {response.text}")
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Error al eliminar evento: {response.text}"
                    )
                
                logger.info(f"✅ Evento {event_id} eliminado de Google Calendar")
                return True
                
        except httpx.HTTPError as e:
            logger.error(f"Error de red al eliminar evento: {e}")
            raise HTTPException(
                status_code=503,
                detail="Error de conexión con Google Calendar"
            )
    
    def _simplify_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Simplifica el formato de evento de Google Calendar API.
        
        Args:
            event: Evento en formato de Google Calendar API
            
        Returns:
            Evento simplificado o None si no es válido
        """
        if not event.get("start"):
            return None
        
        # Manejar eventos de día completo vs. eventos con hora
        start_time = event["start"].get("dateTime") or event["start"].get("date")
        end_time = event["end"].get("dateTime") or event["end"].get("date")
        
        if not start_time or not end_time:
            return None
        
        return {
            "id": event.get("id"),
            "summary": event.get("summary", "Sin título"),
            "description": event.get("description"),
            "location": event.get("location"),
            "start": start_time,
            "end": end_time,
            "all_day": "date" in event["start"],  # True si es evento de día completo
            "color_id": event.get("colorId"),
            "html_link": event.get("htmlLink"),  # Link para abrir en Google Calendar
            "status": event.get("status", "confirmed"),
            "creator_email": event.get("creator", {}).get("email"),
        }


async def get_calendar_client(access_token: str) -> GoogleCalendarClient:
    """Factory function para crear un cliente de Google Calendar.
    
    Args:
        access_token: Token de acceso OAuth2
        
    Returns:
        Instancia de GoogleCalendarClient
    """
    return GoogleCalendarClient(access_token)
