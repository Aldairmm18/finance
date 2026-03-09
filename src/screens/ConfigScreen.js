import React from 'react';
import { View, Text, Switch, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const APP_VERSION = '1.0.0';

export default function ConfigScreen() {
  const { mode, colors: C, toggleTheme } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={s.content}
    >
      <Text style={[s.title, { color: C.text }]}>Configuración</Text>

      {/* Apariencia */}
      <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.sectionTitle, { color: C.textMuted }]}>APARIENCIA</Text>
        <View style={[s.row, { borderBottomColor: C.border }]}>
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

      {/* Sincronización — placeholder Fase 3 */}
      <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.sectionTitle, { color: C.textMuted }]}>SINCRONIZACIÓN</Text>
        <View style={[s.row, { borderBottomColor: C.border }]}>
          <View>
            <Text style={[s.rowLabel, { color: C.text }]}>Supabase Cloud</Text>
            <Text style={[s.rowSub, { color: C.textMuted }]}>Sincroniza tus datos en la nube</Text>
          </View>
          <View style={[s.badge, { backgroundColor: C.purple + '20', borderColor: C.purple + '40' }]}>
            <Text style={[s.badgeText, { color: C.purple }]}>Próximo</Text>
          </View>
        </View>
      </View>

      {/* Info de la app */}
      <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.sectionTitle, { color: C.textMuted }]}>INFORMACIÓN</Text>
        <View style={[s.infoRow, { borderBottomColor: C.border }]}>
          <Text style={[s.infoLabel, { color: C.textMuted }]}>Versión</Text>
          <Text style={[s.infoValue, { color: C.text }]}>{APP_VERSION}</Text>
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
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, paddingTop: 52, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, marginTop: 2 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '500' },
});
