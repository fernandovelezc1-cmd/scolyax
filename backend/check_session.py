"""Script para verificar el token de sesión actual del usuario."""
import sys
from app.storage import validate_session_token

# Obtener token desde argumento
if len(sys.argv) < 2:
    print("Uso: python check_session.py <session_token>")
    print("\nEl token se encuentra en localStorage.scolyax.sessionToken en el navegador")
    sys.exit(1)

token = sys.argv[1]

try:
    session_data = validate_session_token(token)
    print(f"✅ Session válida:")
    print(f"   Email: {session_data['email']}")
    print(f"   Provider: {session_data.get('provider', 'N/A')}")
    print(f"   Display Name: {session_data.get('display_name', 'N/A')}")
except Exception as e:
    print(f"❌ Error: {e}")
