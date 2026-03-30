/**
 * Utilidades de fecha compartidas entre pantallas.
 * Centraliza funciones que estaban duplicadas en
 * PresupuestoScreen, GastosScreen y ResumenMesScreen.
 */

/**
 * Devuelve el label legible de un mes en formato "YYYY-MM".
 * Ej: "2026-03" → "Marzo 2026"
 */
export function mesLabel(mes) {
  const [y, m] = mes.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  const str = d.toLocaleString('es-CO', { month: 'long', year: 'numeric' });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Suma o resta meses a un string "YYYY-MM".
 * Ej: addMes("2026-01", 1) → "2026-02"
 *     addMes("2026-01", -1) → "2025-12"
 */
export function addMes(mes, delta) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
