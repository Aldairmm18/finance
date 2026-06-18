// Flat config (ESLint 9). Base: eslint-config-expo (globals RN/JSX + parser).
// Objetivo de este setup: `no-undef` como barrera para cazar crashes por
// ReferenceError (como CAT_META o useEffect sin importar) ANTES de compilar
// — Metro NO detecta ese tipo de error.
const expoFlat = require('eslint-config-expo/flat');

module.exports = [
  ...expoFlat,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'babel.config.js'],
  },
  {
    rules: {
      // ── Barrera principal ──
      'no-undef': 'error',

      // ── Ruido / falsos positivos para este proyecto → no bloquear commits ──
      // Animated.Value().interpolate() en render es un patrón válido en RN:
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      // La resolución de módulos la hace Metro, no el resolver de ESLint:
      'import/no-unresolved': 'off',
      // Útiles pero no críticas → avisos, no errores:
      'react/display-name': 'warn',
      'no-unused-vars': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-duplicates': 'warn',
      'unicode-bom': 'warn',
    },
  },
];
