"""
Tareas avanzadas con Groq AI.

Proporciona funciones para:
- Análisis de sentimiento
- Categorización automática
- Extracción de entidades NER
- Generación de contenido
- Q&A sobre documentos

Todas utilizan Groq API (GRATIS) - Acceso a Mixtral 8x7B y Llama 2 70B
"""

import logging
import os
from typing import Optional, List, Dict, Any

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    logging.warning("⚠️ Groq no está instalado. Instálalo con: pip install groq")


class GroqTasks:
    """Gestor de tareas avanzadas con Groq AI."""
    
    def __init__(self):
        """Inicializa el cliente de Groq."""
        self.api_key = os.getenv("GROQ_API_KEY")
        self.client = None
        
        if not GROQ_AVAILABLE:
            logging.warning("❌ Groq no instalado. Las tareas usarán respuestas simples.")
            return
        
        if not self.api_key:
            logging.warning("⚠️ GROQ_API_KEY no configurada.")
            return
        
        try:
            self.client = Groq(api_key=self.api_key)
            logging.info("✅ Groq conectado para tareas avanzadas")
        except Exception as e:
            logging.warning(f"⚠️ Error inicializando Groq: {e}")
    
    def is_available(self) -> bool:
        """Verifica si Groq está disponible."""
        return self.client is not None
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """
        Analiza el sentimiento del texto.
        
        Args:
            text: Texto a analizar
        
        Returns:
            {
                "sentiment": "Positivo|Neutral|Negativo",
                "score": 0.0-1.0,
                "explanation": "Explicación breve"
            }
        """
        if not text.strip():
            return {"sentiment": "Neutral", "score": 0.5, "explanation": "Texto vacío"}
        
        if not self.is_available():
            # Fallback simple
            negative_keywords = ['malo', 'terrible', 'horrible', 'odio', 'peor', 'decepcionante', 'bad', 'terrible', 'hate', 'worst', 'disappointing']
            positive_keywords = ['bueno', 'excelente', 'maravilloso', 'amor', 'perfecto', 'good', 'excellent', 'wonderful', 'love', 'perfect']
            
            text_lower = text.lower()
            neg_count = sum(1 for w in negative_keywords if w in text_lower)
            pos_count = sum(1 for w in positive_keywords if w in text_lower)
            
            if neg_count > pos_count:
                return {"sentiment": "Negativo", "score": 0.2, "explanation": "Análisis local"}
            elif pos_count > neg_count:
                return {"sentiment": "Positivo", "score": 0.8, "explanation": "Análisis local"}
            else:
                return {"sentiment": "Neutral", "score": 0.5, "explanation": "Análisis local"}
        
        # Limita el texto
        if len(text) > 2000:
            text = text[:2000] + "..."
        
        prompt = f"""Analiza el sentimiento del siguiente texto y devuelve EXACTAMENTE este formato:
SENTIMIENTO: [Positivo|Neutral|Negativo]
PUNTUACIÓN: [0.0-1.0]
EXPLICACIÓN: [una línea breve]

TEXTO:
{text}"""
        
        try:
            message = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                temperature=0.1,
                max_tokens=400,  # Aumentado de 200 para respuestas más completas
            )
            
            response = message.choices[0].message.content.strip()
            lines = response.split('\n')
            
            sentiment = "Neutral"
            score = 0.5
            explanation = "Análisis completado"
            
            for line in lines:
                if "SENTIMIENTO:" in line:
                    sentiment = line.split(":")[-1].strip()
                elif "PUNTUACIÓN:" in line:
                    try:
                        score = float(line.split(":")[-1].strip())
                    except:
                        pass
                elif "EXPLICACIÓN:" in line:
                    explanation = line.split(":")[-1].strip()
            
            return {
                "sentiment": sentiment,
                "score": min(1.0, max(0.0, score)),
                "explanation": explanation
            }
        except Exception as e:
            logging.error(f"❌ Error analizando sentimiento: {e}")
            return {"sentiment": "Error", "score": 0.0, "explanation": str(e)}
    
    async def categorize(self, text: str, categories: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Categoriza el texto automáticamente.
        
        Args:
            text: Texto a categorizar
            categories: Lista de categorías posibles (si vacía, detecta automáticamente)
        
        Returns:
            {
                "category": "Categoría detectada",
                "confidence": 0.0-1.0,
                "alternatives": [...]
            }
        """
        if not text.strip():
            return {"category": "Desconocida", "confidence": 0.0, "alternatives": []}
        
        if not self.is_available():
            return {"category": "Sin IA", "confidence": 0.0, "alternatives": []}
        
        # Limita el texto
        if len(text) > 2000:
            text = text[:2000] + "..."
        
        categories_str = ", ".join(categories) if categories else "Detecta automáticamente"
        
        prompt = f"""Categoriza el siguiente texto.
Categorías posibles: {categories_str}

Devuelve EXACTAMENTE este formato:
CATEGORÍA: [nombre]
CONFIANZA: [0.0-1.0]
ALTERNATIVAS: [cat1, cat2, cat3]

TEXTO:
{text}"""
        
        try:
            message = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                temperature=0.2,
                max_tokens=500,  # Aumentado de 200 para respuestas más completas
            )
            
            response = message.choices[0].message.content.strip()
            lines = response.split('\n')
            
            result = {
                "category": "Desconocida",
                "confidence": 0.5,
                "alternatives": []
            }
            
            for line in lines:
                if "CATEGORÍA:" in line:
                    result["category"] = line.split(":")[-1].strip()
                elif "CONFIANZA:" in line:
                    try:
                        result["confidence"] = float(line.split(":")[-1].strip())
                    except:
                        pass
                elif "ALTERNATIVAS:" in line:
                    alts = line.split(":")[-1].strip().strip("[]")
                    result["alternatives"] = [a.strip() for a in alts.split(",")]
            
            return result
        except Exception as e:
            logging.error(f"❌ Error categorizando: {e}")
            return {"category": "Error", "confidence": 0.0, "alternatives": []}
    
    async def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extrae entidades nombradas (NER).
        
        Args:
            text: Texto a analizar
        
        Returns:
            {
                "personas": [...],
                "lugares": [...],
                "organizaciones": [...]
            }
        """
        if not text.strip():
            return {"personas": [], "lugares": [], "organizaciones": []}
        
        if not self.is_available():
            return {"personas": [], "lugares": [], "organizaciones": []}
        
        # Limita el texto
        if len(text) > 3000:
            text = text[:3000] + "..."
        
        prompt = f"""Extrae entidades nombradas del siguiente texto.
Identifica: PERSONAS, LUGARES, ORGANIZACIONES

Devuelve EXACTAMENTE este formato:
PERSONAS: [nombre1, nombre2, ...]
LUGARES: [lugar1, lugar2, ...]
ORGANIZACIONES: [org1, org2, ...]

TEXTO:
{text}"""
        
        try:
            message = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                temperature=0.1,
                max_tokens=600,  # Aumentado de 300 para respuestas más completas
            )
            
            response = message.choices[0].message.content.strip()
            lines = response.split('\n')
            
            result = {"personas": [], "lugares": [], "organizaciones": []}
            
            for line in lines:
                if "PERSONAS:" in line:
                    entities = line.split(":")[-1].strip().strip("[]")
                    result["personas"] = [e.strip() for e in entities.split(",") if e.strip()]
                elif "LUGARES:" in line:
                    entities = line.split(":")[-1].strip().strip("[]")
                    result["lugares"] = [e.strip() for e in entities.split(",") if e.strip()]
                elif "ORGANIZACIONES:" in line:
                    entities = line.split(":")[-1].strip().strip("[]")
                    result["organizaciones"] = [e.strip() for e in entities.split(",") if e.strip()]
            
            return result
        except Exception as e:
            logging.error(f"❌ Error extrayendo entidades: {e}")
            return {"personas": [], "lugares": [], "organizaciones": []}
    
    async def generate_content(self, prompt: str, max_length: int = 2000) -> Dict[str, Any]:
        """
        Genera contenido basado en un prompt.
        
        Args:
            prompt: Instrucción para generar contenido
            max_length: Longitud máxima en caracteres (aumentado a 2000 para respuestas completas)
        
        Returns:
            {
                "content": "Contenido generado",
                "tokens_used": estimación
            }
        """
        if not prompt.strip():
            return {"content": "", "tokens_used": 0}
        
        if not self.is_available():
            return {"content": "IA no disponible", "tokens_used": 0}
        
        try:
            message = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                temperature=0.7,
                max_tokens=2000,  # Aumentado significativamente para permitir respuestas completas sin truncamiento
            )
            
            content = message.choices[0].message.content.strip()
            # Limita a max_length solo si es realmente necesario (usuarios raros)
            if len(content) > max_length:
                content = content[:max_length].rsplit(' ', 1)[0] + "..."
            
            return {
                "content": content,
                "tokens_used": len(content.split())
            }
        except Exception as e:
            logging.error(f"❌ Error generando contenido: {e}")
            return {"content": f"Error: {str(e)}", "tokens_used": 0}
    
    async def answer_question(self, document: str, question: str) -> Dict[str, Any]:
        """
        Responde una pregunta basada en un documento.
        
        Args:
            document: Documento de referencia
            question: Pregunta a responder
        
        Returns:
            {
                "answer": "Respuesta",
                "confidence": 0.0-1.0,
                "source_quotes": ["quote1", "quote2"]
            }
        """
        if not document.strip() or not question.strip():
            return {"answer": "Documento o pregunta vacío", "confidence": 0.0, "source_quotes": []}
        
        if not self.is_available():
            return {"answer": "IA no disponible", "confidence": 0.0, "source_quotes": []}
        
        # Limita el documento
        if len(document) > 4000:
            document = document[:4000] + "..."
        
        prompt = f"""Basándote en el siguiente documento, responde la pregunta.
Si no puedes responder basándote en el documento, di "No disponible en el documento".

DOCUMENTO:
{document}

PREGUNTA:
{question}

Responde EXACTAMENTE en este formato:
RESPUESTA: [tu respuesta aquí]
CONFIANZA: [0.0-1.0]
CITAS: [cita1; cita2; ...]"""
        
        try:
            message = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                temperature=0.2,
                max_tokens=1500,  # Aumentado de 400 para respuestas completas sin cortarse
            )
            
            response = message.choices[0].message.content.strip()
            lines = response.split('\n')
            
            result = {
                "answer": "",
                "confidence": 0.5,
                "source_quotes": []
            }
            
            # Try to extract structured format
            found_respuesta = False
            for line in lines:
                if "RESPUESTA:" in line:
                    result["answer"] = line.split(":", 1)[-1].strip()
                    found_respuesta = True
                elif "CONFIANZA:" in line:
                    try:
                        result["confidence"] = float(line.split(":", 1)[-1].strip())
                    except:
                        pass
                elif "CITAS:" in line:
                    citas = line.split(":", 1)[-1].strip()
                    result["source_quotes"] = [c.strip() for c in citas.split(";") if c.strip()]
            
            # If structured format not found, use entire response as answer (fallback for context-enriched prompts)
            if not found_respuesta:
                result["answer"] = response
            
            return result
        except Exception as e:
            logging.error(f"❌ Error respondiendo pregunta: {e}")
            return {"answer": f"Error: {str(e)}", "confidence": 0.0, "source_quotes": []}


# Instancia global
groq_tasks = GroqTasks()


# Funciones públicas para uso directo
async def analyze_sentiment(text: str) -> Dict[str, Any]:
    """Analiza sentimiento del texto."""
    return await groq_tasks.analyze_sentiment(text)


async def categorize(text: str, categories: Optional[List[str]] = None) -> Dict[str, Any]:
    """Categoriza el texto."""
    return await groq_tasks.categorize(text, categories)


async def extract_entities(text: str) -> Dict[str, List[str]]:
    """Extrae entidades nombradas."""
    return await groq_tasks.extract_entities(text)


async def generate_content(prompt: str, max_length: int = 500) -> Dict[str, Any]:
    """Genera contenido."""
    return await groq_tasks.generate_content(prompt, max_length)


async def answer_question(document: str, question: str) -> Dict[str, Any]:
    """Responde preguntas sobre un documento."""
    return await groq_tasks.answer_question(document, question)
