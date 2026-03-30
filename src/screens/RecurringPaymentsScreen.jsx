import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { recurringPaymentService } from '../services/recurringPaymentService';
import { notificationService } from '../services/notificationService';
import { subcategoryService } from '../services/subcategoryService';
import { MASTER_CATEGORIES, getCategoryColor, getCategoryIcon } from '../utils/categoryTheme';
import { formatCOP } from '../utils/calculations';

// ─── Componente de ítem ───────────────────────────────────────────────────────

function PaymentItem({ item, onLongPress, colors: C }) {
  const color = getCategoryColor(item.category_key);
  const iconName = item.subcategories?.icon ?? getCategoryIcon(item.category_key);

  return (
    <TouchableOpacity
      onLongPress={() => onLongPress(item)}
      activeOpacity={0.7}
      style={{
        backgroundColor: C.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Ícono */}
      <View style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: color + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
      }}>
        <MaterialCommunityIcons name={iconName} size={22} color={color} />
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{item.name}</Text>
        <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
          Día {item.day_of_month} del mes · Notifica {item.notify_days_before ?? 3} días antes
        </Text>
        {item.subcategories?.name && (
          <Text style={{ fontSize: 11, color: color, marginTop: 2, fontWeight: '600' }}>
            {item.subcategories.name}
          </Text>
        )}
      </View>

      {/* Monto */}
      <Text style={{ fontSize: 15, fontWeight: '800', color: C.pink }}>
        {formatCOP(item.amount)}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Modal de creación / edición ─────────────────────────────────────────────

function PaymentFormModal({ visible, editData, userId, onClose, onSaved, colors: C }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryKey, setCategoryKey] = useState('');
  const [subcategoryId, setSubcategoryId] = useState(null);
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [notifyDaysBefore, setNotifyDaysBefore] = useState('3');
  const [subcats, setSubcats] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Pre-cargar al abrir
  React.useEffect(() => {
    if (!visible) return;
    if (editData) {
      setName(editData.name ?? '');
      setAmount(String(editData.amount ?? ''));
      setCategoryKey(editData.category_key ?? '');
      setSubcategoryId(editData.subcategory_id ?? null);
      setDayOfMonth(String(editData.day_of_month ?? ''));
      setNotifyDaysBefore(String(editData.notify_days_before ?? '3'));
    } else {
      setName('');
      setAmount('');
      setCategoryKey('');
      setSubcategoryId(null);
      setDayOfMonth('');
      setNotifyDaysBefore('3');
    }
    setIsSaving(false);
  }, [visible, editData]);

  // Cargar subcategorías cuando cambia la categoría
  React.useEffect(() => {
    if (!categoryKey || !userId) { setSubcats([]); return; }
    subcategoryService.getByCategory(userId, categoryKey)
      .then(data => setSubcats(data ?? []))
      .catch(() => setSubcats([]));
  }, [categoryKey, userId]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Campo requerido', 'Ingresa el nombre del pago.'); return; }
    const amountNum = parseFloat(String(amount).replace(/[^0-9.]/g, ''));
    if (!amountNum || amountNum <= 0) { Alert.alert('Monto inválido', 'Ingresa un monto válido.'); return; }
    const day = parseInt(dayOfMonth, 10);
    if (!day || day < 1 || day > 31) { Alert.alert('Día inválido', 'El día debe estar entre 1 y 31.'); return; }
    if (!categoryKey) { Alert.alert('Categoría requerida', 'Selecciona una categoría.'); return; }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        amount: amountNum,
        category_key: categoryKey,
        subcategory_id: subcategoryId || null,
        day_of_month: day,
        notify_days_before: parseInt(notifyDaysBefore, 10) || 3,
      };
      if (editData) {
        await recurringPaymentService.update(editData.id, payload);
      } else {
        await recurringPaymentService.create(userId, payload);
      }
      await onSaved();
      onClose();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo guardar el pago.');
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} activeOpacity={1} onPress={onClose} />
        <View style={{
          backgroundColor: C.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 24,
          paddingBottom: 40,
          borderTopWidth: 1,
          borderColor: C.border,
          maxHeight: '90%',
        }}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>
                {editData ? 'Editar pago' : 'Nuevo pago recurrente'}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontSize: 22, color: C.textMuted }}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Nombre */}
            <Text style={lbl(C)}>Nombre</Text>
            <TextInput style={inp(C)} placeholder="Ej: Netflix, Plan de datos..." placeholderTextColor={C.textMuted}
              value={name} onChangeText={setName} returnKeyType="done" editable={!isSaving} />

            {/* Monto */}
            <Text style={lbl(C)}>Monto</Text>
            <TextInput style={inp(C)} placeholder="0" placeholderTextColor={C.textMuted}
              value={amount} onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric" returnKeyType="done" editable={!isSaving} />

            {/* Categoría */}
            <Text style={lbl(C)}>Categoría</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {MASTER_CATEGORIES.map(cat => {
                const isSelected = categoryKey === cat;
                const color = getCategoryColor(cat);
                return (
                  <TouchableOpacity key={cat} onPress={() => { setCategoryKey(cat); setSubcategoryId(null); }}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                      backgroundColor: isSelected ? color : C.bg,
                      borderWidth: 1, borderColor: isSelected ? color : C.border,
                    }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#fff' : C.textMuted }}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Subcategoría (opcional) */}
            {subcats.length > 0 && (
              <>
                <Text style={lbl(C)}>Subcategoría (opcional)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  <TouchableOpacity onPress={() => setSubcategoryId(null)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                      backgroundColor: !subcategoryId ? C.teal : C.bg,
                      borderWidth: 1, borderColor: !subcategoryId ? C.teal : C.border,
                    }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: !subcategoryId ? '#fff' : C.textMuted }}>Ninguna</Text>
                  </TouchableOpacity>
                  {subcats.map(s => {
                    const isSel = subcategoryId === s.id;
                    return (
                      <TouchableOpacity key={s.id} onPress={() => setSubcategoryId(s.id)}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                          backgroundColor: isSel ? s.color : C.bg,
                          borderWidth: 1, borderColor: isSel ? s.color : C.border,
                        }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: isSel ? '#fff' : C.textMuted }}>{s.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Día del mes */}
            <Text style={lbl(C)}>Día del mes en que se cobra (1–31)</Text>
            <TextInput style={inp(C)} placeholder="Ej: 15" placeholderTextColor={C.textMuted}
              value={dayOfMonth} onChangeText={v => setDayOfMonth(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad" returnKeyType="done" editable={!isSaving} />

            {/* Días anticipación */}
            <Text style={lbl(C)}>Días de anticipación para notificar</Text>
            <TextInput style={inp(C)} placeholder="3" placeholderTextColor={C.textMuted}
              value={notifyDaysBefore} onChangeText={v => setNotifyDaysBefore(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad" returnKeyType="done" editable={!isSaving} />

            {/* Botones */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <TouchableOpacity onPress={onClose} disabled={isSaving}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: C.bg, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.textMuted, fontWeight: '700', fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={isSaving}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: C.teal, opacity: isSaving ? 0.7 : 1 }}>
                {isSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                      {editData ? 'Actualizar' : 'Guardar'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function RecurringPaymentsScreen() {
  const { colors: C } = useTheme();
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState(null);

  const loadPayments = useCallback(async (isMounted) => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await recurringPaymentService.getAll(user.id);
      if (!isMounted?.current) return;
      setPayments(data ?? []);
      await notificationService.rescheduleAll(data ?? []);
    } catch (e) {
      if (!isMounted?.current) return;
      Alert.alert('Error', 'No se pudieron cargar los pagos recurrentes.');
    } finally {
      if (isMounted?.current) setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    const isMounted = { current: true };
    loadPayments(isMounted);
    return () => { isMounted.current = false; };
  }, [loadPayments]));

  const handleLongPress = (item) => {
    Alert.alert(item.name, '¿Qué deseas hacer?', [
      {
        text: 'Editar', onPress: () => {
          setEditData(item);
          setModalVisible(true);
        },
      },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await recurringPaymentService.delete(item.id);
            await loadPayments();
          } catch (e) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar el pago.');
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const openCreate = () => {
    setEditData(null);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 20,
        paddingTop: 52,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: -0.5 }}>
          Pagos recurrentes
        </Text>
        <View style={{
          backgroundColor: C.teal + '20',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 20,
        }}>
          <Text style={{ fontSize: 12, color: C.teal, fontWeight: '700' }}>
            {payments.length} activos
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={C.teal} size="large" />
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PaymentItem item={item} onLongPress={handleLongPress} colors={C} />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ marginTop: 60, alignItems: 'center' }}>
              <MaterialCommunityIcons name="bell-ring-outline" size={48} color={C.textMuted} />
              <Text style={{ color: C.textMuted, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
                Sin pagos recurrentes.{'\n'}Toca + para agregar uno.
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={openCreate}
        style={{
          position: 'absolute',
          bottom: 28,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: C.teal,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: C.teal,
          shadowOpacity: 0.5,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal creación/edición */}
      <PaymentFormModal
        visible={modalVisible}
        editData={editData}
        userId={user?.id}
        onClose={() => setModalVisible(false)}
        onSaved={loadPayments}
        colors={C}
      />
    </SafeAreaView>
  );
}

// Helpers de estilo
const lbl = C => ({
  fontSize: 11, fontWeight: '700', color: C.textMuted,
  letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8,
});
const inp = C => ({
  backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.border,
  color: C.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20,
});
