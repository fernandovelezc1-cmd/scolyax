"""
Integración TTS multi-proveedor con voces neuronales de alta calidad.

Prioridad de proveedores:
  1. edge-tts  → Voces neuronales Microsoft (GRATIS, rápido, muy humano)
  2. Google Cloud TTS → Voces Neural2/WaveNet (requiere credenciales)
  3. gTTS → Google Translate TTS (fallback gratuito, voz robótica)

Instalación:
    pip install edge-tts google-cloud-texttospeech gTTS
"""

import logging
import os
import json
import io
import tempfile
import asyncio
from typing import Optional

# ── edge-tts (Microsoft Edge Neural Voices) ──
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
    logging.info("✅ edge-tts disponible — voces neuronales Microsoft")
except ImportError:
    EDGE_TTS_AVAILABLE = False
    logging.warning("⚠️  edge-tts no instalado (pip install edge-tts)")

# ── Google Cloud TTS ──

try:
    from google.cloud import texttospeech
    from google.oauth2 import service_account
    GOOGLE_TTS_AVAILABLE = True
except ImportError:
    GOOGLE_TTS_AVAILABLE = False
    logging.warning("⚠️  google-cloud-texttospeech no instalado")


class GoogleTTSProvider:
    """Proveedor de TTS usando Google Cloud (voces realistas)."""
    
    def __init__(self):
        """Inicializa el cliente de Google Cloud TTS."""
        self.client = None
        self.temp_creds_file = None
        
        if not GOOGLE_TTS_AVAILABLE:
            logging.warning("❌ Google Cloud TTS no disponible")
            return
        
        # Primero intenta credenciales desde variable de entorno (Railway/Vercel)
        creds_json_str = os.getenv("GOOGLE_TTS_CREDENTIALS_JSON")
        
        if creds_json_str:
            try:
                logging.info("📝 Intentando usar Google Cloud TTS desde GOOGLE_TTS_CREDENTIALS_JSON")
                self._setup_from_json_string(creds_json_str)
            except Exception as e:
                logging.info(f"ℹ️  Google Cloud TTS no disponible, usará fallback gTTS gratuito")
                return
        else:
            # Fallback: intenta archivo local
            creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if not creds_path or not os.path.exists(creds_path):
                logging.info("ℹ️  Google Cloud TTS no configurado, usará gTTS gratuito como TTS")
                return
        
        try:
            self.client = texttospeech.TextToSpeechClient()
            logging.info("✅ Google Cloud TTS conectado correctamente")
        except Exception as e:
            logging.warning(f"⚠️  Error inicializando Google Cloud TTS: {e}")
    
    def _setup_from_json_string(self, json_str: str):
        """
        Configura credenciales desde un string JSON.
        Crea archivo temporal y establece variable de entorno.
        
        Args:
            json_str: String JSON con credenciales
        """
        try:
            # Parsea el JSON
            creds_dict = json.loads(json_str)
            
            # Crea archivo temporal
            self.temp_creds_file = tempfile.NamedTemporaryFile(
                mode='w',
                suffix='.json',
                delete=False
            )
            json.dump(creds_dict, self.temp_creds_file)
            self.temp_creds_file.flush()
            self.temp_creds_file.close()
            
            # Establece variable de entorno para Google Cloud SDK
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = self.temp_creds_file.name
            logging.info(f"✅ Credenciales de Google Cloud cargadas desde variable de entorno")
            
        except json.JSONDecodeError as e:
            logging.info(f"ℹ️  Google Cloud TTS no configurado (JSON inválido), usará fallback gTTS")
            raise
        except Exception as e:
            logging.warning(f"⚠️  Error configurando Google Cloud TTS, usará fallback: {e}")
            raise
    
    def __del__(self):
        """Limpia archivo temporal de credenciales."""
        if self.temp_creds_file and os.path.exists(self.temp_creds_file.name):
            try:
                os.unlink(self.temp_creds_file.name)
            except Exception as e:
                logging.warning(f"⚠️  Error limpiando archivo temporal: {e}")
    
    def is_available(self) -> bool:
        """Verifica si Google Cloud TTS está disponible."""
        return self.client is not None
    
    async def synthesize_speech(
        self,
        text: str,
        language: str = "es-ES",
        voice_name: str = "es-ES-Neural2-A",  # Voz femenina neural de alta calidad
        speaking_rate: float = 0.95,  # Velocidad de habla (0.25-4.0)
        pitch: float = -2.0  # Tono de voz (-20.0 a 20.0)
    ) -> Optional[bytes]:
        """
        Sintetiza texto a audio usando Google Cloud TTS.
        
        Args:
            text: Texto a convertir a audio
            language: Código de idioma (ej: es-ES, en-US)
            voice_name: Nombre de la voz (ej: es-ES-Neural2-A para mujer natural)
            speaking_rate: Velocidad de habla (0.25 muy lento, 1.0 normal, 4.0 muy rápido)
            pitch: Tono de voz (-20.0 muy grave, 0.0 neutral, 20.0 muy agudo)
        
        Returns:
            Audio en bytes (formato MP3)
        
        Voces disponibles en español:
            - es-ES-Neural2-A: Mujer, natural, clara (RECOMENDADO IRIS)
            - es-ES-Neural2-C: Mujer, natural, profesional
            - es-ES-Neural2-E: Mujer, natural, cálida
            - es-ES-Wavenet-C: Mujer, wavenet (más realista)
            - es-ES-Standard-a: Mujer, estándar
        """
        if not self.is_available():
            logging.warning("⚠️  Google Cloud TTS no disponible")
            return None
        
        if not text.strip():
            return None
        
        try:
            # Limita texto a 5000 caracteres por solicitud
            if len(text) > 5000:
                text = text[:5000]
            
            # Prepara la solicitud
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            voice = texttospeech.VoiceSelectionParams(
                language_code=language,
                name=voice_name,
                ssml_gender=texttospeech.SsmlVoiceGender.FEMALE  # Iris es mujer
            )
            
            # Configuración de audio con parámetros personalizables
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
                speaking_rate=speaking_rate,  # Velocidad personalizada
                pitch=pitch,  # Tono personalizado
            )
            
            # Sintetiza
            response = self.client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
            logging.info(f"✅ Audio sintetizado: {len(text)} caracteres")
            return response.audio_content
            
        except Exception as e:
            logging.error(f"❌ Error sintetizando audio: {e}")
            return None
    
    async def get_available_voices(self, language: str = "es-ES") -> list[str]:
        """
        Retorna voces disponibles para un idioma.
        
        Args:
            language: Código de idioma
        
        Returns:
            Lista de nombres de voces disponibles
        """
        if not self.is_available():
            return []
        
        try:
            response = self.client.list_voices(language_code=language)
            voices = [voice.name for voice in response.voices]
            return voices
        except Exception as e:
            logging.error(f"❌ Error obteniendo voces: {e}")
            return []


# Instancia global
google_tts = GoogleTTSProvider()


async def get_tts_audio(
    text: str,
    language: str = "es-ES",
    voice_name: str = "es-ES-Neural2-A",
    speaking_rate: float = 0.95,
    pitch: float = -2.0,
    use_google: bool = True
) -> Optional[bytes]:
    """
    Obtiene audio sintetizado. Prioridad: edge-tts → Google Cloud → gTTS.
    
    Returns:
        Audio en bytes (MP3)
    """
    cleaned = text.strip()
    if not cleaned:
        return None

    # ── 1. edge-tts (Microsoft Neural, gratis, rápido, humano) ──
    if EDGE_TTS_AVAILABLE:
        try:
            # Mapear idioma a voz neural de Edge
            EDGE_VOICES = {
                'es-ES': 'es-ES-ElviraNeural',      # España, femenina, natural
                'es-CO': 'es-CO-SalomeNeural',      # Colombia, femenina
                'es-MX': 'es-MX-DaliaNeural',       # México, femenina
                'es-AR': 'es-AR-ElenaNeural',       # Argentina, femenina
                'en-US': 'en-US-JennyNeural',       # Inglés US, femenina
                'en-GB': 'en-GB-SoniaNeural',       # Inglés UK, femenina
                'pt-BR': 'pt-BR-FranciscaNeural',   # Portugués BR, femenina
            }
            
            # Seleccionar voz: primero por idioma exacto, luego por prefijo
            lang = language or 'es-ES'
            edge_voice = EDGE_VOICES.get(lang)
            if not edge_voice:
                prefix = lang.split('-')[0]
                edge_voice = next((v for k, v in EDGE_VOICES.items() if k.startswith(prefix)), 'es-ES-ElviraNeural')
            
            # Convertir speaking_rate a formato edge-tts: "+0%", "-10%", "+20%"
            rate_pct = int((speaking_rate - 1.0) * 100)
            rate_str = f"{rate_pct:+d}%"
            
            # Convertir pitch a formato edge-tts: "+0Hz", "-50Hz"
            pitch_hz = int(pitch * 10)
            pitch_str = f"{pitch_hz:+d}Hz"
            
            logging.info(f"🔊 edge-tts: voz={edge_voice}, rate={rate_str}, pitch={pitch_str}")
            
            communicate = edge_tts.Communicate(
                text=cleaned[:5000],
                voice=edge_voice,
                rate=rate_str,
                pitch=pitch_str
            )
            
            audio_buffer = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_buffer.write(chunk["data"])
            
            audio_bytes = audio_buffer.getvalue()
            if audio_bytes and len(audio_bytes) > 0:
                logging.info(f"✅ edge-tts sintetizado: {len(cleaned)} chars → {len(audio_bytes)} bytes")
                return audio_bytes
            else:
                logging.warning("⚠️  edge-tts devolvió audio vacío")
                
        except Exception as e:
            logging.warning(f"⚠️  Error con edge-tts: {e}")

    # ── 2. Google Cloud TTS ──
    if use_google and google_tts.is_available():
        try:
            audio = await google_tts.synthesize_speech(
                cleaned, 
                language, 
                voice_name,
                speaking_rate,
                pitch
            )
            if audio:
                return audio
        except Exception as e:
            logging.warning(f"⚠️  Error con Google TTS: {e}")
    
    # ── 3. gTTS fallback (Google Translate, robótico pero siempre funciona) ──
    try:
        from gtts import gTTS
        
        lang_code = language.split('-')[0]
        logging.info(f"🔄 Usando fallback gTTS")
        
        tts = gTTS(text=cleaned, lang=lang_code, slow=False)
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        
        audio_bytes = audio_buffer.read()
        logging.info(f"✅ gTTS sintetizado: {len(audio_bytes)} bytes")
        return audio_bytes
        
    except ImportError:
        logging.error("❌ gTTS no está instalado. pip install gTTS")
        return None
    except Exception as e:
        logging.error(f"❌ Error con gTTS: {e}")
        return None
