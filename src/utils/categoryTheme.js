export const MASTER_CATEGORIES = [
  'Alimentación',
  'Transporte',
  'Servicios',
  'Ocio',
  'Salud',
  'Educación',
  'Otros',
];

export const CATEGORY_COLORS = {
  'Alimentación': '#22C55E',
  'Transporte': '#3B82F6',
  'Servicios': '#F59E0B',
  'Ocio': '#EC4899',
  'Salud': '#14B8A6',
  'Educación': '#8B5CF6',
  'Otros': '#94A3B8',
};

export const CATEGORY_ICONS = {
  'Alimentación': 'fast-food',
  'Transporte': 'bus',
  'Servicios': 'home',
  'Ocio': 'game-controller',
  'Salud': 'medkit',
  'Educación': 'school',
  'Otros': 'ellipsis-horizontal-circle',
};

export const DEFAULT_CATEGORY_ICON = 'ellipsis-horizontal-circle';

const LEGACY_TO_MASTER = {
  'alimentación': 'Alimentación',
  'alimentacion': 'Alimentación',
  'comida': 'Alimentación',
  'transporte': 'Transporte',
  'servicios': 'Servicios',
  'hogar': 'Servicios',
  'creditos': 'Servicios',
  'créditos': 'Servicios',
  'ocio': 'Ocio',
  'entretenimiento': 'Ocio',
  'salud': 'Salud',
  'educación': 'Educación',
  'educacion': 'Educación',
  'familia': 'Otros',
  'salario': 'Otros',
  'bonos': 'Otros',
  'comisiones': 'Otros',
  'dividendos': 'Otros',
  'ahorro': 'Otros',
  'ingresos': 'Otros',
  'otros': 'Otros',
  'otro': 'Otros',
};

export function normalizeCategoria(value) {
  if (!value) return 'Otros';
  const v = String(value).trim().toLowerCase();
  if (LEGACY_TO_MASTER[v]) return LEGACY_TO_MASTER[v];
  const direct = MASTER_CATEGORIES.find(cat => cat.toLowerCase() === v);
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
