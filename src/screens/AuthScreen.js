import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function AuthScreen() {
    const { signIn, signUp, resetPassword } = useAuth();
    const { colors: C } = useTheme();

    const [mode, setMode] = useState('login'); // 'login' | 'register' | 'reset'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const s = useMemo(() => makeStyles(C), [C]);

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        const trimEmail = email.trim().toLowerCase();

        if (!trimEmail) {
            setError('Ingresa tu correo electrónico');
            return;
        }

        if (mode !== 'reset' && (!password || password.length < 6)) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        try {
            if (mode === 'login') {
                await signIn(trimEmail, password);
            } else if (mode === 'register') {
                await signUp(trimEmail, password);
                setEmail('');
                setPassword('');
                setMode('login');
                setSuccess('¡Registro exitoso! Por favor inicia sesión.');
                Alert.alert('Registro exitoso', 'Tu cuenta ha sido creada. Por favor inicia sesión.');
            } else {
                await resetPassword(trimEmail);
                setSuccess('Revisa tu correo para restablecer la contraseña.');
                setMode('login');
            }
        } catch (e) {
            const msg = e.message || 'Error inesperado';
            if (msg.includes('Invalid login')) setError('Correo o contraseña incorrectos');
            else if (msg.includes('already registered')) setError('Este correo ya está registrado');
            else if (msg.includes('valid email')) setError('Ingresa un correo válido');
            else setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setError('');
        setSuccess('');
        setEmail('');
        setPassword('');
    };

    return (
        <KeyboardAvoidingView
            style={s.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={s.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ── Logo / Title ── */}
                <View style={s.logoSection}>
                    <View style={[s.logoCircle, { backgroundColor: C.teal + '20', borderColor: C.teal + '40' }]}>
                        <Text style={s.logoEmoji}>💰</Text>
                    </View>
                    <Text style={[s.appTitle, { color: C.text }]}>Finance</Text>
                    <Text style={[s.appSubtitle, { color: C.textMuted }]}>
                        Tu asistente financiero personal
                    </Text>
                </View>

                {/* ── Card ── */}
                <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
                    {/* Accent bar */}
                    <View style={[s.cardAccent, { backgroundColor: C.teal }]} />

                    {/* Mode tabs */}
                    {mode !== 'reset' && (
                        <View style={[s.modeTabs, { backgroundColor: C.bg, borderColor: C.border }]}>
                            <TouchableOpacity
                                onPress={() => switchMode('login')}
                                style={[
                                    s.modeTab,
                                    mode === 'login' && { backgroundColor: C.teal },
                                ]}
                            >
                                <Text style={[
                                    s.modeTabText,
                                    { color: mode === 'login' ? '#fff' : C.textMuted },
                                ]}>
                                    Iniciar sesión
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => switchMode('register')}
                                style={[
                                    s.modeTab,
                                    mode === 'register' && { backgroundColor: C.teal },
                                ]}
                            >
                                <Text style={[
                                    s.modeTabText,
                                    { color: mode === 'register' ? '#fff' : C.textMuted },
                                ]}>
                                    Registrarse
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {mode === 'reset' && (
                        <View style={{ paddingTop: 16 }}>
                            <Text style={[s.resetTitle, { color: C.text }]}>
                                Recuperar contraseña
                            </Text>
                            <Text style={[s.resetSub, { color: C.textMuted }]}>
                                Te enviaremos un enlace a tu correo
                            </Text>
                        </View>
                    )}

                    {/* Email */}
                    <Text style={[s.label, { color: C.textMuted }]}>Correo electrónico</Text>
                    <TextInput
                        style={[s.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="tu@correo.com"
                        placeholderTextColor={C.textMuted}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        returnKeyType={mode === 'reset' ? 'done' : 'next'}
                    />

                    {/* Password (not on reset mode) */}
                    {mode !== 'reset' && (
                        <>
                            <Text style={[s.label, { color: C.textMuted }]}>Contraseña</Text>
                            <TextInput
                                style={[s.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                                placeholder="Mínimo 6 caracteres"
                                placeholderTextColor={C.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                returnKeyType="done"
                            />
                        </>
                    )}

                    {/* Error */}
                    {error ? (
                        <View style={[s.alertBox, { backgroundColor: C.pink + '15', borderColor: C.pink + '40' }]}>
                            <Text style={[s.alertText, { color: C.pink }]}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Success */}
                    {success ? (
                        <View style={[s.alertBox, { backgroundColor: C.teal + '15', borderColor: C.teal + '40' }]}>
                            <Text style={[s.alertText, { color: C.teal }]}>{success}</Text>
                        </View>
                    ) : null}

                    {/* Submit button */}
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={loading}
                        style={[s.btn, { backgroundColor: C.teal }]}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={s.btnText}>
                                {mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta' : 'Enviar enlace'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Forgot password / back */}
                    {mode === 'login' && (
                        <TouchableOpacity onPress={() => switchMode('reset')} style={s.linkBtn}>
                            <Text style={[s.linkText, { color: C.teal }]}>¿Olvidaste tu contraseña?</Text>
                        </TouchableOpacity>
                    )}
                    {mode === 'reset' && (
                        <TouchableOpacity onPress={() => switchMode('login')} style={s.linkBtn}>
                            <Text style={[s.linkText, { color: C.teal }]}>← Volver a iniciar sesión</Text>
                        </TouchableOpacity>
                    )}

                    {/* Info for register */}
                    {mode === 'register' && (
                        <Text style={[s.infoText, { color: C.textMuted }]}>
                            Al registrarte, tus datos existentes se migrarán a tu nueva cuenta.
                        </Text>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function makeStyles(C) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: C.bg },
        scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 60 },

        // Logo
        logoSection: { alignItems: 'center', marginBottom: 32 },
        logoCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
        logoEmoji: { fontSize: 32 },
        appTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
        appSubtitle: { fontSize: 14, fontWeight: '500' },

        // Card
        card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 20, paddingBottom: 24 },
        cardAccent: { height: 3, marginHorizontal: -20 },

        // Mode tabs
        modeTabs: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden', marginTop: 20, marginBottom: 4 },
        modeTab: { flex: 1, paddingVertical: 11, alignItems: 'center' },
        modeTabText: { fontSize: 13, fontWeight: '700' },

        // Reset header
        resetTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
        resetSub: { fontSize: 12, marginBottom: 4 },

        // Form
        label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
        input: { borderRadius: 10, borderWidth: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, fontWeight: '500' },

        // Alert
        alertBox: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14 },
        alertText: { fontSize: 13, fontWeight: '600' },

        // Button
        btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
        btnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },

        // Links
        linkBtn: { alignItems: 'center', marginTop: 16 },
        linkText: { fontSize: 13, fontWeight: '600' },
        infoText: { fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 17 },
    });
}
