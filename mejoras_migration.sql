-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN FINANCE APP — Mejoras 1, 2 y 4
-- Ejecutar en: https://supabase.com/dashboard → proyecto scvltqqtkjazopjyauyv → SQL Editor
-- NOTA: La tabla de transacciones se llama 'transacciones' en este proyecto
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- MEJORA 1 — Subcategorías personalizadas
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subcategories (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_key    TEXT NOT NULL,
  name            TEXT NOT NULL,
  icon            TEXT NOT NULL,      -- nombre del ícono de MaterialCommunityIcons
  color           TEXT NOT NULL,      -- hex color
  duration_months INT  DEFAULT NULL,  -- NULL = sin límite, N = activa N meses
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subcategories"
  ON subcategories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_subcategories_user_category
  ON subcategories(user_id, category_key);

-- Agregar subcategory_id a transacciones (nullable)
ALTER TABLE transacciones
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- MEJORA 2 — Ingresos recurrentes multi-mes
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE transacciones
  ADD COLUMN IF NOT EXISTS recurrence_months   INT  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_transacciones_recurrence
  ON transacciones(recurrence_group_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- MEJORA 4 — Pagos recurrentes con notificaciones
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recurring_payments (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  amount             NUMERIC(12,2) NOT NULL,
  category_key       TEXT NOT NULL,
  subcategory_id     UUID REFERENCES subcategories(id) ON DELETE SET NULL,
  day_of_month       INT NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  notify_days_before INT DEFAULT 3,
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recurring payments"
  ON recurring_payments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
