import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

const STORAGE_KEY = '@finance_data_v1';
const STORAGE_MES_PREFIX = '@finance_mes_v1';
export const SYNC_KEY = '@finance_last_sync';
/** Retorna el user_id autenticado, o null si no hay sesión */
let _cachedUserId = null;

async function getUserId() {
  if (_cachedUserId) return _cachedUserId;
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    _cachedUserId = user?.id || null;
    return _cachedUserId;
  } catch {
    return null;
  }
}

// Llamar esta función cuando el usuario cierra sesión para limpiar la caché
export function clearUserIdCache() {
  _cachedUserId = null;
}

/** Retorna el mes actual en formato "YYYY-MM" */
export function getCurrentMes() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Estructura de datos por defecto ─────────────────────────────────────────

export const DEFAULT_DATA = {
  ingresos: {
    salario: { monto: '', periodicidad: 'mensual' },
    bonos: { monto: '', periodicidad: 'mensual' },
    dividendos: { monto: '', periodicidad: 'mensual' },
    comisiones: { monto: '', periodicidad: 'mensual' },
    hogar: { monto: '', periodicidad: 'mensual' },
    comida: { monto: '', periodicidad: 'mensual' },
    transporte: { monto: '', periodicidad: 'mensual' },
    creditos: { monto: '', periodicidad: 'mensual' },
    entretenimiento: { monto: '', periodicidad: 'mensual' },
    familia: { monto: '', periodicidad: 'mensual' },
    ahorro: { monto: '', periodicidad: 'mensual' },
    otros: { monto: '', periodicidad: 'mensual' },
  },
  gastos: {
    hogar: {
      arriendo: { monto: '', periodicidad: 'mensual', esencial: true },
      administracion: { monto: '', periodicidad: 'mensual', esencial: true },
      luz: { monto: '', periodicidad: 'mensual', esencial: true },
      agua: { monto: '', periodicidad: 'mensual', esencial: true },
      gas: { monto: '', periodicidad: 'mensual', esencial: true },
      telefono: { monto: '', periodicidad: 'mensual', esencial: true },
      internet: { monto: '', periodicidad: 'mensual', esencial: true },
      tv: { monto: '', periodicidad: 'mensual', esencial: false },
      otro: { monto: '', periodicidad: 'mensual', esencial: false },
    },
    comida: {
      mercado: { monto: '', periodicidad: 'mensual', esencial: true },
      comidasFuera: { monto: '', periodicidad: 'mensual', esencial: false },
      otro: { monto: '', periodicidad: 'mensual', esencial: false },
    },
    transporte: {
      gasolina: { monto: '', periodicidad: 'mensual', esencial: true },
      taxiUber: { monto: '', periodicidad: 'mensual', esencial: true },
      transportePublico: { monto: '', periodicidad: 'mensual', esencial: true },
      metro: { monto: '', periodicidad: 'mensual', esencial: true },
      mantenimientoAuto: { monto: '', periodicidad: 'mensual', esencial: false },
      seguroAuto: { monto: '', periodicidad: 'mensual', esencial: true },
      otro: { monto: '', periodicidad: 'mensual', esencial: false },
    },
    creditos: {
      creditoHipotecario: { monto: '', periodicidad: 'mensual', esencial: true },
      creditoAuto: { monto: '', periodicidad: 'mensual', esencial: true },
      tarjetaCredito: { monto: '', periodicidad: 'mensual', esencial: true },
      otro: { monto: '', periodicidad: 'mensual', esencial: true },
    },
    entretenimiento: {
      viajes: { monto: '', periodicidad: 'mensual', esencial: false },
      restaurantes: { monto: '', periodicidad: 'mensual', esencial: false },
      diversion: { monto: '', periodicidad: 'mensual', esencial: false },
      fiesta: { monto: '', periodicidad: 'mensual', esencial: false },
      appleMusic: { monto: '', periodicidad: 'mensual', esencial: false },
      ia: { monto: '', periodicidad: 'mensual', esencial: false },
      otros: { monto: '', periodicidad: 'mensual', esencial: false },
    },
    familia: {
      colegios: { monto: '', periodicidad: 'mensual', esencial: true },
      seguroMedico: { monto: '', periodicidad: 'mensual', esencial: true },
      otrosSeguros: { monto: '', periodicidad: 'mensual', esencial: true },
      suscripciones: { monto: '', periodicidad: 'mensual', esencial: false },
      gimnasio: { monto: '', periodicidad: 'mensual', esencial: false },
      impuestos: { monto: '', periodicidad: 'mensual', esencial: true },
      entretenimiento: { monto: '', periodicidad: 'mensual', esencial: false },
      otros: { monto: '', periodicidad: 'mensual', esencial: false },
    },
  },
  ahorro: { monto: '', periodicidad: 'mensual' },
  flujoMensual: {},
  tranquilidad: {
    gastosMensualesDeseados: '',
    rentabilidadAnual: '7',
    patrimonioActual: '',
  },
};

// ─── Utilidades internas ──────────────────────────────────────────────────────

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

/** Añade un timeout a cualquier Promise para no bloquear la UI offline */
function withTimeout(promise, ms = 6000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Carga datos con estrategia "Supabase first, AsyncStorage fallback".
 * Si Supabase responde, actualiza la caché local y retorna datos frescos.
 * Si Supabase falla o no hay conexión, usa la caché local.
 */
export async function loadData() {
  const uid = await getUserId();
  // 1. Intentar Supabase (con timeout de 6s para no bloquear el arranque)
  if (supabase && uid) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('presupuesto')
          .select('datos')
          .eq('user_id', uid)
          .maybeSingle(),
        6000
      );
      if (!error && data?.datos) {
        const merged = deepMerge(
          JSON.parse(JSON.stringify(DEFAULT_DATA)),
          data.datos
        );
        // Actualizar caché local con los datos frescos de la nube
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch {
      // Supabase offline o error de red → continúa con caché local
    }
  }

  // 2. Fallback: AsyncStorage (funciona siempre, incluso offline)
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return JSON.parse(JSON.stringify(DEFAULT_DATA));
    return deepMerge(JSON.parse(JSON.stringify(DEFAULT_DATA)), JSON.parse(json));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

/**
 * Guarda datos con estrategia dual:
 * 1. AsyncStorage SIEMPRE (inmediato, offline-safe, no bloquea la UI)
 * 2. Supabase en background (best-effort, sin bloquear)
 */
export async function saveData(data) {
  // Guardar localmente de forma inmediata (siempre funciona)
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[storage] Local save failed:', e);
  }

  // Subir a Supabase en background (no bloquea la UI)
  if (supabase) {
    const uid = await getUserId();
    if (!uid) return; // Sin usuario autenticado, solo guardar localmente
    withTimeout(
      supabase
        .from('presupuesto')
        .upsert(
          { user_id: uid, datos: data, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        ),
      8000
    )
      .then(() => AsyncStorage.setItem(SYNC_KEY, new Date().toISOString()))
      .catch(() => {
        // Silencioso: la próxima carga o sync manual recuperará el estado
      });
  }
}

/**
 * Carga el presupuesto de un mes específico desde `presupuesto_mensual`.
 * Si no existe registro para ese mes, copia el presupuesto base como punto de partida.
 * @param {string} mes  Formato "YYYY-MM"
 */
export async function loadDataMes(mes, options = {}) {
  const localKey = `${STORAGE_MES_PREFIX}_${mes}`;
  const uid = await getUserId();
  const strict = options?.strict === true;

  // 1. Intentar presupuesto_mensual en Supabase
  if (supabase && uid) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('presupuesto_mensual')
          .select('datos')
          .eq('user_id', uid)
          .eq('mes', mes)
          .maybeSingle(),
        6000,
      );
      if (!error && data?.datos) {
        const merged = deepMerge(JSON.parse(JSON.stringify(DEFAULT_DATA)), data.datos);
        await AsyncStorage.setItem(localKey, JSON.stringify(merged));
        return merged;
      }
    } catch {
      // offline → continúa
    }
  }

  // 2. Caché local mensual
  try {
    const json = await AsyncStorage.getItem(localKey);
    if (json) return deepMerge(JSON.parse(JSON.stringify(DEFAULT_DATA)), JSON.parse(json));
  } catch { }

  // 3. Sin registro mensual → usar presupuesto base como punto de partida (no guardar aún)
  if (strict) return null;
  return loadData();
}

/**
 * Guarda el presupuesto de un mes específico en `presupuesto_mensual`.
 * @param {string} mes   Formato "YYYY-MM"
 * @param {object} data  Datos del presupuesto
 */
export async function saveDataMes(mes, data) {
  const localKey = `${STORAGE_MES_PREFIX}_${mes}`;

  try {
    await AsyncStorage.setItem(localKey, JSON.stringify(data));
  } catch (e) {
    console.error('[storage] Monthly local save failed:', e);
  }

  if (supabase) {
    const uid = await getUserId();
    if (!uid) return;
    withTimeout(
      supabase
        .from('presupuesto_mensual')
        .upsert(
          { user_id: uid, mes, datos: data, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,mes' },
        ),
      8000,
    )
      .then(() => AsyncStorage.setItem(SYNC_KEY, new Date().toISOString()))
      .catch(() => { });
  }
}

/**
 * Sincronización manual: sube los datos locales a Supabase.
 * Usado desde ConfigScreen con el botón "Sincronizar ahora".
 * @returns {{ success: boolean, timestamp?: string, reason?: string }}
 */
export async function syncData() {
  if (!supabase) {
    return { success: false, reason: 'Cliente Supabase no disponible' };
  }
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return { success: false, reason: 'Sin datos locales' };

    const data = JSON.parse(json);
    const uid = await getUserId();
    if (!uid) return { success: false, reason: 'Usuario no autenticado' };
    const { error } = await withTimeout(
      supabase
        .from('presupuesto')
        .upsert(
          { user_id: uid, datos: data, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        ),
      10000
    );
    if (error) throw error;

    const ts = new Date().toISOString();
    await AsyncStorage.setItem(SYNC_KEY, ts);
    return { success: true, timestamp: ts };
  } catch (e) {
    return { success: false, reason: e.message || 'Error de conexión' };
  }
}

/** Retorna el ISO string de la última sync exitosa, o null si nunca sincronizó */
export async function getLastSync() {
  try {
    return await AsyncStorage.getItem(SYNC_KEY);
  } catch {
    return null;
  }
}

/**
 * Carga TODAS las transacciones de un mes específico desde Supabase.
 * @param {string} mes  Formato "YYYY-MM". Default: mes actual.
 * Retorna [] si Supabase no está disponible.
 */
export async function loadTransaccionesMes(mes) {
  if (!supabase) return [];
  try {
    const uid = await getUserId();
    if (!uid) return [];
    const m = mes || getCurrentMes();
    const [y, month] = m.split('-').map(Number);
    const start = new Date(y, month - 1, 1).toISOString().split('T')[0];
    const end = new Date(y, month, 0).toISOString().split('T')[0]; // último día del mes

    const { data, error } = await withTimeout(
      supabase
        .from('transacciones')
        .select('*')
        .eq('user_id', uid)
        .gte('fecha', start)
        .lte('fecha', end)
        .order('fecha', { ascending: false }),
      6000,
    );
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Carga TODAS las transacciones de un año completo desde Supabase.
 * @param {number} year  Año (ej: 2026). Default: año actual.
 * Retorna [] si Supabase no está disponible.
 */
export async function loadTransaccionesAnio(year) {
  if (!supabase) return [];
  try {
    const uid = await getUserId();
    if (!uid) return [];
    const y = year || new Date().getFullYear();
    const start = `${y}-01-01`;
    const end = `${y}-12-31`;

    const { data, error } = await withTimeout(
      supabase
        .from('transacciones')
        .select('*')
        .eq('user_id', uid)
        .gte('fecha', start)
        .lte('fecha', end)
        .order('fecha', { ascending: false }),
      10000,
    );
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Carga gastos extraordinarios del mes actual desde Supabase.
 * Retorna [] si Supabase no está disponible o hay error de red.
 */
export async function loadExtraordinarios() {
  if (!supabase) return [];
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const uid = await getUserId();
    if (!uid) return [];
    const { data, error } = await withTimeout(
      supabase
        .from('transacciones')
        .select('*')
        .eq('user_id', uid)
        .eq('es_extraordinario', true)
        .gte('fecha', start)
        .lte('fecha', today)
        .order('fecha', { ascending: false }),
      6000,
    );
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Registra un gasto extraordinario desde la app (FAB del Dashboard).
 * @throws Error si Supabase no está disponible
 */
export async function registrarExtraordinario({ descripcion, monto, categoria, tipo = 'gasto' }) {
  if (!supabase) throw new Error('Sin conexión a Supabase');
  const uid = await getUserId();
  if (!uid) throw new Error('Usuario no autenticado');
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const { data, error } = await supabase
    .from('transacciones')
    .insert({
      user_id: uid,
      tipo,
      monto,
      categoria,
      subcategoria: 'extraordinario',
      descripcion,
      fecha: today,
      fuente: 'app',
      es_extraordinario: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Calcula el sobrante (rollover) del mes anterior al mes dado.
 * Sobrante = Ingresos presupuestados - Gastos reales (transacciones).
 * @param {string} mes  Formato "YYYY-MM" del mes ACTUAL (se mira el anterior)
 * @returns {{ surplus: number, prevMes: string }}
 */
export async function computeRollover(mes) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // mes anterior
  const prevMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  try {
    // 1. Cargar presupuesto del mes anterior
    const prevData = await loadDataMes(prevMes);
    if (!prevData) return { surplus: 0, prevMes };

    // Calcular ingresos presupuestados
    const { computeTotals } = require('./calculations');
    const totals = computeTotals(prevData);
    if (!totals) return { surplus: 0, prevMes };

    // 2. Cargar gastos reales del mes anterior
    const txs = await loadTransaccionesMes(prevMes);
    const gastosReales = (txs || [])
      .filter(tx => tx.tipo === 'gasto')
      .reduce((sum, tx) => sum + (tx.monto || 0), 0);
    const ingresosReales = (txs || [])
      .filter(tx => tx.tipo === 'ingreso')
      .reduce((sum, tx) => sum + (tx.monto || 0), 0);

    // Surplus = (Ingresos presupuestados + ingresos extraordinarios) - (Gastos presupuestados + gastos extraordinarios)
    const totalIngresos = totals.ingresosMonthly + ingresosReales;
    const totalGastos = totals.totalGastosMonthly + gastosReales;
    const surplus = totalIngresos - totalGastos;

    return { surplus: Math.max(0, Math.round(surplus)), prevMes };
  } catch {
    return { surplus: 0, prevMes };
  }
}

/**
 * Aplica el traspaso del sobrante del mes anterior al mes actual.
 * Sobrante = Ingresos reales - Gastos reales (transacciones del mes anterior).
 * Si hay sobrante, se registra como ingreso extraordinario en el mes actual.
 * @param {string} mesActual Formato "YYYY-MM"
 * @returns {{ applied: boolean, prevMes?: string, balance?: number }}
 */
export async function aplicarTraspasoSobrante(mesActual) {
  if (!mesActual) return { applied: false };
  const [y, m] = mesActual.split('-').map(Number);
  if (!y || !m) return { applied: false };

  const d = new Date(y, m - 2, 1); // mes anterior
  const prevMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const desc = 'Ahorro de traspaso mes anterior';

  try {
    const prevTxs = await loadTransaccionesMes(prevMes);
    const totalIngresos = (prevTxs || [])
      .filter(tx => tx.tipo === 'ingreso')
      .reduce((sum, tx) => sum + (tx.monto || 0), 0);
    const totalGastos = (prevTxs || [])
      .filter(tx => tx.tipo === 'gasto')
      .reduce((sum, tx) => sum + (tx.monto || 0), 0);
    const balance = totalIngresos - totalGastos;

    if (balance <= 0) return { applied: false, prevMes, balance };

    const currentTxs = await loadTransaccionesMes(mesActual);
    const exists = (currentTxs || []).some(tx =>
      String(tx.descripcion || '').trim().toLowerCase() === desc.toLowerCase()
    );
    if (exists) return { applied: false, prevMes, balance };

    await registrarExtraordinario({
      descripcion: desc,
      monto: balance,
      categoria: 'ahorro',
      tipo: 'ingreso',
    });

    return { applied: true, prevMes, balance };
  } catch {
    return { applied: false, prevMes };
  }
}
