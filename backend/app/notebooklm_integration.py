"""
Integración con Google Genai para generación de resúmenes y análisis potenciados con IA.
Google Genai ofrece acceso GRATIS a modelos avanzados de Google (basados en Gemini).

Instalación:
    pip install -U google-genai

Configuración:
    1. Obtener API key gratis en: https://aistudio.google.com/app/apikey
    2. Agregar a .env: NOTEBOOKLM_API_KEY=tu_clave_aqui
    3. Usar notebooklm_summarize() en lugar de summarize_from_text()
"""

import os
import logging
from typing import Optional, Tuple

# Intenta importar Google Genai, pero no falla si no está instalado
try:
    import google.genai as genai
    from google.genai import types
    NOTEBOOKLM_AVAILABLE = True
except ImportError:
    NOTEBOOKLM_AVAILABLE = False
    logging.warning("⚠️ Google Genai no está instalado. Instálalo con: pip install -U google-genai")


class NotebookLMSummarizer:
    """Generador de resúmenes potenciado con IA Google Genai (Gemini)."""
    
    def __init__(self):
        """Inicializa el cliente de google-genai/Gemini."""
        self.api_key = os.getenv("NOTEBOOKLM_API_KEY")
        self.client = None
        
        if not NOTEBOOKLM_AVAILABLE:
            logging.warning("❌ Google Genai no instalado. Los resúmenes usarán el algoritmo local.")
            return
        
        if not self.api_key:
            logging.warning("⚠️ NOTEBOOKLM_API_KEY no configurada. Los resúmenes usarán el algoritmo local.")
            return
        
        try:
            self.client = genai.Client(api_key=self.api_key)
            logging.info("✅ Google Genai (Gemini 2.5 Flash) conectado correctamente")
        except Exception as e:
            logging.warning(f"⚠️ Error inicializando google-genai: {e}")
    
    def is_available(self) -> bool:
        """Verifica si google-genai está disponible."""
        return self.client is not None
        """Verifica si NotebookLM está disponible y configurado."""
        return self.model is not None
    
    async def generate_summary(
        self,
        text: str,
        sentences: int = 7,
        summary_length: str = "medium"  # "short", "medium", "long"
    ) -> str:
        """
        Genera un resumen usando NotebookLM (Google Gemini).
        
        Args:
            text: Texto a resumir
            sentences: Número aproximado de oraciones en el resumen
            summary_length: Extensión del resumen
                   - "short": 1-3 frases (muy conciso)
                   - "medium": 5-10 frases (equilibrado)
                   - "long": 10+ frases (detallado)
        
        Returns:
            Resumen generado por IA
        """
        if not self.is_available():
            raise ValueError("NotebookLM no está disponible. Configura NOTEBOOKLM_API_KEY en .env")
        
        if not text.strip():
            return ""
        
        # Limita el texto a 10000 caracteres para NotebookLM
        if len(text) > 10000:
            text = text[:10000] + "..."
        
        # Calibra las instrucciones según la extensión deseada
        length_config = {
            "short": "muy breve y conciso (1-3 frases máximo)",
            "medium": "equilibrado con puntos principales (5-10 frases)",
            "long": "detallado y comprensivo (10+ frases)"
        }
        detail = length_config.get(summary_length, length_config["medium"])
        
        prompt = f"""Resume el siguiente texto de manera {detail}.

INSTRUCCIONES CLAVE:
✓ Mantén TODOS los puntos principales y contexto importante
✓ Usa párrafos bien estructurados
✓ NO incluyas explicaciones sobre el resumen
✓ Escribe en español claro y accesible
✓ Aproximadamente {sentences} frases

TEXTO A RESUMIR:
{text}

RESUMEN:"""
        
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=1500,
                )
            )
            
            summary = response.text.strip()
            return summary
            
        except Exception as e:
            logging.error(f"❌ Error con NotebookLM: {e}")
            raise
    
    async def generate_keywords(
        self,
        text: str,
        k: int = 10
    ) -> list[str]:
        """
        Extrae keywords usando NotebookLM (Google Gemini).
        
        Args:
            text: Texto a analizar
            k: Número de keywords a extraer
        
        Returns:
            Lista de keywords ordenadas por relevancia
        """
        if not self.is_available():
            raise ValueError("NotebookLM no está disponible")
        
        if not text.strip():
            return []
        
        # Limita texto
        if len(text) > 5000:
            text = text[:5000] + "..."
        
        prompt = f"""Extrae exactamente {k} palabras clave del siguiente texto.
Devuelve SOLO las palabras clave, separadas por comas, sin explicaciones.
Ordénalas por importancia.

TEXTO:
{text}

PALABRAS CLAVE:"""
        
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=500,
                )
            )
            
            response_text = response.text.strip()
            # Parsea la respuesta
            keywords = [kw.strip() for kw in response_text.split(",") if kw.strip()]
            return keywords[:k]
            
        except Exception as e:
            logging.error(f"❌ Error extrayendo keywords: {e}")
            return []
    
    async def hybrid_summary(
        self,
        text: str,
        sentences: int = 7,
        use_ai: bool = True,
        use_local: bool = True
    ) -> Tuple[str, str]:
        """
        Genera resumen híbrido: IA + algoritmo local.
        
        Args:
            text: Texto a resumir
            sentences: Número de frases
            use_ai: Usar NotebookLM IA
            use_local: Usar algoritmo local como fallback
        
        Returns:
            Tuple (resumen_ai, resumen_local) o (resumen, resumen)
        """
        # Import local para evitar circular imports
        try:
            from . import summarizer as local_summarizer
        except ImportError:
            return "", ""
        
        results = {}
        
        # Genera resumen con IA si está disponible
        if use_ai and self.is_available():
            try:
                results["ai"] = await self.generate_summary(text, sentences)
            except Exception as e:
                logging.warning(f"⚠️ Error con IA, usando algoritmo local: {e}")
        
        # Genera resumen con algoritmo local
        if use_local:
            try:
                _, results["local"] = await local_summarizer.summarize_from_text(text, sentences)
            except Exception as e:
                logging.warning(f"⚠️ Error en algoritmo local: {e}")
        
        # Retorna preferentemente IA, fallback local
        if "ai" in results:
            return results["ai"], results.get("local", "")
        elif "local" in results:
            return results["local"], ""
        else:
            return "", ""


# Instancia global
notebooklm_summarizer = NotebookLMSummarizer()


async def get_summary_with_ai(
    text: str,
    sentences: int = 7,
    prefer_ai: bool = True,
    summary_length: str = "medium"  # "short", "medium", "long"
) -> Tuple[str, str]:
    """
    Obtiene resumen con IA o fallback local.
    
    Args:
        text: Texto a resumir
        sentences: Número de frases
        prefer_ai: Preferir NotebookLM IA
        summary_length: Extensión del resumen ("short", "medium", "long")
    
    Returns:
        Tuple (resumen, metadata)
    """
    if prefer_ai and notebooklm_summarizer.is_available():
        try:
            summary = await notebooklm_summarizer.generate_summary(
                text, 
                sentences, 
                summary_length=summary_length
            )
            return summary, "Generated with NotebookLM AI"
        except Exception as e:
            print(f"⚠️ Fallback a algoritmo local: {e}")
    
    # Fallback: algoritmo local
    try:
        from . import summarizer as local_summarizer
        summary, _ = await local_summarizer.summarize_from_text(text, sentences)
        return summary, "Generated with local algorithm"
    except Exception as e:
        logging.error(f"❌ Error en fallback: {e}")
        return "", "Error"


async def get_keywords_with_ai(
    text: str,
    k: int = 10,
    prefer_ai: bool = True
) -> list[str]:
    """
    Obtiene keywords con IA o fallback local.
    
    Args:
        text: Texto a analizar
        k: Número de keywords
        prefer_ai: Preferir NotebookLM IA
    
    Returns:
        Lista de keywords
    """
    if prefer_ai and notebooklm_summarizer.is_available():
        try:
            keywords = await notebooklm_summarizer.generate_keywords(text, k)
            if keywords:
                return keywords
        except Exception as e:
            logging.warning(f"⚠️ Fallback a extracción local: {e}")
    
    # Fallback: algoritmo local
    try:
        from . import summarizer as local_summarizer
        return local_summarizer.top_keywords(text, k)
    except Exception as e:
        logging.error(f"❌ Error en extracción local: {e}")
        return []
