-- ═══════════════════════════════════════════════════════════════════════════════
-- Datos de ejemplo para la cuenta de revisión de Google Play
-- Cuenta: finance.revisiondev@gmail.com (debe existir: se crea desde la app)
-- Ejecutar en Supabase → SQL Editor. Se puede correr varias veces: primero borra
-- los datos de ESA cuenta y luego los vuelve a cargar. No toca ninguna otra cuenta.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  uid UUID;
  plan JSONB := '{
    "ingresos": { "salario": { "monto": "4500000", "periodicidad": "mensual" } },
    "gastos": {
      "hogar": {
        "arriendo": { "monto": "1400000", "periodicidad": "mensual", "esencial": true },
        "luz":      { "monto": "120000",  "periodicidad": "mensual", "esencial": true },
        "internet": { "monto": "90000",   "periodicidad": "mensual", "esencial": true }
      },
      "comida": {
        "mercado":      { "monto": "800000", "periodicidad": "mensual", "esencial": true },
        "comidasFuera": { "monto": "250000", "periodicidad": "mensual", "esencial": false }
      },
      "transporte": {
        "transportePublico": { "monto": "200000", "periodicidad": "mensual", "esencial": true },
        "seguroAuto":        { "monto": "960000", "periodicidad": "anual",   "esencial": true }
      },
      "salud": {
        "medicamentos": { "monto": "80000", "periodicidad": "mensual", "esencial": true }
      },
      "entretenimiento": {
        "restaurantes": { "monto": "150000", "periodicidad": "mensual", "esencial": false },
        "diversion":    { "monto": "100000", "periodicidad": "mensual", "esencial": false }
      },
      "familia": {
        "suscripciones": { "monto": "45000", "periodicidad": "mensual", "esencial": false }
      }
    },
    "ahorro": { "monto": "600000", "periodicidad": "mensual" },
    "tranquilidad": {
      "gastosMensualesDeseados": "4000000",
      "rentabilidadAnual": "7",
      "patrimonioActual": "25000000"
    }
  }';
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'finance.revisiondev@gmail.com';
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No existe la cuenta finance.revisiondev@gmail.com. Créala primero desde la app.';
  END IF;

  DELETE FROM transacciones       WHERE user_id = uid;
  DELETE FROM recurring_payments  WHERE user_id = uid;
  DELETE FROM presupuesto_mensual WHERE user_id = uid;
  DELETE FROM presupuesto         WHERE user_id = uid;

  -- Plan base y plan de septiembre y octubre
  INSERT INTO presupuesto (user_id, datos, updated_at) VALUES (uid, plan, NOW());
  INSERT INTO presupuesto_mensual (user_id, mes, datos, updated_at) VALUES
    (uid, '2026-09', plan, NOW()),
    (uid, '2026-10', plan, NOW());

  -- Movimientos
  INSERT INTO transacciones (user_id, tipo, monto, categoria, subcategoria, descripcion, fecha, fuente, es_extraordinario) VALUES
    -- Septiembre
    (uid, 'ingreso', 4500000, 'salario',         'otro', 'Salario septiembre',   '2026-09-01', 'app', false),
    (uid, 'gasto',   1400000, 'hogar',           'otro', 'Arriendo',             '2026-09-05', 'app', false),
    (uid, 'gasto',    412000, 'comida',          'otro', 'Mercado del mes',      '2026-09-06', 'app', false),
    (uid, 'gasto',    118500, 'hogar',           'otro', 'Factura de luz',       '2026-09-10', 'app', false),
    (uid, 'gasto',     64000, 'comida',          'otro', 'Almuerzo con amigos',  '2026-09-13', 'app', false),
    (uid, 'gasto',     90000, 'hogar',           'otro', 'Internet',             '2026-09-20', 'app', false),
    (uid, 'gasto',    356000, 'comida',          'otro', 'Mercado',              '2026-09-21', 'app', false),
    (uid, 'gasto',    180000, 'transporte',      'otro', 'Recarga tarjeta bus',  '2026-09-02', 'app', false),
    (uid, 'gasto',     72000, 'salud',           'otro', 'Farmacia',             '2026-09-17', 'app', false),
    (uid, 'gasto',    135000, 'entretenimiento', 'otro', 'Cine y cena',          '2026-09-26', 'app', false),
    (uid, 'gasto',     45000, 'familia',         'otro', 'Suscripción streaming','2026-09-25', 'app', false),
    -- Octubre
    (uid, 'ingreso', 4500000, 'salario',         'otro', 'Salario octubre',      '2026-10-01', 'app', false),
    (uid, 'ingreso',  350000, 'otros',           'otro', 'Venta bicicleta vieja','2026-10-08', 'app', false),
    (uid, 'gasto',    180000, 'transporte',      'otro', 'Recarga tarjeta bus',  '2026-10-02', 'app', false),
    (uid, 'gasto',   1400000, 'hogar',           'otro', 'Arriendo',             '2026-10-05', 'app', false),
    (uid, 'gasto',    385000, 'comida',          'otro', 'Mercado',              '2026-10-04', 'app', false),
    (uid, 'gasto',    122300, 'hogar',           'otro', 'Factura de luz',       '2026-10-10', 'app', false),
    (uid, 'gasto',     38000, 'comida',          'otro', 'Domicilio',            '2026-10-11', 'app', false),
    (uid, 'gasto',     95000, 'salud',           'otro', 'Consulta médica',      '2026-10-09', 'app', false),
    (uid, 'gasto',     86000, 'entretenimiento', 'otro', 'Restaurante',          '2026-10-12', 'app', false),
    (uid, 'gasto',     52000, 'comida',          'otro', 'Panadería y café',     '2026-10-13', 'app', false);

  -- Pagos fijos
  INSERT INTO recurring_payments (user_id, name, amount, category_key, day_of_month, notify_days_before) VALUES
    (uid, 'Arriendo',  1400000, 'hogar',   5, 3),
    (uid, 'Internet',    90000, 'hogar',  20, 3),
    (uid, 'Streaming',   45000, 'familia',25, 2);
END $$;
