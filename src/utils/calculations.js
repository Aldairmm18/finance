import { normalizeCategory } from './categories';

export const PERIODICIDADES = [
  { label: 'Mensual', value: 'mensual', months: 1 },
  { label: 'Bimensual', value: 'bimensual', months: 2 },
  { label: 'Trimestral', value: 'trimestral', months: 3 },
  { label: 'Semestral', value: 'semestral', months: 6 },
  { label: 'Anual', value: 'anual', months: 12 },
];

/** Parsea porcentajes y decimales simples ("7", "7.5"). No usar para montos COP. */
export function parseAmount(str) {
  if (!str && str !== 0) return 0;
  return parseFloat(String(str).replace(/[^0-9.]/g, '')) || 0;
}

/**
 * Parsea un monto en formato colombiano.
 * "1.500.000" → 1500000 · "1.500" → 1500 · "1.500,50" → 1500.5 · 1500 → 1500
 */
export function parseCOP(str) {
  if (typeof str === 'number') return Number.isFinite(str) ? str : 0;
  if (!str) return 0;
  const s = String(str).trim();

  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  const dots = (s.match(/\./g) || []).length;
  if (dots > 1) return parseFloat(s.replace(/\./g, '')) || 0;
  if (/\.\d{3}$/.test(s)) return parseFloat(s.replace('.', '')) || 0;
  return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

export function toMonthly(amount, periodicidad) {
  const p = PERIODICIDADES.find(x => x.value === periodicidad);
  return parseCOP(amount) / (p ? p.months : 1);
}

export function toAnnual(amount, periodicidad) {
  return toMonthly(amount, periodicidad) * 12;
}

function groupThousands(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** $1.234.567 · −$45.000 (sin depender de los datos de locale de Android). */
export function formatCOP(amount) {
  const num = Math.round(Number(amount) || 0);
  const abs = groupThousands(Math.abs(num));
  return num < 0 ? `−$${abs}` : `$${abs}`;
}

/** Igual que formatCOP pero abreviado para espacios estrechos: $1,2 M · $850 k */
export function formatCOPShort(amount) {
  const num = Math.round(Number(amount) || 0);
  const abs = Math.abs(num);
  const sign = num < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)} k`;
  return formatCOP(num);
}

// ─── Plan (presupuesto del mes) ──────────────────────────────────────────────

/**
 * Totales planeados a partir del presupuesto mensual.
 * byCategory usa las claves del catálogo (hogar, comida, …).
 */
export function computePlan(data) {
  const empty = {
    ingresos: 0, gastos: 0, ahorro: 0, esenciales: 0, noEsenciales: 0, creditos: 0,
    byCategory: {}, incomeBySource: {}, fondoEmergencia: 0,
  };
  if (!data) return empty;

  const plan = { ...empty, byCategory: {}, incomeBySource: {} };

  for (const [key, item] of Object.entries(data.ingresos || {})) {
    const monthly = toMonthly(item?.monto, item?.periodicidad);
    if (!monthly) continue;
    plan.ingresos += monthly;
    const k = normalizeCategory(key);
    plan.incomeBySource[k] = (plan.incomeBySource[k] || 0) + monthly;
  }

  for (const [catKey, items] of Object.entries(data.gastos || {})) {
    const k = normalizeCategory(catKey);
    for (const item of Object.values(items || {})) {
      const monthly = toMonthly(item?.monto, item?.periodicidad);
      if (!monthly) continue;
      plan.gastos += monthly;
      plan.byCategory[k] = (plan.byCategory[k] || 0) + monthly;
      if (k === 'creditos') plan.creditos += monthly;
      else if (item.esencial) plan.esenciales += monthly;
      else plan.noEsenciales += monthly;
    }
  }

  plan.ahorro = toMonthly(data.ahorro?.monto, data.ahorro?.periodicidad);
  plan.fondoEmergencia = plan.esenciales * 3;
  return plan;
}

// ─── Real (movimientos registrados) ──────────────────────────────────────────

export function computeActuals(transactions) {
  const actual = { ingresos: 0, gastos: 0, byCategory: {}, incomeBySource: {}, count: 0 };
  for (const tx of transactions || []) {
    const monto = Number(tx?.monto) || 0;
    if (monto <= 0) continue;
    actual.count += 1;
    const k = normalizeCategory(tx.categoria);
    if (tx.tipo === 'ingreso') {
      actual.ingresos += monto;
      actual.incomeBySource[k] = (actual.incomeBySource[k] || 0) + monto;
    } else {
      actual.gastos += monto;
      actual.byCategory[k] = (actual.byCategory[k] || 0) + monto;
    }
  }
  actual.balance = actual.ingresos - actual.gastos;
  return actual;
}

/**
 * Cruza plan y real por categoría de gasto, ordenado por lo más relevante.
 * @returns {{ key, planned, spent, ratio }[]}
 */
export function compareByCategory(plan, actual) {
  const keys = new Set([...Object.keys(plan?.byCategory || {}), ...Object.keys(actual?.byCategory || {})]);
  return Array.from(keys)
    .map(key => {
      const planned = plan?.byCategory?.[key] || 0;
      const spent = actual?.byCategory?.[key] || 0;
      return { key, planned, spent, ratio: planned > 0 ? spent / planned : spent > 0 ? Infinity : 0 };
    })
    .filter(r => r.planned > 0 || r.spent > 0)
    .sort((a, b) => Math.max(b.spent, b.planned) - Math.max(a.spent, a.planned));
}
