import { supabase } from './supabase';

export const subcategoryService = {
  async getByCategory(userId, categoryKey) {
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('user_id', userId)
      .eq('category_key', categoryKey)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getAll(userId) {
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('category_key', { ascending: true });
    if (error) throw error;
    return data;
  },

  async create(userId, payload) {
    const { data, error } = await supabase
      .from('subcategories')
      .insert([{ ...payload, user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('subcategories')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('subcategories')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  },
};
