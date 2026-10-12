-- =============================================================================
-- Finance App: eliminación de cuenta desde la app (requisito de Google Play)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- =============================================================================
-- La app llama a supabase.rpc('delete_own_account'). La función corre con
-- privilegios del dueño (SECURITY DEFINER) pero solo puede borrar la cuenta de
-- quien la invoca (auth.uid()), nunca la de otra persona.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;

    -- Tablas con user_id de tipo TEXT (sin llave foránea a auth.users)
    DELETE FROM transacciones       WHERE user_id = uid::text;
    DELETE FROM presupuesto_mensual WHERE user_id = uid::text;
    DELETE FROM presupuesto         WHERE user_id = uid::text;
    DELETE FROM configuracion       WHERE user_id = uid::text;
    DELETE FROM telegram_users      WHERE user_id = uid::text;

    -- recurring_payments, subcategories y link_tokens se borran en cascada
    -- (ON DELETE CASCADE hacia auth.users).
    DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
