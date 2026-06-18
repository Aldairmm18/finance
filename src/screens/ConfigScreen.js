import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Switch, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { syncData, getLastSync } from '../utils/storage';
import { supabase } from '../services/supabase';

const APP_VERSION = '1.0.0';

// ─── Helper: tiempo relativo ──────────────────────────────────────────────────
function relativeTime(isoString) {
  if (!isoString) return null;
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

// ─── Componente de estado de sync ─────────────────────────────────────────────
function SyncStatusDot({ status, C }) {
  const color = {
    idle: C.textMuted,
    syncing: C.purple,
    success: C.teal,
    error: C.pink,
  }[status] ?? C.textMuted;

  return (
    <View style={[syncDot.dot, { backgroundColor: color }]}>
      {status === 'syncing' && (
        <ActivityIndicator size="small" color={C.bg} style={{ position: 'absolute' }} />
      )}
    </View>
  );
}

const syncDot = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 5 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function ConfigScreen() {
  const { mode, colors: C, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle'|'syncing'|'success'|'error'
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState(null);

  // ── Estado del token de vinculación Telegram ──
  const [linkToken, setLinkToken] = useState(null);        // string de 6 dígitos
  const [linkSecondsLeft, setLinkSecondsLeft] = useState(0);
  const [linkGenerating, setLinkGenerating] = useState(false);
  const countdownRef = useRef(null);

  // Cargar timestamp de la última sync al montar
  useEffect(() => {
    getLastSync().then(ts => setLastSync(ts));
  }, []);

  // Countdown del token
  useEffect(() => {
    if (linkSecondsLeft <= 0) {
      clearInterval(countdownRef.current);
      if (linkToken) setLinkToken(null); // expirado
      return;
    }
    countdownRef.current = setInterval(() => {
      setLinkSecondsLeft(s => s - 1);
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [linkSecondsLeft]);

  const generateLinkToken = useCallback(async () => {
    if (!user || !supabase || linkGenerating) return;
    setLinkGenerating(true);
    try {
      // Token de 6 dígitos aleatorio
      const token = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      // Invalidar tokens anteriores del usuario
      await supabase.from('link_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('used', false);

      // Insertar nuevo token
      const { error } = await supabase.from('link_tokens').insert({
        token,
        user_id: user.id,
        expires_at: expiresAt,
        used: false,
      });
      if (error) throw error;

      setLinkToken(token);
      setLinkSecondsLeft(300); // 5 minutos
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo generar el código. Intenta de nuevo.');
    } finally {
      setLinkGenerating(false);
    }
  }, [user, linkGenerating]);

  const copyToken = useCallback(() => {
    if (!linkToken) return;
    Clipboard.setString(`/vincular ${linkToken}`);
    Alert.alert('Copiado', 'El comando /vincular fue copiado al portapapeles.');
  }, [linkToken]);

  const handleSync = useCallback(async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setSyncError(null);

    const result = await syncData();

    if (result.success) {
      setLastSync(result.timestamp);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3500);
    } else {
      setSyncError(result.reason);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  }, [syncStatus]);

  const syncLabel = {
    idle: 'Sincronizar ahora',
    syncing: 'Sincronizando...',
    success: 'Sincronizado ✓',
    error: 'Error al sincronizar',
  }[syncStatus];

  const syncLabelColor = {
    idle: C.purple,
    syncing: C.purple,
    success: C.teal,
    error: C.pink,
  }[syncStatus];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.title, { color: C.text }]}>Configuración</Text>

      {/* ── Apariencia ── */}
      <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.sectionTitle, { color: C.textMuted }]}>APARIENCIA</Text>
        <View style={[s.row, { borderBottomWidth: 0 }]}>
          <View>
            <Text style={[s.rowLabel, { color: C.text }]}>Modo oscuro</Text>
            <Text style={[s.rowSub, { color: C.textMuted }]}>
              {mode === 'dark' ? 'Tema oscuro activo' : 'Tema claro activo'}
            </Text>
          </View>
          <Switch
            value={mode === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: C.border, true: C.teal + '80' }}
            thumbColor={mode === 'dark' ? C.teal : C.textMuted}
          />
        </View>
      </View>

      {/* ── Sincronización con Supabase ── */}
      <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.sectionTitle, { color: C.textMuted }]}>SINCRONIZACIÓN</Text>

        {/* Estado actual */}
        <View style={[s.syncRow, { borderBottomColor: C.border }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <SyncStatusDot status={syncStatus} C={C} />
              <Text style={[s.rowLabel, { color: C.text }]}>Supabase Cloud</Text>
            </View>
            {lastSync && syncStatus === 'idle' && (
              <Text style={[s.rowSub, { color: C.textMuted }]}>
                Última sync: {relativeTime(lastSync)}
              </Text>
            )}
            {!lastSync && syncStatus === 'idle' && (
              <Text style={[s.rowSub, { color: C.textMuted }]}>
                Sin sincronizar — los datos se guardan localmente
              </Text>
            )}
            {syncStatus === 'syncing' && (
              <Text style={[s.rowSub, { color: C.purple }]}>
                Subiendo datos a la nube...
              </Text>
            )}
            {syncStatus === 'success' && (
              <Text style={[s.rowSub, { color: C.teal }]}>
                Datos sincronizados correctamente
              </Text>
            )}
            {syncStatus === 'error' && syncError && (
              <Text style={[s.rowSub, { color: C.pink }]} numberOfLines={2}>
                {syncError}
              </Text>
            )}
          </View>
        </View>

        {/* Botón de sync */}
        <TouchableOpacity
          style={[s.syncBtn, {
            borderTopColor: C.border,
            opacity: syncStatus === 'syncing' ? 0.6 : 1,
          }]}
          onPress={handleSync}
          disabled={syncStatus === 'syncing'}
          activeOpacity={0.7}
        >
          {syncStatus === 'syncing' ? (
            <ActivityIndicator size="small" color={C.purple} style={{ marginRight: 8 }} />
          ) : null}
          <Text style={[s.syncBtnText, { color: syncLabelColor }]}>
            {syncLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Info de la app ── */}
      <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.sectionTitle, { color: C.textMuted }]}>INFORMACIÓN</Text>
        <View style={[s.infoRow, { borderBottomColor: C.border }]}>
          <Text style={[s.infoLabel, { color: C.textMuted }]}>Versión</Text>
          <Text style={[s.infoValue, { color: C.text }]}>{APP_VERSION}</Text>
        </View>
        <View style={[s.infoRow, { borderBottomColor: C.border }]}>
          <Text style={[s.infoLabel, { color: C.textMuted }]}>Backend</Text>
          <Text style={[s.infoValue, { color: C.text }]}>Supabase PostgreSQL</Text>
        </View>
        <View style={[s.infoRow, { borderBottomColor: C.border }]}>
          <Text style={[s.infoLabel, { color: C.textMuted }]}>Autor</Text>
          <Text style={[s.infoValue, { color: C.text }]}>Aldair Murillo</Text>
        </View>
        <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={[s.infoLabel, { color: C.textMuted }]}>Stack</Text>
          <Text style={[s.infoValue, { color: C.text }]}>React Native · Expo SDK 55</Text>
        </View>
      </View>

      {/* ── Vincular Telegram ── */}
      <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.sectionTitle, { color: C.textMuted }]}>TELEGRAM</Text>

        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 19, marginBottom: 14 }}>
            Genera un código de un solo uso para vincular el bot de Telegram.
            {'\n'}Tu contraseña nunca sale de la app.
          </Text>

          {/* Token visible */}
          {linkToken && linkSecondsLeft > 0 ? (
            <View style={{
              backgroundColor: C.bg,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: C.teal + '60',
              padding: 16,
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 }}>
                CÓDIGO DE VINCULACIÓN
              </Text>
              <Text style={{ fontSize: 36, fontWeight: '900', color: C.teal, letterSpacing: 8, marginBottom: 8 }}>
                {linkToken}
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted }}>
                Expira en {Math.floor(linkSecondsLeft / 60)}:{String(linkSecondsLeft % 60).padStart(2, '0')}
              </Text>
            </View>
          ) : null}

          {/* Instrucción */}
          {linkToken && linkSecondsLeft > 0 ? (
            <View style={{
              backgroundColor: C.purple + '15',
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}>
              <Text style={{ fontSize: 12, color: C.text, lineHeight: 18 }}>
                En el bot de Telegram escribe:{'\n'}
                <Text style={{ fontWeight: '800', fontFamily: 'monospace', color: C.purple }}>
                  /vincular {linkToken}
                </Text>
              </Text>
            </View>
          ) : null}

          {/* Botones */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={generateLinkToken}
              disabled={linkGenerating}
              style={{
                flex: 1,
                backgroundColor: C.teal,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
                opacity: linkGenerating ? 0.7 : 1,
              }}
            >
              {linkGenerating
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="refresh" size={16} color="#fff" />
              }
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                {linkToken && linkSecondsLeft > 0 ? 'Nuevo código' : 'Generar código'}
              </Text>
            </TouchableOpacity>

            {linkToken && linkSecondsLeft > 0 ? (
              <TouchableOpacity
                onPress={copyToken}
                style={{
                  backgroundColor: C.purple + '20',
                  borderRadius: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="copy-outline" size={18} color={C.purple} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      {/* ── Cuenta ── */}
      <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.sectionTitle, { color: C.textMuted }]}>CUENTA</Text>
        <View style={[s.infoRow, { borderBottomColor: C.border }]}>
          <Text style={[s.infoLabel, { color: C.textMuted }]}>Correo</Text>
          <Text style={[s.infoValue, { color: C.text }]} numberOfLines={1}>{user?.email || '—'}</Text>
        </View>
        <TouchableOpacity
          style={[s.syncBtn, { borderTopColor: C.border }]}
          onPress={signOut}
          activeOpacity={0.7}
        >
          <Text style={[s.syncBtnText, { color: C.pink }]}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, paddingTop: 52, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: '900', marginBottom: 24, letterSpacing: -0.5 },
  section: { borderRadius: 12, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.3,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 17 },

  // Sync
  syncRow: {
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderTopWidth: 1,
  },
  syncBtnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },

  // Info
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '500' },
});
