import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { formatCOP } from '../utils/calculations';
import { MASTER_CATEGORIES, CATEGORY_COLORS, normalizeCategoria } from '../utils/categoryTheme';
import { supabase } from '../services/supabase';

const EDIT_CATEGORIAS = MASTER_CATEGORIES;

export default function EditTransaccionModal({ transaction, onClose, onUpdated }) {
  const { colors: C } = useTheme();
  const [editMonto, setEditMonto] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editCategoria, setEditCategoria] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const reset = useCallback(() => {
    setEditMonto('');
    setEditDescripcion('');
    setEditCategoria('');
    setEditSubmitting(false);
  }, []);

  useEffect(() => {
    if (!transaction) {
      reset();
      return;
    }
    setEditMonto(String(transaction.monto ?? ''));
    setEditDescripcion(transaction.descripcion ?? '');
    setEditCategoria(normalizeCategoria(transaction.categoria));
  }, [transaction, reset]);

  const handleClose = useCallback(() => {
    reset();
    onClose?.();
  }, [reset, onClose]);

  const actualizarTransaccion = useCallback(async () => {
    if (!transaction) return;
    if (editSubmitting) return;
    Keyboard.dismiss();
    const montoNum = parseFloat(String(editMonto).replace(/[^0-9.]/g, ''));
    if (!montoNum || montoNum <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto válido.');
      return;
    }
    const categoriaFinal = MASTER_CATEGORIES.includes(editCategoria) ? editCategoria : 'Otros';
    setEditSubmitting(true);
    try {
      if (!supabase) throw new Error('Sin conexión a Supabase');
      const { error } = await supabase
        .from('transacciones')
        .update({
          monto: montoNum,
          descripcion: editDescripcion.trim(),
          categoria: categoriaFinal,
        })
        .eq('id', transaction.id);
      if (error) throw error;
      if (onUpdated) await onUpdated();
      handleClose();
    } catch (e) {
      setEditSubmitting(false);
      Alert.alert('Error', e?.message || 'No se pudo actualizar el movimiento.');
    }
  }, [transaction, editSubmitting, editMonto, editDescripcion, editCategoria, onUpdated, handleClose]);

  return (
    <Modal
      visible={!!transaction}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={{
          backgroundColor: C.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 24,
          paddingBottom: 36,
          borderTopWidth: 1,
          borderColor: C.border,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.3 }}>
                Editar movimiento
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                Actualiza monto, descripción y categoría
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={{ paddingLeft: 12, paddingBottom: 4 }}>
              <Text style={{ fontSize: 22, color: C.textMuted, lineHeight: 24 }}>x</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 1, backgroundColor: C.border, marginVertical: 16 }} />

          <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>
            Descripción
          </Text>
          <TextInput
            style={{
              backgroundColor: C.bg,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C.border,
              color: C.text,
              fontSize: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 14,
            }}
            placeholder="Descripción"
            placeholderTextColor={C.textMuted}
            value={editDescripcion}
            onChangeText={setEditDescripcion}
            blurOnSubmit={true}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            editable={!editSubmitting}
          />

          <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8 }}>
            Categoría
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {EDIT_CATEGORIAS.map(cat => {
              const selected = editCategoria === cat;
              const chipColor = CATEGORY_COLORS[cat] || C.teal;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setEditCategoria(cat)}
                  disabled={editSubmitting}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: selected ? chipColor : C.bg,
                    borderWidth: 1,
                    borderColor: selected ? chipColor : C.border,
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: selected ? '#fff' : C.textMuted,
                  }}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>
            Monto
          </Text>
          <TextInput
            style={{
              backgroundColor: C.bg,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C.border,
              color: C.text,
              fontSize: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 4,
            }}
            placeholder="0"
            placeholderTextColor={C.textMuted}
            value={editMonto}
            onChangeText={setEditMonto}
            keyboardType="numeric"
            blurOnSubmit={true}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            editable={!editSubmitting}
          />
          {editMonto ? (
            <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>
              = {formatCOP(parseFloat(String(editMonto).replace(/[^0-9.]/g, '')) || 0)}
            </Text>
          ) : (
            <View style={{ marginBottom: 14 }} />
          )}

          <TouchableOpacity
            onPress={actualizarTransaccion}
            disabled={editSubmitting}
            style={{
              backgroundColor: C.teal,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: editSubmitting ? 0.7 : 1,
            }}
          >
            {editSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 }}>
                Guardar cambios
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
