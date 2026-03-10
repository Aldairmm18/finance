-- =============================================================================
-- Finance App: Habilitar RLS y crear tabla telegram_users
-- Ejecutar en el SQL Editor de Supabase Dashboard
-- =============================================================================

-- ─── 1. Tabla telegram_users para vincular Telegram ↔ App ────────────────────

CREATE TABLE IF NOT EXISTS telegram_users (
    chat_id     BIGINT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    linked_at   TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. Habilitar RLS en todas las tablas ────────────────────────────────────

ALTER TABLE presupuesto         ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_mensual ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion       ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_users      ENABLE ROW LEVEL SECURITY;

-- ─── 3. Policies para presupuesto ────────────────────────────────────────────

CREATE POLICY "presupuesto_sel" ON presupuesto
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "presupuesto_ins" ON presupuesto
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "presupuesto_upd" ON presupuesto
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "presupuesto_del" ON presupuesto
    FOR DELETE USING (auth.uid()::text = user_id);

-- ─── 4. Policies para presupuesto_mensual ────────────────────────────────────

CREATE POLICY "presupuesto_mensual_sel" ON presupuesto_mensual
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "presupuesto_mensual_ins" ON presupuesto_mensual
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "presupuesto_mensual_upd" ON presupuesto_mensual
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "presupuesto_mensual_del" ON presupuesto_mensual
    FOR DELETE USING (auth.uid()::text = user_id);

-- ─── 5. Policies para transacciones ─────────────────────────────────────────

CREATE POLICY "transacciones_sel" ON transacciones
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "transacciones_ins" ON transacciones
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "transacciones_upd" ON transacciones
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "transacciones_del" ON transacciones
    FOR DELETE USING (auth.uid()::text = user_id);

-- ─── 6. Policies para configuracion ─────────────────────────────────────────

CREATE POLICY "configuracion_sel" ON configuracion
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "configuracion_ins" ON configuracion
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "configuracion_upd" ON configuracion
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "configuracion_del" ON configuracion
    FOR DELETE USING (auth.uid()::text = user_id);

-- ─── 7. Policies para telegram_users ────────────────────────────────────────
-- Los usuarios autenticados pueden ver/modificar solo sus propios vínculos.
-- El bot usa la service_role key, así que bypasea RLS automáticamente.

CREATE POLICY "telegram_users_sel" ON telegram_users
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "telegram_users_ins" ON telegram_users
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "telegram_users_upd" ON telegram_users
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "telegram_users_del" ON telegram_users
    FOR DELETE USING (auth.uid()::text = user_id);

-- ─── FIN ─────────────────────────────────────────────────────────────────────
