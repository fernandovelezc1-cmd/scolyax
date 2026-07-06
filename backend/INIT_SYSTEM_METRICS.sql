-- Script para inicializar system_metrics con un registro por defecto
-- Ejecutar esto en la consola SQL de Supabase si el contador de cache no funciona

-- Verificar si ya existe un registro
SELECT COUNT(*) as record_count FROM system_metrics;

-- Si la tabla está vacía (COUNT = 0), ejecutar esto:
INSERT INTO system_metrics (
    total_users,
    active_users_30d, 
    summaries_generated,
    tasks_completed,
    cache_hits,
    retention_rate,
    avg_session_duration,
    updated_at
) VALUES (
    0,
    0,
    0, 
    0,
    0,
    0,
    0,
    CURRENT_TIMESTAMP
);

-- Verificar que se creó correctamente
SELECT * FROM system_metrics LIMIT 1;
