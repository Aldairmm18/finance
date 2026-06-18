import { supabase } from './supabase';

/**
 * Genera un UUID v4 sin depender del global `crypto`, que no existe en
 * React Native (Hermes) sin polyfill. Suficiente para identificar grupos
 * de transacciones recurrentes (no requiere fuerza criptográfica).
 */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Crea un ingreso recurrente insertando N copias de la transacción,
 * una por mes, todas compartiendo el mismo recurrence_group_id.
 */
export async function createRecurringIncome(userId, baseTransaction, recurrenceMonths) {
  const groupId = uuidv4();
  const transactions = [];

  for (let i = 0; i < recurrenceMonths; i++) {
    const date = new Date(baseTransaction.fecha || baseTransaction.date);
    date.setMonth(date.getMonth() + i);

    transactions.push({
      ...baseTransaction,
      user_id: userId,
      fecha: date.toISOString().split('T')[0],  // columna correcta en Supabase
      recurrence_months: recurrenceMonths,
      recurrence_group_id: groupId,
    });
  }

  const { data, error } = await supabase
    .from('transacciones')
    .insert(transactions)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Edita solo una transacción de un grupo recurrente.
 */
export async function updateSingleTransaction(id, payload) {
  const { data, error } = await supabase
    .from('transacciones')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Edita este mes y todos los meses futuros de un grupo recurrente.
 * @param {string} groupId  - recurrence_group_id
 * @param {string} fromDate - fecha ISO 'YYYY-MM-DD' desde la cual aplicar
 * @param {object} payload  - campos a actualizar
 */
export async function updateFutureTransactions(groupId, fromDate, payload) {
  const { data, error } = await supabase
    .from('transacciones')
    .update(payload)
    .eq('recurrence_group_id', groupId)
    .gte('fecha', fromDate)
    .select();
  if (error) throw error;
  return data;
}
