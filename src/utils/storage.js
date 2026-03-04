import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@finance_data_v1';

export const DEFAULT_DATA = {
  ingresos: {
    salario: { monto: '', periodicidad: 'mensual' },
    bonos: { monto: '', periodicidad: 'mensual' },
    dividendos: { monto: '', periodicidad: 'mensual' },
    comisiones: { monto: '', periodicidad: 'mensual' },
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

export async function loadData() {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return JSON.parse(JSON.stringify(DEFAULT_DATA));
    const saved = JSON.parse(json);
    return deepMerge(JSON.parse(JSON.stringify(DEFAULT_DATA)), saved);
  } catch (e) {
    console.error('Error loading data:', e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

export async function saveData(data) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving data:', e);
  }
}
