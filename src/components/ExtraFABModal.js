import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { registrarExtraordinario } from '../utils/storage';
import { formatCOP } from '../utils/calculations';

const EXTRA_CATS_GASTO = [
  { key: 'hogar', label: 'Hogar' },
  { key: 'comida', label: 'Comida' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'salud', label: 'Salud' },
  { key: 'entretenimiento', label: 'Entretenimiento' },
  { key: 'familia', label: 'Familia' },
  { key: 'educacion', label: 'Educación' },
  { key: 'otros', label: 'Otros' },
];

const EXTRA_CATS_INGRESO = [
  { key: 'salario', label: 'Salario' },
  { key: 'bonos', label: 'Bonos' },
  { key: 'comisiones', label: 'Comisión' },
  { key: 'dividendos', label: 'Dividendos' },
  { key: 'hogar', label: 'Hogar' },
  { key: 'comida', label: 'Comida' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'creditos', label: 'Créditos' },
  { key: 'entretenimiento', label: 'Entretenimiento' },
  { key: 'familia', label: 'Familia' },
  { key: 'ahorro', label: 'Ahorro' },
  { key: 'otros', label: 'Otros' },
];

export default function ExtraFABModal({ visible, onClose, onSuccess }) {
  const { colors: C } = useTheme();
  const [tipo, setTipo] = useState('gasto');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('otros');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cats = tipo === 'ingreso' ? EXTRA_CATS_INGRESO : EXTRA_CATS_GASTO;
  const accentColor = tipo === 'ingreso' ? C.teal : C.pink;

  const reset = () => {
    setTipo('gasto');
    setDescripcion('');
    setMonto('');
    setCategoria('otros');
    setError('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTipoChange = (t) => {
    setTipo(t);
    setCategoria(t === 'ingreso' ? 'salario' : 'otros');
    setError('');
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (isSubmitting) return;
    const montoNum = parseFloat(String(monto).replace(/[^0-9.]/g, ''));
    if (!descripcion.trim()) { setError('Ingresa una descripción'); return; }
    if (!montoNum || montoNum <= 0) { setError('Ingresa un monto válido'); return; }
    setError('');
    setIsSubmitting(true);
    try {
      await registrarExtraordinario({
        descripcion: descripcion.trim(),
        monto: montoNum,
        categoria,
        tipo,
      });
      reset();
      onSuccess();
    } catch (e) {
      setError(e.message || 'Error al guardar');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
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
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.3 }}>
                Transacción extraordinaria
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                Registra algo fuera de tu presupuesto
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={{ paddingLeft: 12, paddingBottom: 4 }}>
              <Text style={{ fontSize: 22, color: C.textMuted, lineHeight: 24 }}>x</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 1, backgroundColor: C.border, marginVertical: 16 }} />

          {/* Tipo toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: 'hidden' }}>
            {[{ key: 'gasto', label: 'Gasto', color: C.pink }, { key: 'ingreso', label: 'Ingreso', color: C.teal }].map(opt => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => handleTipoChange(opt.key)}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: tipo === opt.key ? opt.color : 'transparent',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: tipo === opt.key ? '#fff' : C.textMuted }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Descripcion */}
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
            placeholder={tipo === 'ingreso' ? 'Ej. Freelance, Venta, Regalo...' : 'Ej. Médico, Reparación, Regalo...'}
            placeholderTextColor={C.textMuted}
            value={descripcion}
            onChangeText={setDescripcion}
            blurOnSubmit={true}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            editable={!isSubmitting}
          />

          {/* Monto */}
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
            value={monto}
            onChangeText={setMonto}
            keyboardType="numeric"
            blurOnSubmit={true}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            editable={!isSubmitting}
          />
          {monto ? (
            <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>
              = {formatCOP(parseFloat(String(monto).replace(/[^0-9.]/g, '')) || 0)}
            </Text>
          ) : (
            <View style={{ marginBottom: 14 }} />
          )}

          {/* Categoria */}
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8 }}>
            Categoría
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {cats.map(cat => (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setCategoria(cat.key)}
                disabled={isSubmitting}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: categoria === cat.key ? accentColor : C.bg,
                  borderWidth: 1,
                  borderColor: categoria === cat.key ? accentColor : C.border,
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: categoria === cat.key ? '#fff' : C.textMuted,
                }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Error */}
          {error ? (
            <Text style={{ color: C.pink, fontSize: 12, marginBottom: 12 }}>{error}</Text>
          ) : null}

          {/* Boton guardar */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{
              backgroundColor: accentColor,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 }}>
                {tipo === 'ingreso' ? 'Guardar ingreso' : 'Guardar gasto'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
