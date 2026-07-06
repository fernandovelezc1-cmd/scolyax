"""
Módulo de notificaciones push para Scolyax.
Gestiona suscripciones y envío de push notifications vía Web Push (VAPID).
"""
import json
import logging
import os
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


def _get_vapid_keys() -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Obtiene las claves VAPID del entorno."""
    public_key = os.getenv("VAPID_PUBLIC_KEY")
    private_key = os.getenv("VAPID_PRIVATE_KEY")
    claims_email = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:admin@scolyax.app")
    return public_key, private_key, claims_email


def is_push_available() -> bool:
    """Verifica si el sistema de push está configurado."""
    pub, priv, _ = _get_vapid_keys()
    return bool(pub and priv)


def get_public_vapid_key() -> Optional[str]:
    """Retorna la clave pública VAPID para el frontend."""
    pub, _, _ = _get_vapid_keys()
    return pub


# ─── Almacenamiento de suscripciones en Supabase ───

def save_push_subscription(user_email: str, subscription: Dict[str, Any]) -> bool:
    """Guarda o actualiza una suscripción push para un usuario.

    Limpia automáticamente los endpoints obsoletos del mismo servicio push
    (FCM, Mozilla, etc.) para evitar que el usuario acumule suscripciones
    desactualizadas y reciba notificaciones duplicadas.
    """
    from .supabase_client import get_supabase_client
    from urllib.parse import urlparse

    try:
        supabase = get_supabase_client()
        endpoint = subscription.get("endpoint", "")

        if not endpoint:
            logger.error(f"❌ Suscripción push sin endpoint para {user_email}")
            return False

        logger.info(f"📬 Guardando suscripción push para {user_email}, endpoint: {endpoint[:60]}...")

        # Usar upsert nativo de Supabase para evitar race conditions entre workers.
        # La tabla tiene UNIQUE constraint en endpoint, así que on_conflict='endpoint'
        # actualiza en lugar de duplicar.
        data = {
            "user_email": user_email,
            "endpoint": endpoint,
            "subscription_json": json.dumps(subscription),
        }
        supabase.table("push_subscriptions").upsert(
            data, on_conflict="endpoint"
        ).execute()
        logger.info(f"✅ Suscripción push guardada (upsert) para {user_email}")

        # ── Eliminar suscripciones obsoletas del mismo servicio push ──
        # Chrome rota su token FCM periódicamente → nuevo endpoint, pero el viejo
        # sigue en la tabla. Si hay 3 endpoints guardados, cada push llega 3 veces.
        # Solución: borrar todos los endpoints del mismo servicio (mismo hostname)
        # que NO sean el recién guardado.
        try:
            new_hostname = urlparse(endpoint).hostname
            all_subs = supabase.table("push_subscriptions").select(
                "id, endpoint"
            ).eq("user_email", user_email).neq("endpoint", endpoint).execute()

            stale_ids = []
            for row in (all_subs.data or []):
                old_hostname = urlparse(row["endpoint"]).hostname
                if old_hostname == new_hostname:
                    stale_ids.append(row["id"])

            if stale_ids:
                supabase.table("push_subscriptions").delete().in_(
                    "id", stale_ids
                ).execute()
                logger.info(
                    f"🧹 {len(stale_ids)} suscripción(es) push obsoleta(s) eliminada(s) "
                    f"para {user_email} (servicio: {new_hostname})"
                )
        except Exception as cleanup_err:
            logger.warning(f"⚠️ Error limpiando suscripciones obsoletas para {user_email}: {cleanup_err}")

        return True
    except Exception as e:
        logger.error(f"❌ Error guardando suscripción push para {user_email}: {e}", exc_info=True)
        return False


def remove_push_subscription(endpoint: str) -> bool:
    """Elimina una suscripción push por su endpoint."""
    from .supabase_client import get_supabase_client

    try:
        supabase = get_supabase_client()
        supabase.table("push_subscriptions").delete().eq(
            "endpoint", endpoint
        ).execute()
        logger.info(f"✅ Suscripción push eliminada: {endpoint[:50]}...")
        return True
    except Exception as e:
        logger.error(f"❌ Error eliminando suscripción push: {e}")
        return False


def get_user_subscriptions(user_email: str) -> List[Dict[str, Any]]:
    """Obtiene todas las suscripciones push de un usuario."""
    from .supabase_client import get_supabase_client

    try:
        supabase = get_supabase_client()
        response = supabase.table("push_subscriptions").select(
            "subscription_json"
        ).eq("user_email", user_email).execute()

        subscriptions = []
        for row in response.data or []:
            try:
                sub = json.loads(row["subscription_json"])
                subscriptions.append(sub)
            except (json.JSONDecodeError, KeyError):
                continue
        return subscriptions
    except Exception as e:
        logger.error(f"❌ Error obteniendo suscripciones push: {e}")
        return []


# ─── Envío de notificaciones push ───

def _classify_endpoint(endpoint: str) -> str:
    """Devuelve el servicio de push según el endpoint URL."""
    if "fcm.googleapis.com" in endpoint or "push.googleapis.com" in endpoint:
        return "FCM (Android/Chrome)"
    if "push.services.mozilla.com" in endpoint:
        return "Mozilla (Firefox)"
    if "notify.windows.com" in endpoint:
        return "WNS (Edge/Windows)"
    if "push.apple.com" in endpoint:
        return "APNs (Safari)"
    return "Desconocido"


def send_push_to_user(user_email: str, title: str, body: str,
                      url: str = "/", tag: str = "scolyax",
                      require_interaction: bool = False,
                      icon: str = "/web-app-manifest-192x192.png") -> int:
    """
    Envía una notificación push a todos los dispositivos de un usuario.
    Retorna el número de notificaciones enviadas exitosamente.
    """
    if not is_push_available():
        logger.debug("Push no configurado, omitiendo envío")
        return 0

    subscriptions = get_user_subscriptions(user_email)
    if not subscriptions:
        logger.debug(f"No hay suscripciones push para {user_email}")
        return 0

    sent = 0
    for subscription in subscriptions:
        if _send_push(subscription, title, body, url, tag, require_interaction, icon):
            sent += 1

    logger.info(f"📬 Push enviados a {user_email}: {sent}/{len(subscriptions)}")
    return sent


def _send_push(subscription: Dict[str, Any], title: str, body: str,
               url: str = "/", tag: str = "scolyax",
               require_interaction: bool = False,
               icon: str = "/web-app-manifest-192x192.png",
               ttl: int = 86400,
               include_topic: bool = True) -> bool:
    """Envía una notificación push a una suscripción específica."""
    try:
        from pywebpush import webpush, WebPushException
        from urllib.parse import urlparse

        _, private_key, claims_email = _get_vapid_keys()

        # Validar estructura de la suscripción
        endpoint = subscription.get("endpoint", "")
        keys = subscription.get("keys", {})
        p256dh = keys.get("p256dh", "")
        auth = keys.get("auth", "")

        if not endpoint or not p256dh or not auth:
            logger.error(
                f"❌ Suscripción push incompleta: "
                f"endpoint={'✅' if endpoint else '❌'}, "
                f"p256dh={'✅' if p256dh else '❌'}, "
                f"auth={'✅' if auth else '❌'}"
            )
            if endpoint:
                remove_push_subscription(endpoint)
            return False

        # Asegurar que claims_email tenga prefijo mailto:
        if claims_email and not claims_email.startswith("mailto:"):
            claims_email = f"mailto:{claims_email}"

        # Extraer audience (origin) del endpoint para VAPID
        parsed = urlparse(endpoint)
        aud = f"{parsed.scheme}://{parsed.netloc}"

        # Construir subscription_info limpio (solo los campos que pywebpush necesita)
        clean_sub = {
            "endpoint": endpoint,
            "keys": {
                "p256dh": p256dh,
                "auth": auth,
            }
        }

        payload = json.dumps({
            "title": title,
            "body": body,
            "icon": icon,
            "badge": "/web-app-manifest-192x192.png",
            "tag": tag,
            "url": url,
            "requireInteraction": require_interaction,
            "timestamp": __import__("time").time(),
            "actions": [
                {"action": "open", "title": "Abrir"},
                {"action": "close", "title": "Descartar"}
            ]
        })

        # Intentar con ambos content encodings (aes128gcm es el estándar,
        # aesgcm es el legacy que algunos push services todavía requieren)
        encodings = ["aes128gcm", "aesgcm"]
        last_error = None

        # Construir headers — Topic debe ser solo [A-Za-z0-9\-_] y ≤32 chars
        import re as _re
        safe_topic = _re.sub(r'[^A-Za-z0-9\-_]', '', tag or 'scolyax')[:32] or 'scolyax'
        extra_headers = {"Urgency": "high"}
        if include_topic:
            extra_headers["Topic"] = safe_topic

        for encoding in encodings:
            try:
                logger.info(
                    f"📨 Enviando push: endpoint={endpoint[:60]}..., "
                    f"aud={aud}, encoding={encoding}, ttl={ttl}, topic={safe_topic if include_topic else 'none'}"
                )

                response = webpush(
                    subscription_info=clean_sub,
                    data=payload,
                    vapid_private_key=private_key,
                    vapid_claims={
                        "sub": claims_email,
                        "aud": aud,
                    },
                    content_encoding=encoding,
                    ttl=ttl,
                    timeout=15,
                    headers=extra_headers,
                )

                status_code = getattr(response, 'status_code', '?')
                logger.info(f"✅ Push enviado OK con encoding={encoding}, status={status_code}")
                return True

            except WebPushException as wpe:
                last_error = wpe
                resp = getattr(wpe, 'response', None)
                status = getattr(resp, 'status_code', 0) if resp else 0

                # Si es 400/403, probar con el siguiente encoding
                if status in (400, 403) and encoding != encodings[-1]:
                    logger.warning(
                        f"⚠️ Push falló con encoding={encoding} (HTTP {status}), "
                        f"reintentando con {encodings[encodings.index(encoding) + 1]}..."
                    )
                    continue
                # Si no, salir del loop
                break

        # Si llegamos aquí, todos los encodings fallaron
        e = last_error
        error_str = str(e) if e else "unknown"
        resp = getattr(e, 'response', None) if e else None
        status = getattr(resp, 'status_code', '?') if resp else '?'
        resp_body = ''
        if resp is not None:
            try:
                resp_body = resp.text[:500] if resp.text else '(empty)'
            except Exception:
                resp_body = '(could not read)'
        resp_headers = ''
        if resp is not None:
            try:
                resp_headers = str(dict(resp.headers))[:500]
            except Exception:
                resp_headers = '(could not read)'

        # Si la suscripción expiró o es inválida, eliminarla
        if "410" in error_str or "404" in error_str:
            logger.info(f"🗑️ Suscripción expirada, eliminando: {endpoint[:50]}...")
            remove_push_subscription(endpoint)
        else:
            logger.error(
                f"❌ Error enviando push (todos los encodings fallaron):\n"
                f"   Error: {error_str}\n"
                f"   HTTP status: {status}\n"
                f"   Response body: {resp_body}\n"
                f"   Response headers: {resp_headers}\n"
                f"   Endpoint: {endpoint[:100]}\n"
                f"   VAPID private key length: {len(private_key or '')}\n"
                f"   VAPID claims email: {claims_email}\n"
                f"   Audience: {aud}\n"
                f"   p256dh length: {len(p256dh)}\n"
                f"   auth length: {len(auth)}"
            )
        return False

    except Exception as e:
        logger.error(f"❌ Error inesperado en _send_push: {e}", exc_info=True)
        return False
