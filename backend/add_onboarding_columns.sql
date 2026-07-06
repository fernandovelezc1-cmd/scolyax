-- Agregar columnas de onboarding a la tabla users
-- Ejecutar en Supabase SQL Editor

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS selected_tool VARCHAR(50),
ADD COLUMN IF NOT EXISTS recommended_tools TEXT[];

-- Crear índice para buscar usuarios que no han completado onboarding
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(has_completed_onboarding);

-- Comentarios para documentación
COMMENT ON COLUMN users.has_completed_onboarding IS 'Indica si el usuario completó el test cognitivo de onboarding';
COMMENT ON COLUMN users.selected_tool IS 'Herramienta seleccionada por el usuario después del test (tasks, pomodoro, reminders, schedule, summary, focus, achievements, gamification)';
COMMENT ON COLUMN users.recommended_tools IS 'Array de herramientas recomendadas por el test cognitivo';
