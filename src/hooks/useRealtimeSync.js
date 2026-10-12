import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Bus de cambios locales ──────────────────────────────────────────────────
// Cuando la app crea/edita/borra un movimiento, avisa a las pantallas montadas
// para que recarguen sin esperar a Realtime.

const listeners = new Set();

export function notifyTransactionsChanged() {
  listeners.forEach(fn => {
    try { fn(); } catch { /* un listener roto no bloquea a los demás */ }
  });
}

/**
 * Llama a onUpdate cuando cambian los movimientos del usuario: por la app
 * (notifyTransactionsChanged) o por otra fuente como el bot (Supabase Realtime).
 *
 * Requisito en Supabase: ALTER PUBLICATION supabase_realtime ADD TABLE transacciones;
 */
export function useRealtimeSync(onUpdate) {
  const { user } = useAuth();
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    const local = () => callbackRef.current?.();
    listeners.add(local);
    return () => { listeners.delete(local); };
  }, []);

  useEffect(() => {
    if (!supabase || !user?.id) return undefined;
    const channel = supabase
      .channel(`txns-${user.id}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transacciones', filter: `user_id=eq.${user.id}` },
        () => callbackRef.current?.(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);
}
