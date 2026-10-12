// ─── Design tokens ────────────────────────────────────────────────────────────
// Paleta sobria para finanzas: hueso cálido + verde pino como marca,
// terracota para gastos y azul pizarra para ahorro. Sin neones.

export const LIGHT = {
  bg:         '#F6F5F1',
  card:       '#FFFFFF',
  sunken:     '#EFEDE7',   // inputs, pistas de barras, chips inactivos
  border:     '#E4E1D9',
  divider:    '#EEEBE4',

  text:       '#1C2321',
  textMuted:  '#6B716C',
  textFaint:  '#8A8F8A',

  brand:      '#1F4D3F',
  onBrand:    '#FFFFFF',
  income:     '#2F6B4F',
  expense:    '#A4473A',
  savings:    '#3E5C76',
  warning:    '#A87B2A',

  incomeSoft:  '#EAF1EC',
  expenseSoft: '#F6E9E6',
  savingsSoft: '#EDF0F3',
  warningSoft: '#F6EFE1',

  overlay:    'rgba(28,35,33,0.40)',
};

export const DARK = {
  bg:         '#121513',
  card:       '#1A1E1B',
  sunken:     '#232825',
  border:     '#2A2F2B',
  divider:    '#262B27',

  text:       '#E9ECE7',
  textMuted:  '#9AA19B',
  textFaint:  '#6F766F',

  brand:      '#8DBFA6',
  onBrand:    '#121513',
  income:     '#8DBFA6',
  expense:    '#D9907F',
  savings:    '#93AEC6',
  warning:    '#D2AE6A',

  incomeSoft:  '#1F2A24',
  expenseSoft: '#2C211E',
  savingsSoft: '#20262C',
  warningSoft: '#2B261C',

  overlay:    'rgba(0,0,0,0.55)',
};

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20 };

// Escala tipográfica. Fuente del sistema (SF Pro / Roboto); los montos usan
// cifras tabulares para que las columnas de dinero queden alineadas.
export const TYPE = {
  display: { fontSize: 34, fontWeight: '600', letterSpacing: -1 },
  title:   { fontSize: 24, fontWeight: '600', letterSpacing: -0.5 },
  heading: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  body:    { fontSize: 15, fontWeight: '400' },
  label:   { fontSize: 13, fontWeight: '500' },
  caption: { fontSize: 12, fontWeight: '400' },
};

export const NUM = { fontVariant: ['tabular-nums'] };
