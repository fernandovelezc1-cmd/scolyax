"""Script para refrescar el access token de Google Calendar usando el refresh token."""
import asyncio
import httpx
from app.supabase_storage import load_tokens, save_token_for_email
from app.oauth import get_google_client

async def refresh_google_token(email: str):
    """Refresca el access token de Google para un email dado."""
    print(f"🔄 Refrescando token para {email}...")
    
    # Cargar tokens actuales
    tokens = load_tokens()
    user_token = tokens.get(email)
    
    if not user_token:
        print(f"❌ No se encontraron tokens para {email}")
        print(f"   Emails disponibles: {list(tokens.keys())}")
        return
        
    refresh_token = user_token.get("refresh_token")
    if not refresh_token:
        print(f"❌ No se encontró refresh_token para {email}")
        return
    
    # Obtener cliente de Google OAuth
    google_client = get_google_client()
    
    # Refrescar token
    print("   Llamando a Google OAuth para refrescar...")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": google_client.client_id,
                "client_secret": google_client.client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
        )
        
        if response.status_code != 200:
            print(f"❌ Error al refrescar token: {response.status_code}")
            print(f"   Response: {response.text}")
            return
            
        new_tokens = response.json()
        print("✅ Token refrescado exitosamente")
        
        # Actualizar tokens (mantener el refresh_token original)
        updated_tokens = {
            **user_token,
            "access_token": new_tokens['access_token'],
            "expires_in": new_tokens.get('expires_in', 3599),
            "token_type": new_tokens.get('token_type', 'Bearer')
        }
        
        # Guardar tokens actualizados
        save_token_for_email(email, updated_tokens)
        print(f"✅ Tokens actualizados guardados para {email}")
        print(f"   Nuevo access_token: {new_tokens['access_token'][:20]}...")
        print(f"   Expira en: {new_tokens.get('expires_in', 3599)} segundos")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        # Listar emails disponibles
        tokens = load_tokens()
        print("📧 Emails con tokens guardados:")
        for email in tokens.keys():
            print(f"   - {email}")
        print("\nUso: python refresh_google_token.py <email>")
        sys.exit(0)
    
    email = sys.argv[1]
    asyncio.run(refresh_google_token(email))
