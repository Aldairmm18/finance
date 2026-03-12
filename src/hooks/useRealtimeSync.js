import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

/**
 * Suscribe a cambios en la tabla `transacciones` via Supabase Realtime.
 * Cuando el bot (u otra fuente) inserta/actualiza/elimina una fila,
 * llama a onUpdate() para que la UI refresque los datos.
 *
 * Requisito en Supabase:
 *   ALTER PUBLICATION supabase_realtime ADD TABLE transacciones;
 *
 * @param {Function} onUpdate  Callback(payload) llamado al recibir un evento
 */
export function useRealtimeSync(onUpdate) {
  const channelRef  = useRef(null);
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;   // siempre apunta al callback más reciente

  useEffect(() => {
    if (!supabase) return;  // sin cliente, no suscribir

    const channel = supabase
      .channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transacciones' },
        (payload) => callbackRef.current?.(payload),
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // suscribir una sola vez
}
