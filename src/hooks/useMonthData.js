import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  loadDataMes, loadDataMesCache, loadTransaccionesMesCache, fetchTransaccionesMesRemote,
} from '../utils/storage';
import { computePlan, computeActuals } from '../utils/calculations';
import { useRealtimeSync } from './useRealtimeSync';

/**
 * Presupuesto + movimientos de un mes con estrategia stale-while-revalidate:
 * primero la caché local (render instantáneo), luego la red.
 *
 * status: 'loading' (sin datos aún) | 'cached' (mostrando caché, red en curso)
 *         | 'live' (datos frescos) | 'offline' (la red falló, se muestra caché)
 */
export function useMonthData(mes, { withPlan = true } = {}) {
  const [budget, setBudget] = useState(null);
  const [txs, setTxs] = useState(null);
  const [status, setStatus] = useState('loading');
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestRef.current;
    const current = () => requestRef.current === id;

    const [cachedBudget, cachedTxs] = await Promise.all([
      withPlan ? loadDataMesCache(mes) : Promise.resolve(null),
      loadTransaccionesMesCache(mes),
    ]);
    if (!current()) return;
    setBudget(cachedBudget);
    setTxs(cachedTxs);
    setStatus(s => (s === 'live' ? 'live' : 'cached'));

    const [freshBudget, freshTxs] = await Promise.all([
      withPlan ? loadDataMes(mes) : Promise.resolve(null),
      fetchTransaccionesMesRemote(mes),
    ]);
    if (!current()) return;
    if (withPlan && freshBudget) setBudget(freshBudget);
    if (freshTxs !== null) {
      setTxs(freshTxs);
      setStatus('live');
    } else {
      setStatus('offline');
    }
  }, [mes, withPlan]);

  // Al cambiar de mes, no mostrar los datos del mes anterior mientras carga.
  useEffect(() => {
    setStatus('loading');
    setTxs(null);
    setBudget(null);
  }, [mes]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useRealtimeSync(load);

  const plan = useMemo(() => computePlan(budget), [budget]);
  const actual = useMemo(() => computeActuals(txs), [txs]);

  return { budget, txs: txs || [], plan, actual, status, reload: load, loaded: txs !== null };
}
