import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { getCurrentMes, localISODate, monthRange, addMes } from './dateUtils';

export { getCurrentMes };

const STORAGE_KEY = '@finance_data_v1';
const STORAGE_MES_PREFIX = '@finance_mes_v1';
const STORAGE_TXS_PREFIX = '@finance_txs_v1';
const PENDING_KEY = '@finance_pending_v1';        // meses con cambios sin subir
const ROLLOVER_PREFIX = '@finance_rollover_v1';   // avisos de sobrante descartados
export const SYNC_KEY = '@finance_last_sync';

// ─── Sesión ──────────────────────────────────────────────────────────────────

let _cachedUserId = null;

async function getUserId() {
  if (_cachedUserId) return _cachedUserId;
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    _cachedUserId = session?.user?.id || null;
    return _cachedUserId;
  } catch {
    return null;
  }
}

export function clearUserIdCache() {
  _cachedUserId = null;
}

/**
 * Borra toda la caché financiera local. Se llama al cerrar sesión para que el
 * siguiente usuario del dispositivo no vea datos del anterior.
 */
export async function clearLocalCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(k =>
      k === STORAGE_KEY || k === SYNC_KEY || k === PENDING_KEY ||
      k.startsWith(STORAGE_MES_PREFIX) || k.startsWith(STORAGE_TXS_PREFIX) || k.startsWith(ROLLOVER_PREFIX)
    );
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  } catch { /* no bloquear el logout por un fallo de caché */ }
}

// ─── Estructura por defecto ──────────────────────────────────────────────────

const item = (esencial = false) => ({ monto: '', periodicidad: 'mensual', esencial });

export const DEFAULT_DATA = {
  ingresos: {
    salario: { monto: '', periodicidad: 'mensual' },
    bonos: { monto: '', periodicidad: 'mensual' },
    comisiones: { monto: '', periodicidad: 'mensual' },
    dividendos: { monto: '', periodicidad: 'mensual' },
    otros: { monto: '', periodicidad: 'mensual' },
  },
  gastos: {
    hogar: {
      arriendo: item(true), administracion: item(true), luz: item(true), agua: item(true),
      gas: item(true), telefono: item(true), internet: item(true), tv: item(), otro: item(),
    },
    comida: { mercado: item(true), comidasFuera: item(), otro: item() },
    transporte: {
      gasolina: item(true), taxiUber: item(true), transportePublico: item(true), metro: item(true),
      mantenimientoAuto: item(), seguroAuto: item(true), otro: item(),
    },
    salud: {
      medicamentos: item(true), consultas: item(true), examenes: item(true), optica: item(), otro: item(),
    },
    creditos: {
      creditoHipotecario: item(true), creditoAuto: item(true), tarjetaCredito: item(true), otro: item(true),
    },
    entretenimiento: {
      viajes: item(), restaurantes: item(), diversion: item(), fiesta: item(),
      appleMusic: item(), ia: item(), otros: item(),
    },
    familia: {
      colegios: item(true), seguroMedico: item(true), otrosSeguros: item(true), suscripciones: item(),
      gimnasio: item(), impuestos: item(true), entretenimiento: item(), otros: item(),
    },
  },
  ahorro: { monto: '', periodicidad: 'mensual' },
  tranquilidad: {
    gastosMensualesDeseados: '',
    rentabilidadAnual: '7',
    patrimonioActual: '',
  },
};

const freshDefault = () => JSON.parse(JSON.stringify(DEFAULT_DATA));

function deepMerge(target, source) {
  if (typeof target !== 'object' || typeof source !== 'object' || !target || !source) {
    return source !== undefined ? source : target;
  }
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (key in target && typeof target[key] === 'object' && !Array.isArray(target[key]) && target[key] !== null) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

const withDefaults = (datos) => deepMerge(freshDefault(), datos || {});

/** Añade un timeout a una Promise para no bloquear la UI sin conexión. */
function withTimeout(promise, ms = 6000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); }),
  ]).finally(() => clearTimeout(timer));
}

async function readJSON(key) {
  try {
    const json = await AsyncStorage.getItem(key);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

async function writeJSON(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* caché best-effort */ }
}

// ─── Cambios pendientes de subir ─────────────────────────────────────────────
// Si un guardado remoto falla, el mes queda marcado. Mientras esté marcado,
// la copia local manda sobre la remota (si no, la nube "vieja" pisaría lo que
// el usuario editó sin conexión).

async function getPending() {
  return (await readJSON(PENDING_KEY)) || {};
}

async function setPending(id, isPending) {
  const pending = await getPending();
  if (isPending) pending[id] = true;
  else delete pending[id];
  await writeJSON(PENDING_KEY, pending);
}

async function upsertRemote(id, datos) {
  const uid = await getUserId();
  if (!supabase || !uid) throw new Error('Usuario no autenticado');
  const now = new Date().toISOString();
  const query = id === 'base'
    ? supabase.from('presupuesto').upsert({ user_id: uid, datos, updated_at: now }, { onConflict: 'user_id' })
    : supabase.from('presupuesto_mensual').upsert({ user_id: uid, mes: id, datos, updated_at: now }, { onConflict: 'user_id,mes' });
  const { error } = await withTimeout(query, 8000);
  if (error) throw error;
  await AsyncStorage.setItem(SYNC_KEY, now).catch(() => {});
}

async function saveWithSync(id, localKey, data) {
  await writeJSON(localKey, data);
  await setPending(id, true);
  try {
    await upsertRemote(id, data);
    await setPending(id, false);
  } catch {
    // Queda pendiente; se reintenta al volver a guardar o con "Sincronizar ahora".
  }
}

// ─── Presupuesto base (ajustes generales, meta de tranquilidad) ─────────────

export async function loadData() {
  const pending = await getPending();
  const uid = await getUserId();
  if (supabase && uid && !pending.base) {
    try {
      const { data, error } = await withTimeout(
        supabase.from('presupuesto').select('datos').eq('user_id', uid).maybeSingle(),
      );
      if (!error && data?.datos) {
        const merged = withDefaults(data.datos);
        await writeJSON(STORAGE_KEY, merged);
        return merged;
      }
    } catch { /* sin conexión → caché */ }
  }
  const cached = await readJSON(STORAGE_KEY);
  return cached ? withDefaults(cached) : freshDefault();
}

export function saveData(data) {
  return saveWithSync('base', STORAGE_KEY, data);
}

// ─── Presupuesto mensual ─────────────────────────────────────────────────────

/**
 * Presupuesto de un mes. Si el mes no existe todavía, parte del mes anterior
 * que sí tenga presupuesto (y si no hay ninguno, del presupuesto base).
 * Con { strict: true } retorna null cuando el mes no tiene registro propio.
 */
export async function loadDataMes(mes, options = {}) {
  const localKey = `${STORAGE_MES_PREFIX}_${mes}`;
  const strict = options?.strict === true;
  const pending = await getPending();
  const uid = await getUserId();

  if (pending[mes]) {
    const local = await readJSON(localKey);
    if (local) return withDefaults(local);
  }

  if (supabase && uid) {
    try {
      const { data, error } = await withTimeout(
        supabase.from('presupuesto_mensual').select('datos').eq('user_id', uid).eq('mes', mes).maybeSingle(),
      );
      if (!error && data?.datos) {
        const merged = withDefaults(data.datos);
        await writeJSON(localKey, merged);
        return merged;
      }
      if (!error && !data) {
        // El mes no existe en la nube: no usar una caché local huérfana.
        if (strict) return null;
        return inheritFromPrevious(mes, uid);
      }
    } catch { /* sin conexión → caché */ }
  }

  const local = await readJSON(localKey);
  if (local) return withDefaults(local);
  if (strict) return null;
  return loadData();
}

async function inheritFromPrevious(mes, uid) {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('presupuesto_mensual')
        .select('datos')
        .eq('user_id', uid)
        .lt('mes', mes)
        .order('mes', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    if (!error && data?.datos) return withDefaults(data.datos);
  } catch { /* cae al base */ }
  return loadData();
}

/** Solo caché local, sin red (render instantáneo). Nunca null. */
export async function loadDataMesCache(mes) {
  const local = await readJSON(`${STORAGE_MES_PREFIX}_${mes}`);
  if (local) return withDefaults(local);
  const base = await readJSON(STORAGE_KEY);
  return base ? withDefaults(base) : freshDefault();
}

export function saveDataMes(mes, data) {
  return saveWithSync(mes, `${STORAGE_MES_PREFIX}_${mes}`, data);
}

/**
 * Sube todo lo que quedó pendiente (presupuestos editados sin conexión).
 * @returns {{ success: boolean, uploaded?: number, timestamp?: string, reason?: string }}
 */
export async function syncData() {
  if (!supabase) return { success: false, reason: 'Sin conexión con el servidor' };
  const uid = await getUserId();
  if (!uid) return { success: false, reason: 'Inicia sesión para sincronizar' };

  const pending = await getPending();
  const ids = Object.keys(pending);
  let uploaded = 0;
  try {
    for (const id of ids) {
      const key = id === 'base' ? STORAGE_KEY : `${STORAGE_MES_PREFIX}_${id}`;
      const data = await readJSON(key);
      if (data) {
        await upsertRemote(id, data);
        uploaded += 1;
      }
      await setPending(id, false);
    }
    const ts = new Date().toISOString();
    await AsyncStorage.setItem(SYNC_KEY, ts);
    return { success: true, uploaded, timestamp: ts };
  } catch (e) {
    return { success: false, reason: e?.message === 'timeout' ? 'El servidor no respondió' : (e?.message || 'Error de conexión') };
  }
}

export async function getPendingCount() {
  return Object.keys(await getPending()).length;
}

export async function getLastSync() {
  try { return await AsyncStorage.getItem(SYNC_KEY); } catch { return null; }
}

// ─── Movimientos ─────────────────────────────────────────────────────────────

async function fetchRange(start, end, ms = 6000) {
  const uid = await getUserId();
  if (!supabase || !uid) return null;
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('transacciones')
        .select('*')
        .eq('user_id', uid)
        .gte('fecha', start)
        .lte('fecha', end)
        .order('fecha', { ascending: false }),
      ms,
    );
    if (error) return null;
    return data || [];
  } catch {
    return null;
  }
}

/** Movimientos del mes desde la caché local (sin red). */
export async function loadTransaccionesMesCache(mes = getCurrentMes()) {
  return (await readJSON(`${STORAGE_TXS_PREFIX}_${mes}`)) || [];
}

/**
 * Movimientos del mes desde Supabase. Retorna null si falla la red o no hay
 * sesión (para distinguir "error" de "0 movimientos"), [] si está vacío.
 */
export async function fetchTransaccionesMesRemote(mes = getCurrentMes()) {
  const { start, end } = monthRange(mes);
  const rows = await fetchRange(start, end);
  if (rows) await writeJSON(`${STORAGE_TXS_PREFIX}_${mes}`, rows);
  return rows;
}

/** Movimientos de un año completo. null si falla la red. */
export function loadTransaccionesAnio(year = new Date().getFullYear()) {
  return fetchRange(`${year}-01-01`, `${year}-12-31`, 10000);
}

export async function addTransaction({ tipo, monto, categoria, descripcion, fecha }) {
  if (!supabase) throw new Error('Sin conexión con el servidor');
  const uid = await getUserId();
  if (!uid) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  const { data, error } = await supabase
    .from('transacciones')
    .insert({
      user_id: uid,
      tipo,
      monto,
      categoria,
      subcategoria: 'otro',
      descripcion,
      fecha: fecha || localISODate(),
      fuente: 'app',
      es_extraordinario: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransaction(id, patch) {
  if (!supabase) throw new Error('Sin conexión con el servidor');
  const { error } = await supabase.from('transacciones').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteTransaction(id) {
  if (!supabase) throw new Error('Sin conexión con el servidor');
  const { error } = await supabase.from('transacciones').delete().eq('id', id);
  if (error) throw error;
}

// ─── Sobrante del mes anterior (manual) ──────────────────────────────────────

const ROLLOVER_SUB = 'rollover';

/**
 * ¿Hay un sobrante del mes anterior por ofrecer? Sobrante = ingresos reales −
 * gastos reales del mes anterior. No se ofrece si ya se pasó o se descartó.
 * @param {string} mes  Mes actual "YYYY-MM"
 * @param {object[]} currentTxs  Movimientos ya cargados del mes actual
 */
export async function getRolloverOffer(mes, currentTxs) {
  const prevMes = addMes(mes, -1);
  const uid = await getUserId();
  if (!uid) return null;
  if (await AsyncStorage.getItem(`${ROLLOVER_PREFIX}_${uid}_${mes}`).catch(() => null)) return null;
  if ((currentTxs || []).some(tx => tx.subcategoria === ROLLOVER_SUB && tx.tipo === 'ingreso')) return null;

  const prevTxs = await fetchTransaccionesMesRemote(prevMes);
  if (!prevTxs || prevTxs.length === 0) return null;
  const balance = prevTxs.reduce((sum, tx) => {
    const monto = Number(tx.monto) || 0;
    return tx.tipo === 'ingreso' ? sum + monto : sum - monto;
  }, 0);
  return balance > 0 ? { prevMes, amount: Math.round(balance) } : null;
}

export async function dismissRollover(mes) {
  const uid = await getUserId();
  if (uid) await AsyncStorage.setItem(`${ROLLOVER_PREFIX}_${uid}_${mes}`, '1').catch(() => {});
}

/** Registra el sobrante como ingreso de ahorro del mes actual (sin duplicar). */
export async function applyRollover(mes, amount, prevMesLabel) {
  const current = await fetchTransaccionesMesRemote(mes);
  if (current === null) throw new Error('No se pudo verificar el mes. Revisa tu conexión.');
  if (current.some(tx => tx.subcategoria === ROLLOVER_SUB && tx.tipo === 'ingreso')) return;

  const uid = await getUserId();
  if (!supabase || !uid) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  const today = localISODate();
  const { start, end } = monthRange(mes);
  const { error } = await supabase.from('transacciones').insert({
    user_id: uid,
    tipo: 'ingreso',
    monto: amount,
    categoria: 'ahorro',
    subcategoria: ROLLOVER_SUB,
    descripcion: `Sobrante de ${prevMesLabel}`,
    // Si se aplica desde otro mes, la fecha cae dentro del mes destino.
    fecha: today >= start && today <= end ? today : start,
    fuente: 'app',
    es_extraordinario: false,
  });
  if (error) throw error;
  await dismissRollover(mes);
}
