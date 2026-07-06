-- Tabla para gestionar correos administrativos
CREATE TABLE IF NOT EXISTS admin_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    permissions TEXT[] DEFAULT ARRAY['read', 'write', 'delete'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    description TEXT
);

-- Tabla de auditoría para acciones administrativas
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(50) DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_email) REFERENCES admin_emails(email) ON DELETE SET NULL
);

-- Tabla de caché de respuestas de IA para persistir entre deploys
CREATE TABLE IF NOT EXISTS ai_responses_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(16) UNIQUE NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas rápidas por cache_key
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_responses_cache(cache_key);

-- Tabla de estadísticas y métricas del sistema
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_users INTEGER DEFAULT 0,
    active_users_30d INTEGER DEFAULT 0,
    summaries_generated INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    retention_rate DECIMAL(5,2) DEFAULT 0,
    avg_session_duration INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para registrar intentos de acceso administrativo
CREATE TABLE IF NOT EXISTS admin_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    access_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_granted BOOLEAN DEFAULT FALSE,
    reason TEXT,
    ip_address VARCHAR(45)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_admin_emails_email ON admin_emails(email);
CREATE INDEX IF NOT EXISTS idx_admin_emails_is_active ON admin_emails(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_email ON admin_audit_log(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_email ON admin_access_logs(email);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_created_at ON admin_access_logs(access_attempt_at);

-- Insertar el correo administrativo principal
INSERT INTO admin_emails (email, full_name, permissions, description)
VALUES (
    'appscolyax@gmail.com',
    'Administrador Principal',
    ARRAY['read', 'write', 'delete', 'admin'],
    'Correo administrativo principal del sistema Scolyax'
) ON CONFLICT (email) DO NOTHING;

-- Crear vista para estadísticas de acceso administrativo
CREATE OR REPLACE VIEW admin_access_stats AS
SELECT 
    email,
    COUNT(*) as total_attempts,
    SUM(CASE WHEN access_granted THEN 1 ELSE 0 END) as successful_attempts,
    SUM(CASE WHEN NOT access_granted THEN 1 ELSE 0 END) as failed_attempts,
    MAX(access_attempt_at) as last_attempt,
    DATE(access_attempt_at) as attempt_date
FROM admin_access_logs
GROUP BY email, DATE(access_attempt_at)
ORDER BY attempt_date DESC;
