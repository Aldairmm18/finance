import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK, LIGHT } from '../theme/tokens';

const THEME_KEY = '@finance_theme';
const PREFERENCES = ['system', 'light', 'dark'];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  // 'system' sigue la apariencia del teléfono; 'light' / 'dark' la fijan.
  const [preference, setPreferenceState] = useState('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then(val => { if (PREFERENCES.includes(val)) setPreferenceState(val); })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((next) => {
    if (!PREFERENCES.includes(next)) return;
    setPreferenceState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  }, []);

  // Los elementos nativos (teclado, alertas, cabeceras) siguen la elección del usuario.
  useEffect(() => {
    try {
      Appearance.setColorScheme?.(preference === 'system' ? 'unspecified' : preference);
    } catch { /* versiones antiguas de RN usan null en vez de 'unspecified' */ }
  }, [preference]);

  const mode = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(() => ({
    mode,
    preference,
    setPreference,
    colors: mode === 'dark' ? DARK : LIGHT,
  }), [mode, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
