// ─── Categorías maestras ───────────────────────────────────────────────────────
// Conjunto expandido que cubre gastos e ingresos reales de la app.
// Los pie charts usan estas categorías para que la leyenda sea legible.

export const MASTER_CATEGORIES = [
  'Alimentación',
  'Transporte',
  'Servicios',
  'Ocio',
  'Salud',
  'Educación',
  'Créditos',
  'Familia',
  'Ingresos',
  'Otros',
];

export const CATEGORY_COLORS = {
  'Alimentación': '#22C55E',
  'Transporte':   '#3B82F6',
  'Servicios':    '#F59E0B',
  'Ocio':         '#EC4899',
  'Salud':        '#EF4444',
  'Educación':    '#8B5CF6',
  'Créditos':     '#F472B6',
  'Familia':      '#34D399',
  'Ingresos':     '#2DD4BF',
  'Otros':        '#94A3B8',
};

export const CATEGORY_ICONS = {
  'Alimentación': 'fast-food',
  'Transporte':   'bus',
  'Servicios':    'home',
  'Ocio':         'game-controller',
  'Salud':        'heart',
  'Educación':    'school',
  'Créditos':     'card',
  'Familia':      'people',
  'Ingresos':     'cash',
  'Otros':        'ellipsis-horizontal-circle',
};

export const DEFAULT_CATEGORY_ICON = 'ellipsis-horizontal-circle';

// ─── Mapeo legacy → master ─────────────────────────────────────────────────────
// Cualquier key del bot / presupuesto se normaliza a una categoría master.

const LEGACY_TO_MASTER = {
  // Alimentación
  'alimentación':   'Alimentación',
  'alimentacion':   'Alimentación',
  'comida':         'Alimentación',
  'mercado':        'Alimentación',
  'comidasfuera':   'Alimentación',
  'restaurantes':   'Alimentación',

  // Transporte
  'transporte':     'Transporte',
  'gasolina':       'Transporte',
  'taxiuber':       'Transporte',
  'transportepublico': 'Transporte',
  'metro':          'Transporte',
  'mantenimientoauto': 'Transporte',
  'seguroauto':     'Transporte',

  // Servicios (hogar / utilities)
  'servicios':      'Servicios',
  'hogar':          'Servicios',
  'arriendo':       'Servicios',
  'administracion': 'Servicios',
  'luz':            'Servicios',
  'agua':           'Servicios',
  'gas':            'Servicios',
  'telefono':       'Servicios',
  'internet':       'Servicios',
  'tv':             'Servicios',

  // Ocio
  'ocio':           'Ocio',
  'entretenimiento':'Ocio',
  'viajes':         'Ocio',
  'diversion':      'Ocio',
  'fiesta':         'Ocio',
  'applemusic':     'Ocio',
  'ia':             'Ocio',

  // Salud
  'salud':          'Salud',
  'seguromedico':   'Salud',

  // Educación
  'educación':      'Educación',
  'educacion':      'Educación',
  'colegios':       'Educación',

  // Créditos
  'créditos':       'Créditos',
  'creditos':       'Créditos',
  'creditohipotecario': 'Créditos',
  'creditoauto':    'Créditos',
  'tarjetacredito': 'Créditos',

  // Familia
  'familia':        'Familia',
  'otrosseguros':   'Familia',
  'suscripciones':  'Familia',
  'gimnasio':       'Familia',
  'impuestos':      'Familia',

  // Ingresos
  'ingresos':       'Ingresos',
  'salario':        'Ingresos',
  'bonos':          'Ingresos',
  'comisiones':     'Ingresos',
  'dividendos':     'Ingresos',

  // Otros / Ahorro (se agrupa en Otros para no contaminar gráficas de gasto)
  'ahorro':         'Otros',
  'otros':          'Otros',
  'otro':           'Otros',
};

export function normalizeCategoria(value) {
  if (!value) return 'Otros';
  // Eliminar tildes y espacios para matching robusto
  const v = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita diacríticos
  if (LEGACY_TO_MASTER[v]) return LEGACY_TO_MASTER[v];
  // Intentar match directo ignorando tildes
  const direct = MASTER_CATEGORIES.find(
    cat => cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === v
  );
  return direct || 'Otros';
}

export function getCategoryColor(value, fallback = '#94A3B8') {
  const master = normalizeCategoria(value);
  return CATEGORY_COLORS[master] || fallback;
}

export function getCategoryIcon(value, fallback = DEFAULT_CATEGORY_ICON) {
  const master = normalizeCategoria(value);
  return CATEGORY_ICONS[master] || fallback;
}

// Categorías para el modal de gastos extraordinarios
export const FAB_CATS_GASTO = [
  { key: 'hogar', label: 'Hogar' },
  { key: 'comida', label: 'Comida' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'salud', label: 'Salud' },
  { key: 'entretenimiento', label: 'Entretenimiento' },
  { key: 'familia', label: 'Familia' },
  { key: 'educacion', label: 'Educación' },
  { key: 'creditos', label: 'Créditos' },
  { key: 'otros', label: 'Otros' },
];

// Categorías para el modal de ingresos extraordinarios
export const FAB_CATS_INGRESO = [
  { key: 'salario', label: 'Salario' },
  { key: 'bonos', label: 'Bonos' },
  { key: 'comisiones', label: 'Comisión' },
  { key: 'dividendos', label: 'Dividendos' },
  { key: 'hogar', label: 'Hogar' },
  { key: 'comida', label: 'Comida' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'creditos', label: 'Créditos' },
  { key: 'entretenimiento', label: 'Entretenimiento' },
  { key: 'familia', label: 'Familia' },
  { key: 'ahorro', label: 'Ahorro' },
  { key: 'otros', label: 'Otros' },
];

// ─── Colores para gráficas (PieChart / LineChart) ─────────────────────────────
// Extraídos del board de Mixboard — teal + salmon + purple como trío principal
export const CHART_COLORS_DARK = [
  '#14B8A6', // teal — categoría principal
  '#E88C99', // salmon — gastos
  '#9333EA', // purple — ahorro
  '#F59E0B', // amber
  '#6B7A99', // muted blue-gray
  '#2563EB', // blue
  '#10B981', // green
  '#F97316', // orange
  '#EC4899', // pink fuerte
  '#8B5CF6', // violet
];

export const CHART_COLORS_LIGHT = [
  '#14B3A8',
  '#E07A85',
  '#9333EA',
  '#D97706',
  '#9CA3AF',
  '#3B82F6',
  '#059669',
  '#EA580C',
  '#DB2777',
  '#7C3AED',
];

/**
 * Devuelve el array de colores de gráfica según el modo del tema.
 * @param {'dark'|'light'} mode
 */
export function getChartColors(mode) {
  return mode === 'dark' ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
}
