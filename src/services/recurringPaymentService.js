import { supabase } from './supabase';

export const recurringPaymentService = {
  async getAll(userId) {
    const { data, error } = await supabase
      .from('recurring_payments')
      .select('*, subcategories(name, icon, color)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('day_of_month', { ascending: true });
    if (error) throw error;
    return data;
  },

  /** El dueño lo asigna la base de datos (user_id DEFAULT auth.uid() + RLS). */
  async create(payload) {
    const { data, error } = await supabase
      .from('recurring_payments')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('recurring_payments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('recurring_payments')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  },
};
