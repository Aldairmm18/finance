import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

const STORAGE_KEY = '@finance_data_v1';
export const SYNC_KEY = '@finance_last_sync';
const USER_ID = 'default';

// ─── Estructura de datos por defecto ─────────────────────────────────────────

export const DEFAULT_DATA = {
  ingresos: {
    salario:    { monto: '', periodicidad: 'mensual' },
    bonos:      { monto: '', periodicidad: 'mensual' },
    dividendos: { monto: '', periodicidad: 'mensual' },
    comisiones: { monto: '', periodicidad: 'mensual' },
    otros:      { monto: '', periodicidad: 'mensual' },
  },
  gastos: {
    hogar: {
      arriendo:       { monto: '', periodicidad: 'mensual', esencial: true  },
      administracion: { monto: '', periodicidad: 'mensual', esencial: true  },
      luz:            { monto: '', periodicidad: 'mensual', esencial: true  },
      agua:           { monto: '', periodicidad: 'mensual', esencial: true  },
      gas:            { monto: '', periodicidad: 'mensual', esencial: true  },
      telefono:       { monto: '', periodicidad: 'mensual', esencial: true  },
      internet:       { monto: '', periodicidad: 'mensual', esencial: true  },
      tv:             { monto: '', periodicidad: 'mensual', esencial: false },
      otro:           { monto: '', periodicidad: 'mensual', esencial: false },
    },
    comida: {
      mercado:      { monto: '', periodicidad: 'mensual', esencial: true  },
      comidasFuera: { monto: '', periodicidad: 'mensual', esencial: false },
      otro:         { monto: '', periodicidad: 'mensual', esencial: false },
    },
    transporte: {
      gasolina:          { monto: '', periodicidad: 'mensual', esencial: true  },
      taxiUber:          { monto: '', periodicidad: 'mensual', esencial: true  },
      transportePublico: { monto: '', periodicidad: 'mensual', esencial: true  },
      metro:             { monto: '', periodicidad: 'mensual', esencial: true  },
      mantenimientoAuto: { monto: '', periodicidad: 'mensual', esencial: false },
      seguroAuto:        { monto: '', periodicidad: 'mensual', esencial: true  },
      otro:              { monto: '', periodicidad: 'mensual', esencial: false },
    },
    creditos: {
      creditoHipotecario: { monto: '', periodicidad: 'mensual', esencial: true },
      creditoAuto:        { monto: '', periodicidad: 'mensual', esencial: true },
      tarjetaCredito:     { monto: '', periodicidad: 'mensual', esencial: true },
      otro:               { monto: '', periodicidad: 'mensual', esencial: true },
    },
    entretenimiento: {
      viajes:       { monto: '', periodicidad: 'mensual', esencial: false },
      restaurantes: { monto: '', periodicidad: 'mensual', esencial: false },
      diversion:    { monto: '', periodicidad: 'mensual', esencial: false },
      fiesta:       { monto: '', periodicidad: 'mensual', esencial: false },
      appleMusic:   { monto: '', periodicidad: 'mensual', esencial: false },
      ia:           { monto: '', periodicidad: 'mensual', esencial: false },
      otros:        { monto: '', periodicidad: 'mensual', esencial: false },
    },
    familia: {
      colegios:        { monto: '', periodicidad: 'mensual', esencial: true  },
      seguroMedico:    { monto: '', periodicidad: 'mensual', esencial: true  },
      otrosSeguros:    { monto: '', periodicidad: 'mensual', esencial: true  },
      suscripciones:   { monto: '', periodicidad: 'mensual', esencial: false },
      gimnasio:        { monto: '', periodicidad: 'mensual', esencial: false },
      impuestos:       { monto: '', periodicidad: 'mensual', esencial: true  },
      entretenimiento: { monto: '', periodicidad: 'mensual', esencial: false },
      otros:           { monto: '', periodicidad: 'mensual', esencial: false },
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
  // 1. Intentar Supabase (con timeout de 6s para no bloquear el arranque)
  if (supabase) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('presupuesto')
          .select('datos')
          .eq('user_id', USER_ID)
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
    withTimeout(
      supabase
        .from('presupuesto')
        .upsert(
          { user_id: USER_ID, datos: data, updated_at: new Date().toISOString() },
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
    const { error } = await withTimeout(
      supabase
        .from('presupuesto')
        .upsert(
          { user_id: USER_ID, datos: data, updated_at: new Date().toISOString() },
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
 * Carga TODAS las transacciones del mes actual desde Supabase (bot + app).
 * Retorna [] si Supabase no está disponible.
 */
export async function loadTransaccionesMes() {
  if (!supabase) return [];
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const { data, error } = await withTimeout(
      supabase
        .from('transacciones')
        .select('*')
        .eq('user_id', USER_ID)
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
 * Carga gastos extraordinarios del mes actual desde Supabase.
 * Retorna [] si Supabase no está disponible o hay error de red.
 */
export async function loadExtraordinarios() {
  if (!supabase) return [];
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const { data, error } = await withTimeout(
      supabase
        .from('transacciones')
        .select('*')
        .eq('user_id', USER_ID)
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
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('transacciones')
    .insert({
      user_id:           USER_ID,
      tipo,
      monto,
      categoria,
      subcategoria:      'extraordinario',
      descripcion,
      fecha:             today,
      fuente:            'app',
      es_extraordinario: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
