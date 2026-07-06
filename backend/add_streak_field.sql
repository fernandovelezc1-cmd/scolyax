-- Migración para agregar campo streak_days a la tabla users
-- Si ya existe, no causa error

ALTER TABLE users
ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0;

-- Crear índice para consultas de streak
CREATE INDEX IF NOT EXISTS idx_users_streak_days ON users(streak_days);

-- Agregar columna para rastrear el último día de actividad
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_activity_date DATE;

-- Crear índice para last_activity_date
CREATE INDEX IF NOT EXISTS idx_users_last_activity_date ON users(last_activity_date);

-- Agregar columnas de gamificación
ALTER TABLE users
ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- Log del cambio
SELECT 'Migración completada: Se agregaron campos de gamificación a users' as result;
