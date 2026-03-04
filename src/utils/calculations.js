export const COLORS = {
  bg: '#0a0a1a',
  card: '#12122a',
  border: '#2a2a4a',
  teal: '#2dd4bf',
  pink: '#f472b6',
  purple: '#818cf8',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
};

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
  return '$' + num.toLocaleString('es-CO');
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
