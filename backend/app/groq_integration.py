"""
Integración con Groq API para generación de resúmenes potenciados con IA.
Groq ofrece acceso GRATIS a modelos como Mixtral 8x7B y Llama 2.

Instalación:
    pip install groq

Configuración:
    1. Obtener API key gratis en: https://console.groq.com
    2. Agregar a .env: GROQ_API_KEY=tu_clave_aqui
    3. Usar groq_summarize() en lugar de summarize_from_text()
"""

import os
import logging
from typing import Optional, Tuple

# Intenta importar Groq, pero no falla si no está instalado
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    logging.warning("⚠️  Groq no está instalado. Instálalo con: pip install groq")


class GroqSummarizer:
    """Generador de resúmenes potenciado con IA Groq."""
    
    def __init__(self):
        """Inicializa el cliente de Groq."""
        self.api_key = os.getenv("GROQ_API_KEY")
        self.client = None
        
        if not GROQ_AVAILABLE:
            logging.warning("❌ Groq no instalado. Los resúmenes usarán el algoritmo local.")
            return
        
        if not self.api_key:
            logging.warning("⚠️  GROQ_API_KEY no configurada. Los resúmenes usarán el algoritmo local.")
            return
        
        try:
            self.client = Groq(api_key=self.api_key)
            logging.info("✅ Groq conectado correctamente")
        except Exception as e:
            logging.warning(f"⚠️  Error inicializando Groq: {e}")
    
    def is_available(self) -> bool:
        """Verifica si Groq está disponible y configurado."""
        return self.client is not None
    
    async def generate_summary(
        self,
        text: str,
        sentences: int = 7,
        model: str = "llama-3.1-8b-instant",
        summary_length: str = "medium"  # "short", "medium", "long"
    ) -> str:
        """
        Genera un resumen usando Groq AI.
        
        Args:
            text: Texto a resumir
            sentences: Número aproximado de oraciones en el resumen
            model: Modelo Groq a usar
                   - "llama-3.1-8b-instant" (recomendado, faster, gratis)
            summary_length: Extensión del resumen
                   - "short": 1-3 frases (max_tokens=400)
                   - "medium": 5-10 frases (max_tokens=800)
                   - "long": 10+ frases (max_tokens=1500)
        
        Returns:
            Resumen generado por IA
        """
        if not self.is_available():
            raise ValueError("Groq no está disponible. Configura GROQ_API_KEY en .env")
        
        if not text.strip():
            return ""
        
        # Limita el texto a 8000 caracteres para la IA (mayor contenido = mejor resumen)
        if len(text) > 8000:
            text = text[:8000] + "..."
        
        # Calcula max_tokens dinámicamente basado en la extensión deseada
        length_config = {
            "short": {"max_tokens": 400, "detail": "muy breve y conciso (1-3 frases máximo)"},
            "medium": {"max_tokens": 800, "detail": "equilibrado (5-10 frases)"},
            "long": {"max_tokens": 1500, "detail": "detallado y comprensivo (10+ frases)"}
        }
        config = length_config.get(summary_length, length_config["medium"])
        
        prompt = f"""Resume el siguiente texto en {config['detail']}.

INSTRUCCIONES CLAVE:
✓ Mantén TODOS los puntos principales y contexto importante
✓ Usa párrafos bien estructurados
✓ NO incluyas explicaciones sobre el resumen
✓ Escribe en español claro y accesible
✓ Aproximadamente {sentences} frases en {summary_length}

TEXTO:
{text}

RESUMEN:"""
        
        try:
            # Llamada a Groq (muy rápida: ~100-200ms)
            message = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model="llama-3.1-8b-instant",
                temperature=0.3,  # Más enfocado en hechos
                max_tokens=config["max_tokens"],  # Dinámico según extensión
                top_p=0.9,
            )
            
            summary = message.choices[0].message.content.strip()
            return summary
            
        except Exception as e:
            logging.error(f"❌ Error con Groq: {e}")
            raise
    
    async def generate_keywords(
        self,
        text: str,
        k: int = 10,
        model: str = "llama-3.1-8b-instant"
    ) -> list[str]:
        """
        Extrae keywords usando Groq AI.
        
        Args:
            text: Texto a analizar
            k: Número de keywords a extraer
            model: Modelo Groq a usar
        
        Returns:
            Lista de keywords ordenadas por relevancia
        """
        if not self.is_available():
            raise ValueError("Groq no está disponible")
        
        if not text.strip():
            return []
        
        # Limita texto
        if len(text) > 2000:
            text = text[:2000] + "..."
        
        prompt = f"""Extrae exactamente {k} palabras clave del siguiente texto.
Devuelve SOLO las palabras clave, separadas por comas, sin explicaciones.
Ordénalas por importancia.

TEXTO:
{text}

PALABRAS CLAVE:"""
        
        try:
            message = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model=model,
                temperature=0.2,
                max_tokens=200,
            )
            
            response = message.choices[0].message.content.strip()
            # Parsea la respuesta
            keywords = [kw.strip() for kw in response.split(",") if kw.strip()]
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
            use_ai: Usar Groq AI
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
                logging.warning(f"⚠️  Error con IA, usando algoritmo local: {e}")
        
        # Genera resumen con algoritmo local
        if use_local:
            try:
                _, results["local"] = await local_summarizer.summarize_from_text(text, sentences)
            except Exception as e:
                logging.warning(f"⚠️  Error en algoritmo local: {e}")
        
        # Retorna preferentemente IA, fallback local
        if "ai" in results:
            return results["ai"], results.get("local", "")
        elif "local" in results:
            return results["local"], ""
        else:
            return "", ""


# Instancia global
groq_summarizer = GroqSummarizer()


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
        prefer_ai: Preferir Groq IA
        summary_length: Extensión del resumen ("short", "medium", "long")
    
    Returns:
        Tuple (resumen, metadata)
    """
    if prefer_ai and groq_summarizer.is_available():
        try:
            summary = await groq_summarizer.generate_summary(
                text, 
                sentences, 
                summary_length=summary_length
            )
            return summary, "Generated with Groq AI"
        except Exception as e:
            print(f"⚠️  Fallback a algoritmo local: {e}")
    
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
        prefer_ai: Preferir Groq IA
    
    Returns:
        Lista de keywords
    """
    if prefer_ai and groq_summarizer.is_available():
        try:
            keywords = await groq_summarizer.generate_keywords(text, k)
            if keywords:
                return keywords
        except Exception as e:
            logging.warning(f"⚠️  Fallback a extracción local: {e}")
    
    # Fallback: algoritmo local
    try:
        from . import summarizer as local_summarizer
        return local_summarizer.top_keywords(text, k)
    except Exception as e:
        logging.error(f"❌ Error en extracción local: {e}")
        return []
