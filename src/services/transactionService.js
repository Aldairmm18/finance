import { supabase } from './supabase';

/**
 * Crea un ingreso recurrente insertando N copias de la transacción,
 * una por mes, todas compartiendo el mismo recurrence_group_id.
 */
export async function createRecurringIncome(userId, baseTransaction, recurrenceMonths) {
  const groupId = crypto.randomUUID();
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
