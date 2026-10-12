import React, { useCallback, useEffect, useState } from 'react';
import { View, Alert, Share, Linking } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Screen, Txt, Card, Divider, Segmented, ListRow, Button, SectionTitle } from '../components/ui';
import { syncData, getLastSync, getPendingCount } from '../utils/storage';
import { supabase } from '../services/supabase';
import { notificationService } from '../services/notificationService';
import { SPACE, NUM } from '../theme/tokens';
import { PRIVACY_URL } from '../config';

const TOKEN_TTL_SECONDS = 300;

function relativeTime(iso) {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/** Código de 6 dígitos con aleatoriedad criptográfica. */
function secureSixDigits() {
  const bytes = Crypto.getRandomBytes(4);
  const n = ((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
  return String(100000 + (n % 900000));
}

export default function SettingsScreen() {
  const { colors: C, preference, setPreference } = useTheme();
  const { user, signOut, deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const navigation = useNavigation();

  const [lastSync, setLastSync] = useState(null);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const [token, setToken] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [generating, setGenerating] = useState(false);

  useFocusEffect(useCallback(() => {
    getLastSync().then(setLastSync);
    getPendingCount().then(setPending);
  }, []));

  // Cuenta regresiva del código de vinculación.
  useEffect(() => {
    if (!token) return undefined;
    const t = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { setToken(null); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [token]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    const res = await syncData();
    setSyncing(false);
    if (res.success) {
      setLastSync(res.timestamp);
      setPending(0);
      setSyncMessage(res.uploaded ? `Se subieron ${res.uploaded} cambios pendientes.` : 'Todo estaba al día.');
    } else {
      setSyncMessage(res.reason);
    }
  };

  const generateToken = async () => {
    if (!user || !supabase || generating) return;
    setGenerating(true);
    try {
      const code = secureSixDigits();
      await supabase.from('link_tokens').delete().eq('user_id', user.id).eq('used', false);
      const { error } = await supabase.from('link_tokens').insert({
        token: code,
        user_id: user.id,
        expires_at: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
        used: false,
      });
      if (error) throw error;
      setToken(code);
      setSecondsLeft(TOKEN_TTL_SECONDS);
    } catch (e) {
      Alert.alert('No se pudo generar el código', e?.message || 'Intenta de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  const shareToken = () => {
    if (token) Share.share({ message: `/vincular ${token}` }).catch(() => {});
  };

  const confirmSignOut = () => {
    Alert.alert('Cerrar sesión', 'Se borrarán los datos guardados en este teléfono. Tu información sigue en la nube.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
    ]);
  };

  const runDelete = async () => {
    setDeleting(true);
    try {
      await notificationService.cancelAllPaymentNotifications();
      await deleteAccount();
    } catch (e) {
      setDeleting(false);
      Alert.alert('No se pudo eliminar la cuenta', e?.message || 'Revisa tu conexión e intenta de nuevo.');
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Se borrarán para siempre tu cuenta, presupuestos, movimientos, pagos fijos y la vinculación con Telegram. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => Alert.alert('¿Seguro?', 'Confirma que quieres borrar todos tus datos.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar todo', style: 'destructive', onPress: runDelete },
          ]),
        },
      ],
    );
  };

  const version = Constants.expoConfig?.version || '1.0.0';

  return (
    <Screen withTopInset={false}>
      <SectionTitle title="Apariencia" style={{ marginTop: 0 }} />
      <Segmented
        value={preference}
        onChange={setPreference}
        options={[{ key: 'system', label: 'Sistema' }, { key: 'light', label: 'Claro' }, { key: 'dark', label: 'Oscuro' }]}
      />

      <SectionTitle title="Organización" />
      <Card padded={false} style={{ paddingHorizontal: SPACE.lg }}>
        <ListRow icon="repeat-outline" title="Pagos fijos" subtitle="Recordatorios antes de cada cobro" onPress={() => navigation.navigate('Pagos')} />
      </Card>

      <SectionTitle title="Sincronización" />
      <Card>
        <Txt>{pending > 0 ? `${pending} cambio${pending > 1 ? 's' : ''} sin subir` : 'Todo está en la nube'}</Txt>
        <Txt variant="caption" muted style={{ marginTop: 2, marginBottom: SPACE.md }}>
          {lastSync ? `Última sincronización ${relativeTime(lastSync)}` : 'Aún no se ha sincronizado desde este teléfono'}
        </Txt>
        <Button title="Sincronizar ahora" variant="secondary" icon="sync-outline" onPress={handleSync} loading={syncing} />
        {syncMessage ? <Txt variant="caption" muted style={{ marginTop: SPACE.sm }}>{syncMessage}</Txt> : null}
      </Card>

      <SectionTitle title="Bot de Telegram" />
      <Card>
        <Txt muted style={{ lineHeight: 21, marginBottom: SPACE.md }}>
          Genera un código de un solo uso y envíalo al bot. Nunca compartas tu contraseña por chat.
        </Txt>
        {token ? (
          <View style={{ alignItems: 'center', paddingVertical: SPACE.md, marginBottom: SPACE.md, borderRadius: 12, backgroundColor: C.sunken }}>
            <Txt variant="display" selectable style={[NUM, { letterSpacing: 6 }]}>{token}</Txt>
            <Txt variant="caption" muted style={{ marginTop: 4 }}>
              Escribe /vincular {token} en el bot · expira en {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </Txt>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
          <Button title={token ? 'Nuevo código' : 'Generar código'} variant="secondary" onPress={generateToken} loading={generating} style={{ flex: 1 }} />
          {token ? <Button title="Compartir" icon="paper-plane-outline" onPress={shareToken} style={{ flex: 1 }} /> : null}
        </View>
      </Card>

      <SectionTitle title="Cuenta" />
      <Card padded={false} style={{ paddingHorizontal: SPACE.lg }}>
        <ListRow icon="mail-outline" title={user?.email || 'Sin correo'} />
        <Divider inset={32} />
        <ListRow icon="log-out-outline" title="Cerrar sesión" destructive onPress={confirmSignOut} />
      </Card>

      <Button
        title="Eliminar mi cuenta"
        variant="danger"
        icon="trash-outline"
        onPress={confirmDelete}
        loading={deleting}
        style={{ marginTop: SPACE.xl }}
      />
      <Txt variant="caption" faint center style={{ marginTop: SPACE.sm }}>
        Borra tu cuenta y todos tus datos de forma permanente.
      </Txt>

      {PRIVACY_URL ? (
        <Txt variant="caption" color={C.brand} center style={{ marginTop: SPACE.xl }} onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
          Política de privacidad
        </Txt>
      ) : null}
      <Txt variant="caption" faint center style={{ marginTop: SPACE.md }}>Finance {version}</Txt>
    </Screen>
  );
}
