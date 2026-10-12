import React, { useEffect, useState } from 'react';
import { View, Image, Platform, Pressable, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Txt, Field, Button, Segmented, Divider } from '../components/ui';
import { SPACE, RADIUS } from '../theme/tokens';

const LOGO = require('../../assets/logo-mark.png');
const LOGO_BG = '#F7E9C6'; // crema del logo

function friendlyError(message) {
  const msg = message || '';
  if (msg.includes('Invalid login')) return 'El correo o la contraseña no coinciden.';
  if (msg.includes('already registered')) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  if (msg.includes('valid email')) return 'Escribe un correo válido.';
  if (msg.includes('Email not confirmed')) return 'Confirma tu correo con el enlace que te enviamos.';
  return msg || 'Algo salió mal. Intenta de nuevo.';
}

export default function AuthScreen() {
  const { signIn, signUp, resetPassword, signInWithOAuth, signInWithApple } = useAuth();
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState('login'); // login | register | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
  };

  const run = async (fn) => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e?.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Escribe tu correo.'); return; }
    if (mode !== 'reset' && password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }

    run(async () => {
      if (mode === 'login') {
        await signIn(trimmed, password);
      } else if (mode === 'register') {
        await signUp(trimmed, password);
        switchMode('login');
        setNotice('Cuenta creada. Revisa tu correo si te pedimos confirmarlo y luego inicia sesión.');
      } else {
        await resetPassword(trimmed);
        switchMode('login');
        setNotice('Te enviamos un enlace para crear una nueva contraseña.');
      }
    });
  };

  const submitLabel = mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta' : 'Enviar enlace';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: SPACE.xl, paddingTop: insets.top + SPACE.xl, paddingBottom: insets.bottom + SPACE.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: SPACE.xxl }}>
          <View style={{ width: 56, height: 56, borderRadius: RADIUS.md + 2, backgroundColor: LOGO_BG, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg }}>
            <Image source={LOGO} style={{ width: 34, height: 34 }} resizeMode="contain" accessibilityLabel="Finance" />
          </View>
          <Txt variant="title">{mode === 'reset' ? 'Recupera tu acceso' : 'Tus finanzas, en calma'}</Txt>
          <Txt muted style={{ marginTop: SPACE.xs, lineHeight: 21 }}>
            {mode === 'reset'
              ? 'Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.'
              : 'Planea tu mes, registra lo que gastas y mira cuánto te queda.'}
          </Txt>
        </View>

        {mode !== 'reset' ? (
          <Segmented
            value={mode}
            onChange={switchMode}
            options={[{ key: 'login', label: 'Iniciar sesión' }, { key: 'register', label: 'Crear cuenta' }]}
            style={{ marginBottom: SPACE.xl }}
          />
        ) : null}

        <Field
          label="Correo"
          value={email}
          onChangeText={setEmail}
          placeholder="nombre@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType={mode === 'reset' ? 'send' : 'next'}
          onSubmitEditing={mode === 'reset' ? handleSubmit : undefined}
        />
        {mode !== 'reset' ? (
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            textContentType={mode === 'register' ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
        ) : null}

        {error ? <Txt variant="caption" color={C.expense} style={{ marginBottom: SPACE.md }} accessibilityLiveRegion="polite">{error}</Txt> : null}
        {notice ? <Txt variant="caption" color={C.income} style={{ marginBottom: SPACE.md }} accessibilityLiveRegion="polite">{notice}</Txt> : null}

        <Button title={submitLabel} onPress={handleSubmit} loading={loading} />

        {mode === 'login' ? (
          <Pressable onPress={() => switchMode('reset')} style={{ alignSelf: 'center', padding: SPACE.md }} accessibilityRole="button">
            <Txt variant="label" color={C.brand}>Olvidé mi contraseña</Txt>
          </Pressable>
        ) : null}
        {mode === 'reset' ? (
          <Pressable onPress={() => switchMode('login')} style={{ alignSelf: 'center', padding: SPACE.md }} accessibilityRole="button">
            <Txt variant="label" color={C.brand}>Volver a iniciar sesión</Txt>
          </Pressable>
        ) : null}

        {mode !== 'reset' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginVertical: SPACE.lg }}>
              <View style={{ flex: 1 }}><Divider /></View>
              <Txt variant="caption" muted>o continúa con</Txt>
              <View style={{ flex: 1 }}><Divider /></View>
            </View>
            <View style={{ gap: SPACE.sm }}>
              {appleAvailable ? (
                <Button title="Apple" icon="logo-apple" variant="secondary" onPress={() => run(signInWithApple)} disabled={loading} />
              ) : null}
              <Button title="Google" icon="logo-google" variant="secondary" onPress={() => run(() => signInWithOAuth('google'))} disabled={loading} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
