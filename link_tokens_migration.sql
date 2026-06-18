-- =============================================================================
-- Finance App: Tabla link_tokens para vincular Telegram sin exponer contraseñas
-- Ejecutar en el SQL Editor de Supabase Dashboard
-- =============================================================================

-- 1. Crear tabla
CREATE TABLE IF NOT EXISTS link_tokens (
    token       TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
    used        BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para limpiar tokens expirados eficientemente
CREATE INDEX IF NOT EXISTS link_tokens_expires_idx ON link_tokens (expires_at);

-- 2. RLS
ALTER TABLE link_tokens ENABLE ROW LEVEL SECURITY;

-- El usuario autenticado puede crear y leer sus propios tokens
CREATE POLICY "link_tokens_ins" ON link_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "link_tokens_sel" ON link_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "link_tokens_del" ON link_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Nota: el bot usa la service_role key → bypasea RLS automáticamente
-- para poder marcar tokens como usados y crear registros en telegram_users.

-- 3. Función de limpieza automática (opcional, ejecutar como cron en Supabase)
-- SELECT cron.schedule('cleanup-link-tokens', '*/10 * * * *',
--   $$DELETE FROM link_tokens WHERE expires_at < now()$$);
