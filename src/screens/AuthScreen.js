import React, { useEffect, useState } from 'react';
import { View, Image, Platform, Pressable, KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';
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

const COPY = {
  login: {
    title: 'Tus finanzas, en calma',
    body: 'Planea tu mes, registra lo que gastas y mira cuánto te queda.',
    submit: 'Iniciar sesión',
  },
  register: {
    title: 'Tus finanzas, en calma',
    body: 'Planea tu mes, registra lo que gastas y mira cuánto te queda.',
    submit: 'Crear cuenta',
  },
  reset: {
    title: 'Recupera tu acceso',
    body: 'Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.',
    submit: 'Enviar enlace',
  },
};

/** Estado y acciones del formulario de acceso. */
function useAuthForm() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState('login'); // login | register | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  const actions = {
    login: (mail) => signIn(mail, password),
    register: async (mail) => {
      await signUp(mail, password);
      switchMode('login');
      setNotice('Cuenta creada. Revisa tu correo si te pedimos confirmarlo y luego inicia sesión.');
    },
    reset: async (mail) => {
      await resetPassword(mail);
      switchMode('login');
      setNotice('Te enviamos un enlace para crear una nueva contraseña.');
    },
  };

  const submit = () => {
    const mail = email.trim().toLowerCase();
    if (!mail) { setError('Escribe tu correo.'); return; }
    if (mode !== 'reset' && password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    run(() => actions[mode](mail));
  };

  return { mode, email, setEmail, password, setPassword, loading, error, notice, switchMode, run, submit };
}

function AuthHeader({ mode }) {
  return (
    <View style={{ marginBottom: SPACE.xxl }}>
      <View style={{ width: 56, height: 56, borderRadius: RADIUS.md + 2, backgroundColor: LOGO_BG, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg }}>
        <Image source={LOGO} style={{ width: 34, height: 34 }} resizeMode="contain" accessibilityLabel="Finance" />
      </View>
      <Txt variant="title">{COPY[mode].title}</Txt>
      <Txt muted style={{ marginTop: SPACE.xs, lineHeight: 21 }}>{COPY[mode].body}</Txt>
    </View>
  );
}

function CredentialFields({ form }) {
  const isReset = form.mode === 'reset';
  const isRegister = form.mode === 'register';
  return (
    <>
      <Field
        label="Correo"
        value={form.email}
        onChangeText={form.setEmail}
        placeholder="nombre@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType={isReset ? 'send' : 'next'}
        onSubmitEditing={isReset ? form.submit : undefined}
      />
      {isReset ? null : (
        <Field
          label="Contraseña"
          value={form.password}
          onChangeText={form.setPassword}
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          autoCapitalize="none"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          textContentType={isRegister ? 'newPassword' : 'password'}
          returnKeyType="go"
          onSubmitEditing={form.submit}
        />
      )}
    </>
  );
}

function FormMessage({ text, color }) {
  if (!text) return null;
  return <Txt variant="caption" color={color} style={{ marginBottom: SPACE.md }} accessibilityLiveRegion="polite">{text}</Txt>;
}

function ModeLink({ mode, onSwitch }) {
  const { colors: C } = useTheme();
  if (mode === 'register') return null;
  const target = mode === 'login' ? 'reset' : 'login';
  const label = mode === 'login' ? 'Olvidé mi contraseña' : 'Volver a iniciar sesión';
  return (
    <Pressable onPress={() => onSwitch(target)} style={{ alignSelf: 'center', padding: SPACE.md }} accessibilityRole="button">
      <Txt variant="label" color={C.brand}>{label}</Txt>
    </Pressable>
  );
}

function SocialLogin({ loading, run }) {
  const { signInWithOAuth, signInWithApple } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  return (
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
  );
}

export default function AuthScreen() {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();
  const form = useAuthForm();
  const isReset = form.mode === 'reset';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: insets.top }} />
        <AuthHeader mode={form.mode} />
        {isReset ? null : (
          <Segmented
            value={form.mode}
            onChange={form.switchMode}
            options={[{ key: 'login', label: 'Iniciar sesión' }, { key: 'register', label: 'Crear cuenta' }]}
            style={{ marginBottom: SPACE.xl }}
          />
        )}
        <CredentialFields form={form} />
        <FormMessage text={form.error} color={C.expense} />
        <FormMessage text={form.notice} color={C.income} />
        <Button title={COPY[form.mode].submit} onPress={form.submit} loading={form.loading} />
        <ModeLink mode={form.mode} onSwitch={form.switchMode} />
        {isReset ? null : <SocialLogin loading={form.loading} run={form.run} />}
        <View style={{ height: insets.bottom }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: SPACE.xl },
});
