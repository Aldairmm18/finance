/**
 * Utilidades de fecha. Todo se calcula en hora local: usar toISOString()
 * sobre una fecha local corre el día en zonas horarias distintas a UTC.
 */

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const pad = (n) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" en hora local. */
export function localISODate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Mes actual en formato "YYYY-MM". */
export function getCurrentMes() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** "2026-03" → "Marzo 2026" */
export function mesLabel(mes) {
  const [y, m] = mes.split('-').map(Number);
  const name = MONTHS[m - 1] || '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** Nombre corto del mes (índice 0-11): "ene" */
export function monthShort(idx) {
  return MONTHS_SHORT[idx] || '';
}

/** Suma o resta meses a "YYYY-MM". */
export function addMes(mes, delta) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Primer y último día de un mes "YYYY-MM" como "YYYY-MM-DD". */
export function monthRange(mes) {
  const [y, m] = mes.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDay)}` };
}

/** "Hoy", "Ayer" o "12 oct" para una fecha "YYYY-MM-DD". */
export function dayLabel(fecha) {
  if (!fecha) return '';
  const today = localISODate();
  const yesterday = localISODate(new Date(Date.now() - 86400000));
  if (fecha === today) return 'Hoy';
  if (fecha === yesterday) return 'Ayer';
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1] || ''}`;
}

/**
 * Fecha del próximo cobro de un pago mensual en el día `day`, ajustada al
 * último día del mes cuando el mes es más corto (día 31 en febrero → 28/29).
 */
export function nextMonthlyDate(day, from = new Date()) {
  const clampDate = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()), 9, 0, 0);
  let candidate = clampDate(from.getFullYear(), from.getMonth());
  if (candidate <= from) candidate = clampDate(from.getFullYear(), from.getMonth() + 1);
  return candidate;
}
