// ─── Catálogo único de categorías ─────────────────────────────────────────────
// Las claves coinciden con las que guarda el bot de Telegram (categories.py)
// y con las del presupuesto, para que plan y movimientos reales se crucen.

export const EXPENSE_CATEGORIES = [
  { key: 'hogar',           label: 'Hogar',           icon: 'home-outline' },
  { key: 'comida',          label: 'Comida',          icon: 'basket-outline' },
  { key: 'transporte',      label: 'Transporte',      icon: 'bus-outline' },
  { key: 'salud',           label: 'Salud',           icon: 'medkit-outline' },
  { key: 'educacion',       label: 'Educación',       icon: 'school-outline' },
  { key: 'creditos',        label: 'Créditos',        icon: 'card-outline' },
  { key: 'entretenimiento', label: 'Entretenimiento', icon: 'film-outline' },
  { key: 'familia',         label: 'Familia',         icon: 'people-outline' },
  { key: 'otros',           label: 'Otros',           icon: 'ellipsis-horizontal' },
];

export const INCOME_CATEGORIES = [
  { key: 'salario',    label: 'Salario',    icon: 'briefcase-outline' },
  { key: 'bonos',      label: 'Bonos',      icon: 'gift-outline' },
  { key: 'comisiones', label: 'Comisiones', icon: 'trending-up-outline' },
  { key: 'dividendos', label: 'Dividendos', icon: 'pie-chart-outline' },
  { key: 'ahorro',     label: 'Ahorro',     icon: 'wallet-outline' },
  { key: 'otros',      label: 'Otros',      icon: 'ellipsis-horizontal' },
];

// Tonos apagados (claro / oscuro) para íconos y barras de categoría.
const CATEGORY_TONES = {
  hogar:           ['#7A6A55', '#C2B39C'],
  comida:          ['#5E7A4F', '#A9C2A3'],
  transporte:      ['#3E5C76', '#93AEC6'],
  salud:           ['#9A5B4F', '#D9A396'],
  educacion:       ['#5B5F86', '#A7AACF'],
  creditos:        ['#8A6A2F', '#D2B477'],
  entretenimiento: ['#7A5770', '#C6A2BB'],
  familia:         ['#4F7A73', '#97C4BC'],
  otros:           ['#6B716C', '#9AA19B'],
  salario:         ['#2F6B4F', '#8DBFA6'],
  bonos:           ['#2F6B4F', '#8DBFA6'],
  comisiones:      ['#2F6B4F', '#8DBFA6'],
  dividendos:      ['#2F6B4F', '#8DBFA6'],
  ahorro:          ['#3E5C76', '#93AEC6'],
};

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
const BY_KEY = Object.fromEntries(ALL.map(c => [c.key, c]));

// Valores antiguos (categorías "master", subcategorías del bot o del
// presupuesto) → clave canónica.
const ALIASES = {
  servicios: 'hogar', arriendo: 'hogar', administracion: 'hogar', luz: 'hogar', agua: 'hogar',
  gas: 'hogar', telefono: 'hogar', internet: 'hogar', tv: 'hogar',
  alimentacion: 'comida', mercado: 'comida', comidasfuera: 'comida', restaurantes: 'comida',
  gasolina: 'transporte', taxiuber: 'transporte', transportepublico: 'transporte', metro: 'transporte',
  mantenimientoauto: 'transporte', seguroauto: 'transporte',
  seguromedico: 'salud', medicamentos: 'salud', consultas: 'salud', examenes: 'salud', optica: 'salud',
  colegios: 'educacion',
  creditohipotecario: 'creditos', creditoauto: 'creditos', tarjetacredito: 'creditos',
  ocio: 'entretenimiento', viajes: 'entretenimiento', diversion: 'entretenimiento', fiesta: 'entretenimiento',
  applemusic: 'entretenimiento', ia: 'entretenimiento',
  otrosseguros: 'familia', suscripciones: 'familia', gimnasio: 'familia', impuestos: 'familia',
  ingresos: 'salario',
  otro: 'otros',
};

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '');
}

/** Normaliza cualquier valor de categoría guardado a una clave del catálogo. */
export function normalizeCategory(value) {
  const s = slug(value);
  if (!s) return 'otros';
  if (BY_KEY[s]) return s;
  return ALIASES[s] || 'otros';
}

export function categoryInfo(value) {
  return BY_KEY[normalizeCategory(value)] || BY_KEY.otros;
}

export function categoryLabel(value) {
  return categoryInfo(value).label;
}

export function categoryIcon(value) {
  return categoryInfo(value).icon;
}

export function categoryColor(value, mode = 'light') {
  const tones = CATEGORY_TONES[normalizeCategory(value)] || CATEGORY_TONES.otros;
  return mode === 'dark' ? tones[1] : tones[0];
}
