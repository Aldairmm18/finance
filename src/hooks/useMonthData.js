import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  loadDataMes, loadDataMesCache, loadTransaccionesMesCache, fetchTransaccionesMesRemote,
} from '../utils/storage';
import { computePlan, computeActuals } from '../utils/calculations';
import { useRealtimeSync } from './useRealtimeSync';

const EMPTY = { mes: null, budget: null, txs: null, status: 'loading' };

/**
 * Presupuesto + movimientos de un mes con estrategia stale-while-revalidate:
 * primero la caché local (render instantáneo), luego la red.
 *
 * status: 'loading' (sin datos aún) | 'cached' (mostrando caché, red en curso)
 *         | 'live' (datos frescos) | 'offline' (la red falló, se muestra caché)
 */
export function useMonthData(mes, { withPlan = true } = {}) {
  // Los datos se guardan junto con el mes al que pertenecen: si el mes cambia,
  // lo guardado deja de valer y se muestra "cargando" sin efectos extra.
  const [data, setData] = useState(EMPTY);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestRef.current;
    const current = () => requestRef.current === id;

    const [cachedBudget, cachedTxs] = await Promise.all([
      withPlan ? loadDataMesCache(mes) : Promise.resolve(null),
      loadTransaccionesMesCache(mes),
    ]);
    if (!current()) return;
    setData(prev => ({
      mes,
      budget: cachedBudget,
      txs: cachedTxs,
      status: prev.mes === mes && prev.status === 'live' ? 'live' : 'cached',
    }));

    const [freshBudget, freshTxs] = await Promise.all([
      withPlan ? loadDataMes(mes) : Promise.resolve(null),
      fetchTransaccionesMesRemote(mes),
    ]);
    if (!current()) return;
    setData(prev => ({
      mes,
      budget: withPlan && freshBudget ? freshBudget : prev.budget,
      txs: freshTxs !== null ? freshTxs : prev.txs,
      status: freshTxs !== null ? 'live' : 'offline',
    }));
  }, [mes, withPlan]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useRealtimeSync(load);

  const view = data.mes === mes ? data : EMPTY;
  const plan = useMemo(() => computePlan(view.budget), [view.budget]);
  const actual = useMemo(() => computeActuals(view.txs), [view.txs]);

  return {
    budget: view.budget,
    txs: view.txs || [],
    plan,
    actual,
    status: view.status,
    reload: load,
    loaded: view.txs !== null,
  };
}
