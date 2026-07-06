"""User feedback storage functions for Supabase.

This module handles saving and retrieving user feedback/ratings for achievements.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional
from supabase import Client

logger = logging.getLogger(__name__)


def get_supabase() -> Client:
    """Import get_supabase from supabase_storage to avoid circular imports."""
    from .supabase_storage import get_supabase as _get_supabase
    return _get_supabase()


def save_user_feedback(user_email: str, user_name: Optional[str], achievement_id: str, 
                       rating: int, comment: str) -> None:
    """Guarda el feedback de calificación de un usuario en la base de datos.
    
    Los datos de feedback NUNCA se borran - son datos valiosos para reportes y análisis.
    """
    try:
        supabase = get_supabase()
        
        # Validar rating
        if not (1 <= rating <= 5):
            raise ValueError(f"Rating must be between 1 and 5, got {rating}")
        
        # Truncar comentario a 200 caracteres
        comment = (comment or "").strip()[:200]
        
        logger.info(f"💬 Saving user feedback for {user_email}:")
        logger.info(f"   Achievement: {achievement_id}")
        logger.info(f"   Rating: {rating}/5")
        logger.info(f"   Comment length: {len(comment)} chars")
        
        now = datetime.now(timezone.utc).isoformat()
        
        data = {
            "user_email": user_email,
            "user_name": user_name or "Anonymous",
            "achievement_id": achievement_id,
            "rating": rating,
            "comment": comment,
            "created_at": now,
            "updated_at": now
        }
        
        # Insert feedback (NUNCA se borra)
        response = supabase.table("user_feedback").insert(data).execute()
        logger.info(f"✅ User feedback saved successfully for {user_email}")
        logger.info(f"   ID: {response.data[0].get('id') if response.data else 'unknown'}")
        
    except Exception as e:
        logger.error(f"❌ Error saving user feedback for {user_email}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


def check_user_feedback_exists(user_email: str, achievement_id: str) -> bool:
    """Verifica si un usuario ya ha calificado un logro específico.
    
    Retorna True si ya existe feedback para este usuario + achievement combination.
    """
    try:
        supabase = get_supabase()
        
        response = supabase.table("user_feedback").select("id").eq(
            "user_email", user_email
        ).eq("achievement_id", achievement_id).execute()
        
        exists = len(response.data) > 0
        logger.info(f"🔍 Feedback exists for {user_email} + {achievement_id}: {exists}")
        return exists
        
    except Exception as e:
        logger.error(f"❌ Error checking feedback existence: {e}")
        return False


def load_all_user_feedback() -> List[dict]:
    """Carga todos los feedbacks de usuarios de la base de datos.
    
    Usado por el panel de administración para mostrar todas las calificaciones.
    Retorna lista de dicts con: user_email, user_name, achievement_id, rating, comment, created_at
    """
    try:
        supabase = get_supabase()
        
        response = supabase.table("user_feedback").select("*").order(
            "created_at", desc=True
        ).execute()
        
        feedbacks = response.data
        logger.info(f"📊 Loaded {len(feedbacks)} user feedbacks from database")
        return feedbacks
        
    except Exception as e:
        logger.error(f"❌ Error loading all user feedback: {e}")
        return []


def get_feedback_stats() -> dict:
    """Obtiene estadísticas agregadas de todos los feedbacks.
    
    Retorna:
    - total_count: Total de feedbacks
    - average_rating: Rating promedio
    - rating_distribution: Dict con conteo por rating (1-5)
    - recent_feedback: Últimos 5 feedbacks
    """
    try:
        supabase = get_supabase()
        
        # Obtener todos los feedbacks
        response = supabase.table("user_feedback").select("*").order(
            "created_at", desc=True
        ).execute()
        
        feedbacks = response.data
        
        if not feedbacks:
            return {
                "total_feedback": 0,
                "average_rating": 0.0,
                "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
                "recent_feedback": []
            }
        
        # Calcular estadísticas
        total_feedback = len(feedbacks)
        ratings = [f["rating"] for f in feedbacks]
        average_rating = sum(ratings) / len(ratings) if ratings else 0.0
        
        # Distribución de ratings
        rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for rating in ratings:
            rating_distribution[rating] = rating_distribution.get(rating, 0) + 1
        
        # Últimos 5 feedbacks
        recent_feedback = feedbacks[:5]
        
        stats = {
            "total_feedback": total_feedback,
            "average_rating": round(average_rating, 2),
            "rating_distribution": rating_distribution,
            "recent_feedback": recent_feedback
        }
        
        logger.info(f"📊 Feedback stats: {total_feedback} total, avg {average_rating:.2f}")
        return stats
        
    except Exception as e:
        logger.error(f"❌ Error calculating feedback stats: {e}")
        return {
            "total_count": 0,
            "average_rating": 0.0,
            "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            "recent_feedback": []
        }


def delete_user_feedback(feedback_id: int) -> bool:
    """Elimina una calificación por su ID (solo admin).
    
    Retorna True si se eliminó correctamente, False si no se encontró o hubo error.
    """
    try:
        supabase = get_supabase()
        response = supabase.table("user_feedback").delete().eq("id", feedback_id).execute()
        deleted = len(response.data) > 0 if response.data else False
        if deleted:
            logger.info(f"🗑️ Feedback {feedback_id} eliminado correctamente")
        else:
            logger.warning(f"⚠️ Feedback {feedback_id} no encontrado para eliminar")
        return deleted
    except Exception as e:
        logger.error(f"❌ Error eliminando feedback {feedback_id}: {e}")
        return False
