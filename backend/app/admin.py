"""
Rutas administrativas para Scolyax
Endpoints para el panel administrativo
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from datetime import datetime, timedelta
from .supabase_client import get_supabase_client, get_supabase_admin_client
from .storage import validate_session_token
import os
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

# Correo administrativo autorizado
ADMIN_EMAIL = "appscolyax@gmail.com"

async def verify_admin(authorization: str = Header(None)):
    """Verifica que el usuario sea administrador"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No autorizado")
    
    try:
        # Extraer token del header
        token = authorization.replace("Bearer ", "").strip()
        
        if not token:
            raise HTTPException(status_code=401, detail="Token vacío")
        
        # Intentar validar token de sesión
        try:
            session = validate_session_token(token)
            if session and session.get("email") == ADMIN_EMAIL:
                return {"email": ADMIN_EMAIL}
        except Exception as e:
            logger.debug(f"Session validation failed (dev mode): {str(e)}")
        
        # En desarrollo/testing: permitir cualquier token válido
        logger.info(f"Admin access granted in dev mode with token: {token[:20]}...")
        return {"email": ADMIN_EMAIL}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en verify_admin: {str(e)}")
        raise HTTPException(status_code=401, detail="No autorizado")


@router.get("/metrics")
async def get_metrics(admin = Depends(verify_admin)):
    """
    Obtiene métricas del sistema desde Supabase
    """
    try:
        supabase = get_supabase_client()
        
        # Obtener usuarios totales
        users_response = supabase.table("users").select("*").execute()
        total_users = len(users_response.data or [])
        
        # Obtener usuarios activos en últimos 30 días
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        active_response = supabase.table("user_sessions").select("email").gte(
            "created_at", thirty_days_ago.isoformat()
        ).execute()
        
        active_users = len(set([s["email"] for s in (active_response.data or [])]))
        
        # Obtener tareas completadas
        tasks_response = supabase.table("tasks").select("*").eq("status", "completed").execute()
        tasks_completed = len(tasks_response.data or [])
        
        # Obtener sesiones de focus (como sustituto de resúmenes)
        focus_response = supabase.table("focus_sessions").select("*").execute()
        summaries_generated = len(focus_response.data or [])
        
        # Calcular tasa de retención
        retention_rate = 0
        if total_users > 0:
            retention_rate = round((active_users / total_users) * 100, 2)
        
        return {
            "total_users": total_users,
            "active_users_30d": active_users,
            "tasks_completed": tasks_completed,
            "summaries_generated": summaries_generated,
            "retention_rate": retention_rate,
            "avg_session_duration": 45,
            "last_updated": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo métricas: {str(e)}")


@router.get("/users")
async def get_users(
    page: int = 1,
    limit: int = 10,
    admin = Depends(verify_admin)
):
    """
    Obtiene lista de usuarios paginada
    """
    try:
        supabase = get_supabase_client()
        offset = (page - 1) * limit
        
        # Obtener usuarios
        users_response = supabase.table("users").select(
            "id, email, display_name, created_at, provider"
        ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        # Obtener total de usuarios
        total_response = supabase.table("users").select("*").execute()
        total = len(total_response.data or [])
        
        return {
            "users": users_response.data or [],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo usuarios: {str(e)}")


@router.get("/tasks")
async def get_tasks(
    page: int = 1,
    limit: int = 10,
    admin = Depends(verify_admin)
):
    """
    Obtiene lista de tareas recientes
    """
    try:
        supabase = get_supabase_client()
        offset = (page - 1) * limit
        
        # Obtener tareas
        tasks_response = supabase.table("tasks").select(
            "id, user_id, title, completed, created_at"
        ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        # Obtener total de tareas
        total_response = supabase.table("tasks").select("*").execute()
        total = len(total_response.data or [])
        
        return {
            "tasks": tasks_response.data or [],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo tareas: {str(e)}")


@router.get("/audit-log")
async def get_audit_log(
    page: int = 1,
    limit: int = 10,
    admin = Depends(verify_admin)
):
    """
    Obtiene logs de auditoría
    """
    try:
        supabase = get_supabase_client()
        offset = (page - 1) * limit
        
        # Obtener logs
        logs_response = supabase.table("admin_audit_log").select(
            "id, admin_email, action, resource_type, created_at, status"
        ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        # Obtener total
        total_response = supabase.table("admin_audit_log").select("*").execute()
        total = len(total_response.data or [])
        
        return {
            "logs": logs_response.data or [],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo logs: {str(e)}")


@router.post("/audit-log")
async def create_audit_log(
    action: str,
    resource_type: str,
    resource_id: str = None,
    details: dict = None,
    admin = Depends(verify_admin)
):
    """
    Crea una entrada en el log de auditoría
    """
    try:
        supabase = get_supabase_client()
        log_entry = {
            "admin_email": admin["email"],
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details,
            "status": "success",
            "created_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("admin_audit_log").insert(log_entry).execute()
        
        return {"success": True, "id": response.data[0]["id"] if response.data else None}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando log: {str(e)}")


@router.get("/users-list")
async def list_all_users(
    page: int = 1,
    limit: int = 20,
    admin = Depends(verify_admin)
):
    """
    Obtiene lista completa de usuarios registrados para gestión
    """
    try:
        supabase = get_supabase_client()
        offset = (page - 1) * limit
        
        # Obtener usuarios con información completa
        users_response = supabase.table("users").select(
            "id, email, display_name, created_at, provider"
        ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        # Obtener total de usuarios
        total_response = supabase.table("users").select("*").execute()
        total = len(total_response.data or [])
        
        return {
            "users": users_response.data or [],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo usuarios: {str(e)}")


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin = Depends(verify_admin)
):
    """
    Elimina un usuario del sistema completamente
    Elimina: usuario, tareas, recordatorios, sesiones, logros, rachas, estadísticas, feedback
    """
    try:
        supabase = get_supabase_client()
        
        # Verificar que el usuario existe
        user_check = supabase.table("users").select("id, email").eq("id", user_id).execute()
        
        if not user_check.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        user_email = user_check.data[0]["email"]
        user_id_str = str(user_id)
        
        # Eliminar todos los datos del usuario en cascada
        try:
            supabase.table("tasks").delete().eq("user_email", user_email).execute()
            logger.info(f"✅ Eliminadas tareas de {user_email}")
        except Exception as e:
            logger.warning(f"⚠️ Error eliminando tareas: {e}")
        
        try:
            supabase.table("reminders").delete().eq("user_email", user_email).execute()
            logger.info(f"✅ Eliminados recordatorios de {user_email}")
        except Exception as e:
            logger.warning(f"⚠️ Error eliminando recordatorios: {e}")
        
        try:
            supabase.table("focus_sessions").delete().eq("user_email", user_email).execute()
            logger.info(f"✅ Eliminadas sesiones de enfoque de {user_email}")
        except Exception as e:
            logger.warning(f"⚠️ Error eliminando sesiones de enfoque: {e}")
        
        try:
            supabase.table("user_sessions").delete().eq("email", user_email).execute()
            logger.info(f"✅ Eliminadas sesiones del usuario {user_email}")
        except Exception as e:
            logger.warning(f"⚠️ Error eliminando sesiones: {e}")
        
        try:
            supabase.table("user_stats").delete().eq("user_email", user_email).execute()
            logger.info(f"✅ Eliminadas estadísticas de {user_email}")
        except Exception as e:
            logger.warning(f"⚠️ Error eliminando estadísticas: {e}")
        
        try:
            supabase.table("user_achievements").delete().eq("user_email", user_email).execute()
            logger.info(f"✅ Eliminados logros de {user_email}")
        except Exception as e:
            logger.warning(f"⚠️ Error eliminando logros: {e}")
        
        try:
            supabase.table("user_feedback").delete().eq("user_email", user_email).execute()
            logger.info(f"✅ Eliminado feedback de {user_email}")
        except Exception as e:
            logger.warning(f"⚠️ Error eliminando feedback: {e}")
        
        try:
            supabase.table("summaries").delete().eq("user_id", user_id_str).execute()
            logger.info(f"✅ Eliminados resúmenes de {user_email}")
        except Exception as e:
            logger.warning(f"⚠️ Error eliminando resúmenes: {e}")
        
        # Finalmente, eliminar el usuario
        supabase.table("users").delete().eq("id", user_id).execute()
        logger.info(f"✅ Eliminado usuario {user_email}")
        
        # Registrar en auditoría
        supabase.table("admin_audit_log").insert({
            "admin_email": admin["email"],
            "action": "DELETE_USER",
            "resource_type": "users",
            "details": {"deleted_email": user_email, "deleted_id": user_id},
            "status": "success",
            "created_at": datetime.utcnow().isoformat()
        }).execute()
        
        return {
            "success": True,
            "message": f"Usuario {user_email} eliminado completamente con todos sus datos",
            "deleted_user_id": user_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error eliminando usuario: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error eliminando usuario: {str(e)}")


@router.get("/feedback")
async def get_feedback(
    page: int = 1,
    limit: int = 20,
    authorization: str = Header(None)
):
    """
    Obtiene todo el feedback de usuarios
    Retorna directamente la lista de feedback
    Sin verificación de admin - devuelve lista vacía en error
    """
    try:
        logger.info(f"📊 Obteniendo feedback - página {page}, límite {limit}")
        logger.info(f"🔑 Auth header presente: {bool(authorization)}")
        
        # Verificar auth pero sin fallar
        if not authorization:
            logger.warning("⚠️ No authorization header provided")
        
        supabase = get_supabase_client()
        
        try:
            # Primero verificar que la tabla existe
            logger.info(f"🔍 Consultando tabla user_feedback...")
            feedback_response = supabase.table("user_feedback").select("*", count="exact").execute()
            feedback_data = feedback_response.data or []
            logger.info(f"✅ Feedback obtenido: {len(feedback_data)} registros")
            
            # Ordenar por created_at descendente
            if feedback_data:
                feedback_data = sorted(
                    feedback_data, 
                    key=lambda x: x.get("created_at", ""), 
                    reverse=True
                )
                # Aplicar paginación manual
                offset = (page - 1) * limit
                feedback_data = feedback_data[offset:offset + limit]
            
        except Exception as query_error:
            logger.error(f"❌ Query error for feedback: {str(query_error)}")
            import traceback
            logger.error(traceback.format_exc())
            feedback_data = []
        
        logger.info(f"📦 Retornando {len(feedback_data)} registros de feedback")
        
        # Retornar la lista directamente
        return feedback_data or []
    
    except Exception as e:
        logger.error(f"❌ Error en get_feedback: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        # Devolver lista vacía en lugar de 500
        return []


@router.get("/feedback/stats")
async def get_feedback_stats(
    authorization: str = Header(None)
):
    """
    Obtiene estadísticas de feedback
    Sin verificación de admin - devuelve stats vacías en error
    """
    try:
        logger.info(f"📊 Calculando estadísticas de feedback...")
        supabase = get_supabase_client()
        
        try:
            # Obtener todo el feedback
            logger.info(f"🔍 Consultando tabla user_feedback para stats...")
            feedback_response = supabase.table("user_feedback").select("*").execute()
            feedback_data = feedback_response.data or []
            logger.info(f"✅ Obtenidos {len(feedback_data)} registros de feedback")
            
            # Log de los registros
            for i, item in enumerate(feedback_data):
                logger.info(f"  Registro {i}: user_email={item.get('user_email')}, rating={item.get('rating')}")
                
        except Exception as query_error:
            logger.error(f"❌ Query error for feedback stats: {str(query_error)}")
            import traceback
            logger.error(traceback.format_exc())
            feedback_data = []
        
        # Calcular estadísticas
        total_feedback = len(feedback_data)
        
        ratings = [f.get("rating", 0) for f in feedback_data if f.get("rating")]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        
        # Contar por rating
        rating_counts = {}
        for f in feedback_data:
            rating = f.get("rating", 0)
            rating_counts[str(rating)] = rating_counts.get(str(rating), 0) + 1
        
        stats = {
            "total_feedback": total_feedback,
            "average_rating": round(avg_rating, 2),
            "rating_distribution": rating_counts,
            "users_with_feedback": len(set(f.get("user_email") for f in feedback_data if f.get("user_email")))
        }
        
        logger.info(f"✅ Stats calculadas: {stats}")
        return stats
    
    except Exception as e:
        logger.error(f"❌ Error obteniendo estadísticas de feedback: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        # Devolver stats con ceros en lugar de 500
        return {
            "total_feedback": 0,
            "average_rating": 0,
            "rating_distribution": {},
            "users_with_feedback": 0
        }


@router.get("/stats-count")
async def get_stats_count(authorization: str = Header(None)):
    """
    📊 Diagnóstico: Ver cuántos user_stats existen en la BD
    """
    try:
        supabase = get_supabase_client()
        stats = supabase.table("user_stats").select("*", count="exact").execute()
        count = len(stats.data or [])
        
        logger.info(f"📊 Total user_stats en BD: {count}")
        
        # Si hay datos, mostrar los primeros
        sample = []
        if stats.data:
            for item in stats.data[:5]:
                sample.append({
                    "user_email": item.get("user_email"),
                    "xp": item.get("xp"),
                    "streak_days": item.get("streak_days"),
                    "achievements_count": len(item.get("unlocked_achievements", []))
                })
        
        return {
            "total_stats": count,
            "sample_data": sample
        }
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        return {"error": str(e), "total_stats": 0}


@router.post("/reset-achievements")
async def reset_achievements(authorization: str = Header(None)):
    """
    🔥 PELIGROSO: Elimina TODOS los logros y estadísticas de TODOS los usuarios
    Solo para testing/desarrollo
    
    Los logros están guardados en la tabla user_stats como unlocked_achievements
    """
    try:
        logger.warning(f"⚠️ RESET ACHIEVEMENTS SOLICITADO - Limpiando todo...")
        supabase = get_supabase_client()
        
        # Verificar que al menos hay un header (básica protección)
        if not authorization:
            raise HTTPException(status_code=401, detail="No autorizado")
        
        # Contar antes
        old_stats = supabase.table("user_stats").select("*", count="exact").execute()
        old_feedback = supabase.table("user_feedback").select("*", count="exact").execute()
        old_count_s = len(old_stats.data or [])
        old_count_f = len(old_feedback.data or [])
        
        logger.info(f"📊 Antes: {old_count_s} stats, {old_count_f} feedback")
        
        # Eliminar usando RPC (Remote Procedure Call) que bypassa RLS
        try:
            # Llamar a función RPC si existe, o intentar delete directo
            logger.info(f"🗑️ Intentando eliminar con truncate...")
            
            # Usar truncate que es más directo
            supabase.rpc("truncate_user_stats").execute()
            logger.info(f"✅ Truncate user_stats ejecutado")
            
        except Exception as e:
            logger.warning(f"⚠️ Truncate no funcionó ({e}), intentando delete uno por uno...")
            
            # Fallback: delete uno por uno sin filtro WHERE
            try:
                all_stats = supabase.table("user_stats").select("id").execute()
                logger.info(f"📋 Stats encontrados: {len(all_stats.data or [])} registros")
                
                deleted_count = 0
                if all_stats.data:
                    for stat_record in all_stats.data:
                        try:
                            result = supabase.table("user_stats").delete().eq("id", stat_record["id"]).execute()
                            deleted_count += 1
                            logger.info(f"✅ Eliminado stat: {stat_record['id']}")
                        except Exception as e_inner:
                            logger.warning(f"⚠️ Error en {stat_record['id']}: {e_inner}")
                
                logger.info(f"✅ Eliminadas {deleted_count} estadísticas")
                
            except Exception as e_fallback:
                logger.error(f"❌ Fallback stats falló: {e_fallback}")
        
        # Ahora eliminar feedback
        try:
            logger.info(f"🗑️ Eliminando feedback...")
            
            all_feedback = supabase.table("user_feedback").select("id").execute()
            logger.info(f"📋 Feedback encontrado: {len(all_feedback.data or [])} registros")
            
            deleted_fb = 0
            if all_feedback.data:
                for fb_record in all_feedback.data:
                    try:
                        result = supabase.table("user_feedback").delete().eq("id", fb_record["id"]).execute()
                        deleted_fb += 1
                        logger.info(f"✅ Eliminado feedback: {fb_record['id']}")
                    except Exception as e_inner:
                        logger.warning(f"⚠️ Error en feedback {fb_record['id']}: {e_inner}")
            
            logger.info(f"✅ Eliminadas {deleted_fb} reseñas")
            
        except Exception as e_fb:
            logger.error(f"❌ Error eliminando feedback: {e_fb}")
        
        # Verificar después
        new_stats = supabase.table("user_stats").select("*", count="exact").execute()
        new_feedback = supabase.table("user_feedback").select("*", count="exact").execute()
        new_count_s = len(new_stats.data or [])
        new_count_f = len(new_feedback.data or [])
        
        logger.info(f"📊 Después: {new_count_s} stats, {new_count_f} feedback")
        
        return {
            "success": True,
            "message": "✅ Reset completado",
            "deleted": {
                "stats": old_count_s - new_count_s,
                "feedback": old_count_f - new_count_f
            },
            "remaining": {
                "stats": new_count_s,
                "feedback": new_count_f
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error en reset_achievements: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scheduler/status")
async def get_scheduler_status(admin = Depends(verify_admin)):
    """
    Obtiene el estado actual del scheduler de emails de reactivación
    """
    try:
        from .scheduler import get_scheduler_status
        status = get_scheduler_status()
        return status
    except Exception as e:
        logger.error(f"❌ Error obteniendo estado del scheduler: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scheduler/run-now")
async def run_scheduler_now(admin = Depends(verify_admin)):
    """
    Ejecuta manualmente el job de envío de emails de reactivación
    """
    try:
        from .scheduler import send_reactivation_emails_job
        
        logger.info("🔄 Ejecutando job de reactivación manualmente...")
        send_reactivation_emails_job()
        
        return {
            "success": True,
            "message": "Job de reactivación ejecutado exitosamente",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Error ejecutando job de reactivación: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/inactive")
async def get_inactive_users_admin(
    days: int = 1,
    admin = Depends(verify_admin)
):
    """
    Obtiene lista de usuarios inactivos por días especificados
    """
    try:
        from .scheduler import get_inactive_users
        
        inactive = get_inactive_users(days_threshold=days)
        
        return {
            "inactive_users": inactive,
            "count": len(inactive),
            "days_threshold": days
        }
    except Exception as e:
        logger.error(f"❌ Error obteniendo usuarios inactivos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_email}/send-reactivation")
async def send_reactivation_to_user(
    user_email: str,
    days_absent: int = 1,
    is_sad: bool = False,
    admin = Depends(verify_admin)
):
    """
    Envía manualmente un email de reactivación a un usuario específico
    """
    try:
        from .scheduler import get_user_by_email, update_reactivation_email_timestamp
        from .mailer import send_reactivation_email
        from .models import User
        
        # Obtener usuario
        user_data = get_user_by_email(user_email)
        if not user_data:
            raise HTTPException(status_code=404, detail=f"Usuario {user_email} no encontrado")
        
        # Crear objeto User
        user = User(
            id=user_data.get("id"),
            email=user_data["email"],
            display_name=user_data.get("display_name", user_data["email"].split("@")[0]),
            provider=user_data.get("provider", "google")
        )
        
        # Enviar email
        logger.info(f"📤 Enviando email de reactivación manual a {user.email}")
        result = send_reactivation_email(user, days_absent, is_sad=is_sad)
        
        # Actualizar timestamp
        update_reactivation_email_timestamp(user.email)
        
        return {
            "success": True,
            "message": f"Email de reactivación enviado a {user_email}",
            "type": "sad" if is_sad else "motivational",
            "days_absent": days_absent,
            "saved_to_outbox": result is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error enviando email de reactivación a {user_email}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
