// ─── Paleta extraída del board de Mixboard (Google Labs) ─────────────────────
// Dark mode: navy profundo + teal vibrante + rosa salmon + purple savings
// Light mode: off-white cálido + mismos acentos con mayor contraste

// Dark mode — basado en "Dark Mode Color Palette" + "Dark Mode Home Screen Layout"
export const DARK = {
  // Fondos
  bg:      '#0D1117',   // navy profundo (más rico que el #0a0a1a anterior)
  card:    '#161B27',   // card surface — "Card / Surface" del board
  inputBg: '#1C2333',   // input ligeramente más claro que card

  // Bordes
  border: '#242E42',    // borde sutil en navy

  // Acentos principales — del board "Dark Mode Color Palette"
  teal:   '#14B8A6',    // Primary UI / Income (exacto del board)
  pink:   '#E88C99',    // Expenses / Negative (salmon del board)
  purple: '#9333EA',    // Savings / Positive (purple del board)
  amber:  '#F59E0B',    // warnings — sin cambio

  // Texto
  text:      '#E8EDF5', // blanco cálido con toque navy
  textMuted: '#6B7A99', // muted azul-gris

  // Chart extras
  chartTeal:   '#14B8A6',
  chartPink:   '#E88C99',
  chartPurple: '#6B21C8', // purple más oscuro para áreas
};

// Light mode — basado en "Light Mode Color Palette" (hex exactos del board)
export const LIGHT = {
  // Fondos
  bg:      '#F5F5F6',   // off-white cálido del board
  card:    '#FFFFFF',   // blanco puro
  inputBg: '#F0F2F5',   // input ligeramente gris

  // Bordes
  border: '#E2E8F0',

  // Acentos — del board "Light Mode Color Palette"
  teal:   '#14B3A8',    // Primary Accent / Income (#14B3A8 del board)
  pink:   '#E07A85',    // Expenses / Secondary Accent (salmon oscuro del board)
  purple: '#9333EA',    // Savings / Tertiary Accent (#9333EA exacto del board)
  amber:  '#D97706',    // warnings

  // Texto — del board "Light Mode Color Palette"
  text:      '#333B3B', // Text / Icons (dark slate del board)
  textMuted: '#9CA3AF', // Subtle Text (#9CA3AF exacto del board)

  // Chart extras
  chartTeal:   '#14B3A8',
  chartPink:   '#E07A85',
  chartPurple: '#7C3AED',
};
