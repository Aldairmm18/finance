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
  'Salud':        '#14B8A6',
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
  'Salud':        'medkit',
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
