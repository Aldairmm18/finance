-- =============================================================================
-- Finance App: la base de datos asigna el dueño de cada fila
-- Ejecutar UNA VEZ en el SQL Editor de Supabase, ANTES de publicar la versión
-- de la app que ya no envía user_id al crear pagos fijos y subcategorías.
-- =============================================================================
-- La app deja de mandar user_id: lo pone Postgres con auth.uid() (la sesión
-- de quien hace la petición) y las políticas RLS existentes (WITH CHECK
-- auth.uid() = user_id) siguen verificándolo. Así no hay ningún campo de
-- dueño controlado por el cliente.

ALTER TABLE recurring_payments ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE subcategories      ALTER COLUMN user_id SET DEFAULT auth.uid();
