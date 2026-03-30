import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// Paleta de 10 colores seleccionables
const COLOR_PALETTE = [
  '#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#14B8A6',
  '#8B5CF6', '#F472B6', '#EF4444', '#F97316', '#94A3B8',
];

// 12 íconos de MaterialCommunityIcons disponibles
const ICON_OPTIONS = [
  'food',
  'heart',
  'car',
  'home',
  'cart',
  'briefcase',
  'music',
  'gamepad-variant',
  'phone',
  'dumbbell',
  'pill',
  'tshirt-crew',
];

/**
 * Modal reutilizable para crear y editar subcategorías.
 *
 * Props:
 *   visible: bool
 *   onClose: fn
 *   onSave: fn(subcategoryData)
 *   categoryKey: string   — categoría padre (ej: 'alimentacion')
 *   editData: object|null — null = crear, objeto = editar
 */
export default function SubcategoryModal({ visible, onClose, onSave, categoryKey, editData }) {
  const { colors: C } = useTheme();

  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0]);
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [durationMonths, setDurationMonths] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Pre-cargar datos en modo edición
  useEffect(() => {
    if (editData) {
      setName(editData.name ?? '');
      setSelectedIcon(editData.icon ?? ICON_OPTIONS[0]);
      setSelectedColor(editData.color ?? COLOR_PALETTE[0]);
      setDurationMonths(editData.duration_months != null ? String(editData.duration_months) : '');
    } else {
      setName('');
      setSelectedIcon(ICON_OPTIONS[0]);
      setSelectedColor(COLOR_PALETTE[0]);
      setDurationMonths('');
    }
    setIsSaving(false);
  }, [editData, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Campo requerido', 'Ingresa un nombre para la subcategoría.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        icon: selectedIcon,
        color: selectedColor,
        category_key: categoryKey,
        duration_months: durationMonths ? parseInt(durationMonths, 10) : null,
      });
      // El padre maneja el cierre desde onSave — no llamar onClose() aquí
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo guardar la subcategoría.');
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={{
          backgroundColor: C.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 24,
          paddingBottom: 40,
          borderTopWidth: 1,
          borderColor: C.border,
          maxHeight: '85%',
        }}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.3 }}>
                {editData ? 'Editar subcategoría' : 'Nueva subcategoría'}
              </Text>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <Text style={{ fontSize: 22, color: C.textMuted, lineHeight: 24 }}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Nombre */}
            <Text style={labelStyle(C)}>Nombre</Text>
            <TextInput
              style={inputStyle(C)}
              placeholder="Ej: Médico, Sushi, Gasolina..."
              placeholderTextColor={C.textMuted}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              editable={!isSaving}
            />

            {/* Selector de íconos */}
            <Text style={labelStyle(C)}>Ícono</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {ICON_OPTIONS.map(icon => {
                const isSelected = selectedIcon === icon;
                return (
                  <TouchableOpacity
                    key={icon}
                    onPress={() => setSelectedIcon(icon)}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? selectedColor + '30' : C.bg,
                      borderWidth: 2,
                      borderColor: isSelected ? selectedColor : C.border,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={icon}
                      size={22}
                      color={isSelected ? selectedColor : C.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selector de color */}
            <Text style={labelStyle(C)}>Color</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              {COLOR_PALETTE.map(color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: color,
                    borderWidth: selectedColor === color ? 3 : 0,
                    borderColor: C.text,
                    shadowColor: color,
                    shadowOpacity: selectedColor === color ? 0.6 : 0,
                    shadowRadius: 4,
                    elevation: selectedColor === color ? 4 : 0,
                  }}
                />
              ))}
            </View>

            {/* Duración en meses */}
            <Text style={labelStyle(C)}>¿Cuántos meses aplica? (dejar vacío = sin límite)</Text>
            <TextInput
              style={inputStyle(C)}
              placeholder="Ej: 6, 12..."
              placeholderTextColor={C.textMuted}
              value={durationMonths}
              onChangeText={v => setDurationMonths(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              returnKeyType="done"
              editable={!isSaving}
            />

            {/* Botones */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                onPress={onClose}
                disabled={isSaving}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: C.bg,
                  borderWidth: 1,
                  borderColor: C.border,
                }}
              >
                <Text style={{ color: C.textMuted, fontWeight: '700', fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                style={{
                  flex: 2,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: selectedColor,
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                  {editData ? 'Actualizar' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function labelStyle(C) {
  return {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  };
}

function inputStyle(C) {
  return {
    backgroundColor: C.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  };
}
