"""Clientes OAuth para Google y Microsoft con almacenamiento de estado temporal."""

from __future__ import annotations

from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / '.env')

import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from urllib.parse import urlencode, urlparse

try:  # pragma: no cover - permite ejecutar pruebas sin instalar la dependencia
    import httpx
except ModuleNotFoundError:  # pragma: no cover
    httpx = None  # type: ignore
from fastapi import HTTPException
import logging

from .models import AuthProvider
from .storage import load_oauth_states, save_oauth_states

logger = logging.getLogger(__name__)

# Global HTTP client with connection pooling for OAuth calls
_httpx_client: httpx.AsyncClient | None = None

async def get_http_client() -> httpx.AsyncClient:
    """Get or create a global HTTP client with connection pooling and HTTP/2 support.
    
    This reuses connections across multiple OAuth requests, improving performance.
    """
    global _httpx_client
    if _httpx_client is None:
        if httpx is None:
            raise HTTPException(
                status_code=503,
                detail="Instala la dependencia `httpx` para completar la autenticación.",
            )
        _httpx_client = httpx.AsyncClient(
            timeout=8.0,  # 8 segundos timeout (reducido de 15s)
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
            http2=True,  # HTTP/2 para mejor rendimiento
        )
        logger.info("🌐 Global HTTP client created with connection pooling")
    return _httpx_client


@dataclass
class OAuthConfig:
    """Configuración básica necesaria para interactuar con un proveedor OAuth."""

    client_id: str
    client_secret: str
    redirect_uri: str
    scope: str


DEFAULT_FRONTEND_URL = "http://localhost:5173"


STUB_DEFAULTS = {
    "SCOLYAX_GOOGLE_CLIENT_ID": "stub-google-client-id",
    "SCOLYAX_GOOGLE_CLIENT_SECRET": "stub-google-client-secret",
    "SCOLYAX_GOOGLE_REDIRECT_URI": "http://localhost:8000/auth/google/callback",
    "SCOLYAX_MICROSOFT_CLIENT_ID": "stub-microsoft-client-id",
    "SCOLYAX_MICROSOFT_CLIENT_SECRET": "stub-microsoft-client-secret",
    "SCOLYAX_MICROSOFT_REDIRECT_URI": "http://localhost:8000/auth/microsoft/callback",
    "SCOLYAX_FRONTEND_URL": DEFAULT_FRONTEND_URL,
}


def _env(key: str) -> str:
    """Recupera una variable de entorno y provee valores seguros en modo stub."""

    value = os.getenv(key)
    if value:
        return value
    if is_stub_mode():
        stub_default = STUB_DEFAULTS.get(key)
        if stub_default:
            return stub_default
    raise HTTPException(
        status_code=503,
        detail=(
            "Falta configurar la variable de entorno "
            f"`{key}` para habilitar el inicio de sesión con proveedores externos."
        ),
    )


def _build_config(prefix: str, default_scope: str) -> OAuthConfig:
    """Construye la configuración de OAuth a partir de variables de entorno."""

    return OAuthConfig(
        client_id=_env(f"SCOLYAX_{prefix}_CLIENT_ID"),
        client_secret=_env(f"SCOLYAX_{prefix}_CLIENT_SECRET"),
        redirect_uri=_env(f"SCOLYAX_{prefix}_REDIRECT_URI"),
        scope=os.getenv(f"SCOLYAX_{prefix}_SCOPE", default_scope),
    )


def is_stub_mode() -> bool:
    """Indica si las llamadas a los proveedores deben simularse (modo pruebas)."""

    return os.getenv("SCOLYAX_OAUTH_MODE", "").lower() == "stub"


class OAuthStateStore:
    """Gestiona los estados emitidos para prevenir ataques CSRF en OAuth."""

    def __init__(self, ttl_seconds: int | None = None) -> None:
        self._ttl = ttl_seconds or int(os.getenv("SCOLYAX_OAUTH_STATE_TTL", "900"))

    def issue(self, payload: Dict[str, Any]) -> str:
        """Genera un nuevo estado y lo guarda con una marca de tiempo."""

        state = secrets.token_urlsafe(32)
        states = load_oauth_states()
        states[state] = {
            **payload,
            "issued_at": datetime.now(timezone.utc).isoformat(),
        }
        save_oauth_states(states)
        return state

    def validate(self, state: str) -> Dict[str, Any]:
        """Valida el estado sin eliminarlo, útil para callbacks que pueden ocurrir múltiples veces."""

        states = load_oauth_states()
        payload = states.get(state)
        if payload is None:
            raise HTTPException(status_code=400, detail="Estado de autenticación inválido o expirado.")

        issued_raw = payload.get("issued_at")
        if issued_raw:
            try:
                issued_at = datetime.fromisoformat(issued_raw)
            except ValueError:
                issued_at = datetime.now(timezone.utc)
        else:
            issued_at = datetime.now(timezone.utc)

        if issued_at.tzinfo is None:
            issued_at = issued_at.replace(tzinfo=timezone.utc)

        if datetime.now(timezone.utc) - issued_at > timedelta(seconds=self._ttl):
            raise HTTPException(status_code=400, detail="El estado de autenticación ha caducado. Intenta de nuevo.")

        return payload

    def consume(self, state: str) -> Dict[str, Any]:
        """Recupera y elimina el estado validando que no haya caducado."""

        states = load_oauth_states()
        payload = states.pop(state, None)
        save_oauth_states(states)
        if payload is None:
            raise HTTPException(status_code=400, detail="Estado de autenticación inválido o expirado.")

        issued_raw = payload.get("issued_at")
        if issued_raw:
            try:
                issued_at = datetime.fromisoformat(issued_raw)
            except ValueError:
                issued_at = datetime.now(timezone.utc)
        else:
            issued_at = datetime.now(timezone.utc)

        if issued_at.tzinfo is None:
            issued_at = issued_at.replace(tzinfo=timezone.utc)

        if datetime.now(timezone.utc) - issued_at > timedelta(seconds=self._ttl):
            raise HTTPException(status_code=400, detail="El estado de autenticación ha caducado. Intenta de nuevo.")

        return payload


class OAuthClient:
    """Cliente genérico para construir URLs y consultar tokens/perfiles."""

    authorize_url: str
    token_url: str
    userinfo_url: str

    def __init__(self, provider: AuthProvider, config: OAuthConfig) -> None:
        self.provider = provider
        self.config = config

    def authorize_params(self) -> Dict[str, Any]:
        """Parámetros por defecto para la URL de autorización."""

        return {
            "client_id": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "response_type": "code",
            "scope": self.config.scope,
        }

    def build_authorize_url(self, state: str, *, prompt: str | None = None) -> str:
        """Devuelve la URL de autorización lista para redirigir al proveedor."""

        params = self.authorize_params()
        params["state"] = state
        if prompt:
            params["prompt"] = prompt
        query = urlencode(params, doseq=True)
        return f"{self.authorize_url}?{query}"

    async def exchange_code(self, code: str) -> Dict[str, Any]:
        """Intercambia el código de autorización por tokens de acceso/refresco.
        
        Optimización: Usa cliente HTTP global con connection pooling.
        """

        if is_stub_mode():
            return {"access_token": "stub", "token_type": "Bearer"}

        data = {
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
            "code": code,
            "redirect_uri": self.config.redirect_uri,
            "grant_type": "authorization_code",
        }

        try:
            client = await get_http_client()
            logger.debug(f"⏱️ Exchanging code with {self.provider.value}...")
            response = await client.post(self.token_url, data=data, headers={"Accept": "application/json"})
        except httpx.TimeoutException:
            logger.error(f"❌ Timeout exchanging code with {self.provider.value}")
            raise HTTPException(status_code=504, detail="Timeout al conectar con el proveedor OAuth. Intenta de nuevo.")
        except Exception as e:
            logger.error(f"❌ Error exchanging code: {e}")
            raise HTTPException(status_code=503, detail="Error al conectar con el proveedor OAuth.")

        if response.status_code >= 400:
            logger.error(f"❌ OAuth provider returned {response.status_code}: {response.text[:200]}")
            raise HTTPException(status_code=400, detail="No se pudo intercambiar el código de autorización.")

        return response.json()

    async def get_valid_tokens(self, email: str) -> Dict[str, Any]:
        """Obtiene tokens válidos para el usuario, refrescando si es necesario."""
        # En modo stub, devolver token ficticio
        if is_stub_mode():
            return {"access_token": "stub-token", "token_type": "Bearer"}

        # TODO: Implementar almacenamiento persistente de tokens
        # Por ahora, necesitamos que el usuario reautorize cada vez
        return {}

    async def fetch_profile(self, tokens: Dict[str, Any], state_payload: Dict[str, Any]) -> Dict[str, Any]:
        """Recupera la información básica del usuario autenticado.
        
        Optimización: Usa cliente HTTP global con connection pooling.
        """

        if is_stub_mode():
            email = state_payload.get("stub_email") or state_payload.get("email")
            if not email:
                raise HTTPException(
                    status_code=400,
                    detail="Falta proporcionar `stub_email` para la autenticación simulada.",
                )
            name = state_payload.get("display_name") or state_payload.get("stub_name") or email.split("@", 1)[0]
            return {"email": email, "name": name}

        access_token = tokens.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="El proveedor no devolvió un token de acceso válido.")

        try:
            client = await get_http_client()
            logger.debug(f"⏱️ Fetching profile from {self.provider.value}...")
            response = await client.get(
                self.userinfo_url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                },
            )
        except httpx.TimeoutException:
            logger.error(f"❌ Timeout fetching profile from {self.provider.value}")
            raise HTTPException(status_code=504, detail="Timeout al obtener el perfil del proveedor. Intenta de nuevo.")
        except Exception as e:
            logger.error(f"❌ Error fetching profile: {e}")
            raise HTTPException(status_code=503, detail="Error al conectar con el proveedor OAuth.")

        if response.status_code >= 400:
            logger.error(f"❌ OAuth provider returned {response.status_code}: {response.text[:200]}")
            raise HTTPException(status_code=400, detail="No se pudo obtener el perfil del proveedor externo.")

        return response.json()

        return response.json()


class GoogleOAuthClient(OAuthClient):
    """Cliente específico para Google OAuth 2.0."""

    authorize_url = "https://accounts.google.com/o/oauth2/v2/auth"
    token_url = "https://oauth2.googleapis.com/token"
    userinfo_url = "https://openidconnect.googleapis.com/v1/userinfo"

    # Scopes básicos para login (sin Calendar para evitar la pantalla de app no verificada)
    LOGIN_SCOPE = "openid email profile"
    # Scopes extendidos para Google Calendar
    CALENDAR_SCOPE = " ".join([
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar"
    ])

    def __init__(self, include_calendar_scopes: bool = False) -> None:
        scope = self.CALENDAR_SCOPE if include_calendar_scopes else self.LOGIN_SCOPE
        super().__init__(
            AuthProvider.GOOGLE,
            _build_config("GOOGLE", scope),
        )
        self._include_calendar = include_calendar_scopes

    def authorize_params(self) -> Dict[str, Any]:  # noqa: D401 - explicación en docstring base
        params = super().authorize_params()
        if self._include_calendar:
            params.update({
                "access_type": "offline",
                "include_granted_scopes": "true",
                "prompt": "consent"  # Asegurar que obtenemos refresh_token
            })
        return params


class MicrosoftOAuthClient(OAuthClient):
    """Cliente específico para Microsoft Azure (cuentas Outlook)."""

    authorize_url = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    userinfo_url = "https://graph.microsoft.com/v1.0/me"

    def __init__(self) -> None:
        super().__init__(
            AuthProvider.MICROSOFT,
            _build_config("MICROSOFT", "openid email profile User.Read Calendars.ReadWrite offline_access"),
        )

    def authorize_params(self) -> Dict[str, Any]:  # noqa: D401 - explicación en docstring base
        params = super().authorize_params()
        params.update({
            "response_mode": "query",
            "prompt": "select_account"
        })
        return params


def get_oauth_client(provider: AuthProvider) -> OAuthClient:
    """Devuelve el cliente correspondiente al proveedor solicitado."""

    if provider is AuthProvider.GOOGLE:
        return GoogleOAuthClient()
    if provider is AuthProvider.MICROSOFT:
        return MicrosoftOAuthClient()
    raise HTTPException(status_code=400, detail="Proveedor de autenticación no soportado.")


def get_google_client() -> GoogleOAuthClient:
    """Devuelve el cliente de Google OAuth."""
    return GoogleOAuthClient()


def get_google_calendar_client() -> GoogleOAuthClient:
    """Devuelve el cliente de Google OAuth CON scopes de Calendar."""
    return GoogleOAuthClient(include_calendar_scopes=True)


def resolve_frontend_base_url(candidate: str | None = None) -> str:
    """Obtiene la URL base del frontend y ofrece fallbacks seguros para desarrollo."""

    value = os.getenv("SCOLYAX_FRONTEND_URL")
    if value:
        return value.rstrip("/")

    if candidate:
        parsed = urlparse(candidate)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    if is_stub_mode():
        return STUB_DEFAULTS["SCOLYAX_FRONTEND_URL"].rstrip("/")

    fallback = os.getenv("SCOLYAX_DEFAULT_FRONTEND_URL", DEFAULT_FRONTEND_URL)
    return fallback.rstrip("/")
