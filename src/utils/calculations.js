export const PERIODICIDADES = [
  { label: 'Mensual', value: 'mensual', months: 1 },
  { label: 'Bimensual', value: 'bimensual', months: 2 },
  { label: 'Trimestral', value: 'trimestral', months: 3 },
  { label: 'Semestral', value: 'semestral', months: 6 },
  { label: 'Anual', value: 'anual', months: 12 },
];

export function parseAmount(str) {
  if (!str && str !== 0) return 0;
  return parseFloat(String(str).replace(/[^0-9.]/g, '')) || 0;
}

export function toMonthly(amount, periodicidad) {
  const p = PERIODICIDADES.find(p => p.value === periodicidad);
  const months = p ? p.months : 1;
  return parseAmount(amount) / months;
}

export function toAnnual(amount, periodicidad) {
  return toMonthly(amount, periodicidad) * 12;
}

export function formatCOP(amount) {
  const num = Math.round(amount || 0);
  try {
    // Intenta locale colombiano; puede fallar en algunos Android sin datos CLDR completos
    const formatted = num.toLocaleString('es-CO');
    if (formatted && formatted !== String(num)) return '$' + formatted;
  } catch { /* fallback */ }
  // Fallback manual: separadores de miles con punto
  return '$' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Fusiona transacciones individuales (tabla `transacciones`) con los totales
 * del presupuesto para que el bot y el FAB aparezcan en el Dashboard.
 */
export function mergeTransacciones(baseTotals, transacciones) {
  // Guard: si no hay base (mes sin datos de presupuesto), crear estructura vacía
  const base = baseTotals || {
    ingresosMonthly: 0, ingresosAnual: 0,
    totalGastosMonthly: 0, totalGastosAnual: 0,
    esencialesMonthly: 0, noEsencialesMonthly: 0,
    creditosMonthly: 0, ahorroMonthly: 0,
    flujoCaja: 0, flujoCajaAnual: 0,
    flujoCajaConAhorro: 0, flujoCajaConAhorroAnual: 0,
    fondoEmergencia: 0,
    gastosByCategory: {}, ingresosBySource: {},
  };

  if (!transacciones || transacciones.length === 0) return base;

  const t = {
    ...base,
    gastosByCategory: { ...base.gastosByCategory },
    ingresosBySource: { ...base.ingresosBySource },
  };

  for (const tx of transacciones) {
    const monto = Number(tx.monto) || 0;
    if (monto <= 0) continue;

    if (tx.tipo === 'ingreso') {
      t.ingresosMonthly += monto;
      const src = tx.categoria || 'otros';
      t.ingresosBySource[src] = (t.ingresosBySource[src] || 0) + monto;
    } else {
      t.totalGastosMonthly += monto;
      const cat = tx.categoria || 'otro';
      t.gastosByCategory[cat] = (t.gastosByCategory[cat] || 0) + monto;
      if (cat === 'creditos') t.creditosMonthly += monto;
      else t.noEsencialesMonthly += monto;
    }
  }

  t.ingresosAnual           = t.ingresosMonthly * 12;
  t.totalGastosAnual        = t.totalGastosMonthly * 12;
  t.flujoCaja               = t.ingresosMonthly - t.totalGastosMonthly;
  t.flujoCajaAnual          = t.flujoCaja * 12;
  t.flujoCajaConAhorro      = t.ingresosMonthly - t.ahorroMonthly - t.totalGastosMonthly;
  t.flujoCajaConAhorroAnual = t.flujoCajaConAhorro * 12;
  t.fondoEmergencia         = t.esencialesMonthly * 3;

  return t;
}

export function computeTotals(data) {
  if (!data) return null;

  const ingresosBySource = {};
  let ingresosMonthly = 0;
  for (const [key, item] of Object.entries(data.ingresos)) {
    const monthly = toMonthly(item.monto, item.periodicidad);
    ingresosBySource[key] = monthly;
    ingresosMonthly += monthly;
  }

  const gastosByCategory = {};
  let totalGastosMonthly = 0;
  let esencialesMonthly = 0;
  let noEsencialesMonthly = 0;
  let creditosMonthly = 0;

  for (const [catKey, catItems] of Object.entries(data.gastos)) {
    let catTotal = 0;
    for (const item of Object.values(catItems)) {
      const monthly = toMonthly(item.monto, item.periodicidad);
      catTotal += monthly;
      totalGastosMonthly += monthly;
      if (catKey === 'creditos') {
        creditosMonthly += monthly;
      } else if (item.esencial) {
        esencialesMonthly += monthly;
      } else {
        noEsencialesMonthly += monthly;
      }
    }
    gastosByCategory[catKey] = catTotal;
  }

  const ahorroMonthly = toMonthly(data.ahorro.monto, data.ahorro.periodicidad);

  return {
    ingresosMonthly,
    ingresosAnual: ingresosMonthly * 12,
    totalGastosMonthly,
    totalGastosAnual: totalGastosMonthly * 12,
    flujoCaja: ingresosMonthly - totalGastosMonthly,
    flujoCajaAnual: (ingresosMonthly - totalGastosMonthly) * 12,
    flujoCajaConAhorro: ingresosMonthly - ahorroMonthly - totalGastosMonthly,
    flujoCajaConAhorroAnual: (ingresosMonthly - ahorroMonthly - totalGastosMonthly) * 12,
    ahorroMonthly,
    ahorroAnual: ahorroMonthly * 12,
    gastosByCategory,
    esencialesMonthly,
    noEsencialesMonthly,
    creditosMonthly,
    fondoEmergencia: esencialesMonthly * 3,
    ingresosBySource,
  };
}
