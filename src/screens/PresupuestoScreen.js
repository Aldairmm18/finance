import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadData, saveData } from '../utils/storage';
import { PERIODICIDADES, formatCOP, toMonthly, toAnnual } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';

// ─── Metadata ────────────────────────────────────────────────────────────────

const INCOME_ITEMS = [
  { key: 'salario', label: 'Salario' },
  { key: 'bonos', label: 'Bonos' },
  { key: 'dividendos', label: 'Dividendos' },
  { key: 'comisiones', label: 'Comisiones' },
  { key: 'otros', label: 'Otros' },
];

const EXPENSE_CATEGORIES = [
  {
    key: 'hogar', label: 'Hogar', icon: '🏠',
    items: [
      { key: 'arriendo', label: 'Arriendo' },
      { key: 'administracion', label: 'Administración' },
      { key: 'luz', label: 'Luz' },
      { key: 'agua', label: 'Agua' },
      { key: 'gas', label: 'Gas' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'internet', label: 'Internet' },
      { key: 'tv', label: 'TV' },
      { key: 'otro', label: 'Otro' },
    ],
  },
  {
    key: 'comida', label: 'Comida', icon: '🍽️',
    items: [
      { key: 'mercado', label: 'Mercado' },
      { key: 'comidasFuera', label: 'Comidas por fuera' },
      { key: 'otro', label: 'Otro' },
    ],
  },
  {
    key: 'transporte', label: 'Transporte', icon: '🚗',
    items: [
      { key: 'gasolina', label: 'Gasolina' },
      { key: 'taxiUber', label: 'Taxi / Uber' },
      { key: 'mantenimientoAuto', label: 'Mantenimiento auto' },
      { key: 'seguroAuto', label: 'Seguro auto' },
      { key: 'otro', label: 'Otro' },
    ],
  },
  {
    key: 'creditos', label: 'Créditos / Deudas', icon: '💳',
    items: [
      { key: 'creditoHipotecario', label: 'Crédito Hipotecario' },
      { key: 'creditoAuto', label: 'Crédito Auto' },
      { key: 'tarjetaCredito', label: 'Tarjeta de Crédito' },
      { key: 'otro', label: 'Otro' },
    ],
  },
  {
    key: 'entretenimiento', label: 'Entretenimiento', icon: '🎉',
    items: [
      { key: 'viajes', label: 'Viajes' },
      { key: 'restaurantes', label: 'Restaurantes' },
      { key: 'diversion', label: 'Diversión' },
      { key: 'fiesta', label: 'Fiesta' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    key: 'familia', label: 'Familia', icon: '👨‍👩‍👧',
    items: [
      { key: 'colegios', label: 'Colegios' },
      { key: 'seguroMedico', label: 'Seguro Médico' },
      { key: 'otrosSeguros', label: 'Otros Seguros' },
      { key: 'suscripciones', label: 'Suscripciones' },
      { key: 'gimnasio', label: 'Gimnasio' },
      { key: 'impuestos', label: 'Impuestos' },
      { key: 'entretenimiento', label: 'Entretenimiento' },
      { key: 'otros', label: 'Otros' },
    ],
  },
];

// ─── PeriodicidadModal ────────────────────────────────────────────────────────

function PeriodicidadModal({ visible, current, onSelect, onClose }) {
  const { colors: C } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 20, width: 240, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 12, textAlign: 'center' }}>
            Periodicidad
          </Text>
          {PERIODICIDADES.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[
                { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 4 },
                current === p.value && { backgroundColor: C.teal + '30' },
              ]}
              onPress={() => { onSelect(p.value); onClose(); }}
            >
              <Text style={[
                { fontSize: 15, color: C.textMuted },
                current === p.value && { color: C.teal, fontWeight: '700' },
              ]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── IncomeRow ────────────────────────────────────────────────────────────────

const IncomeRow = React.memo(({ label, item, onChangeMonto, onOpenPeriod }) => {
  const { colors: C } = useTheme();
  const monthly = toMonthly(item.monto, item.periodicidad);
  const annual = toAnnual(item.monto, item.periodicidad);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 14, color: C.text, flex: 1 }}>{label}</Text>
        <TouchableOpacity
          style={{ backgroundColor: C.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
          onPress={onOpenPeriod}
        >
          <Text style={{ fontSize: 12, color: C.purple, fontWeight: '600' }}>
            {PERIODICIDADES.find(p => p.value === item.periodicidad)?.label || 'Mensual'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          style={{
            flex: 1,
            backgroundColor: C.inputBg,
            color: C.text,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 7,
            fontSize: 14,
            borderWidth: 1,
            borderColor: C.border,
            marginRight: 8,
          }}
          value={item.monto}
          onChangeText={onChangeMonto}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={C.textMuted}
        />
        <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
          <Text style={{ fontSize: 11, color: C.textMuted }}>M: <Text style={{ color: C.teal }}>{formatCOP(monthly)}</Text></Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>A: <Text style={{ color: C.teal }}>{formatCOP(annual)}</Text></Text>
        </View>
      </View>
    </View>
  );
});

// ─── ExpenseRow ───────────────────────────────────────────────────────────────

const ExpenseRow = React.memo(({ label, item, onChangeMonto, onOpenPeriod, onToggleEsencial }) => {
  const { colors: C } = useTheme();
  const monthly = toMonthly(item.monto, item.periodicidad);
  const annual = toAnnual(item.monto, item.periodicidad);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 14, color: C.text, flex: 1 }}>{label}</Text>
        <TouchableOpacity
          style={[
            { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
            item.esencial
              ? { backgroundColor: C.teal + '30' }
              : { backgroundColor: C.pink + '30' },
          ]}
          onPress={onToggleEsencial}
        >
          <Text style={[
            { fontSize: 12, fontWeight: '700' },
            item.esencial ? { color: C.teal } : { color: C.pink },
          ]}>
            {item.esencial ? 'E' : 'NE'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          style={{ backgroundColor: C.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
          onPress={onOpenPeriod}
        >
          <Text style={{ fontSize: 12, color: C.purple, fontWeight: '600' }}>
            {PERIODICIDADES.find(p => p.value === item.periodicidad)?.label || 'Mensual'}
          </Text>
        </TouchableOpacity>
        <TextInput
          style={{
            flex: 1,
            backgroundColor: C.inputBg,
            color: C.text,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 7,
            fontSize: 14,
            borderWidth: 1,
            borderColor: C.border,
            marginHorizontal: 8,
          }}
          value={item.monto}
          onChangeText={onChangeMonto}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={C.textMuted}
        />
        <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
          <Text style={{ fontSize: 11, color: C.textMuted }}>M: <Text style={{ color: C.pink }}>{formatCOP(monthly)}</Text></Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>A: <Text style={{ color: C.pink }}>{formatCOP(annual)}</Text></Text>
        </View>
      </View>
    </View>
  );
});

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ icon, label, total, expanded, onPress }) {
  const { colors: C } = useTheme();
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.card,
        borderRadius: 10,
        padding: 14,
        marginBottom: 2,
        borderWidth: 1,
        borderColor: C.border,
      }}
      onPress={onPress}
    >
      <Text style={{ fontSize: 18, marginRight: 10 }}>{icon}</Text>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: C.text }}>{label}</Text>
      <Text style={{ fontSize: 13, color: C.pink, marginRight: 10 }}>{formatCOP(total)}/mes</Text>
      <Text style={{ fontSize: 12, color: C.textMuted }}>{expanded ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PresupuestoScreen() {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState({ ingresos: true });
  const [periodModal, setPeriodModal] = useState({ visible: false, current: 'mensual', onSelect: () => {} });
  const saveTimer = useRef(null);
  const { colors: C } = useTheme();

  useFocusEffect(
    useCallback(() => {
      loadData().then(d => setData(d));
    }, [])
  );

  const s = useMemo(() => makeStyles(C), [C]);

  const debouncedSave = useCallback((newData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveData(newData), 600);
  }, []);

  const openPeriodModal = useCallback((current, onSelect) => {
    setPeriodModal({ visible: true, current, onSelect });
  }, []);

  const closePeriodModal = useCallback(() => {
    setPeriodModal(p => ({ ...p, visible: false }));
  }, []);

  const toggleSection = useCallback((key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const updateIngreso = useCallback((key, field, value) => {
    setData(prev => {
      const next = {
        ...prev,
        ingresos: { ...prev.ingresos, [key]: { ...prev.ingresos[key], [field]: value } },
      };
      debouncedSave(next);
      return next;
    });
  }, [debouncedSave]);

  const updateGasto = useCallback((catKey, itemKey, field, value) => {
    setData(prev => {
      const next = {
        ...prev,
        gastos: {
          ...prev.gastos,
          [catKey]: {
            ...prev.gastos[catKey],
            [itemKey]: { ...prev.gastos[catKey][itemKey], [field]: value },
          },
        },
      };
      debouncedSave(next);
      return next;
    });
  }, [debouncedSave]);

  const updateAhorro = useCallback((field, value) => {
    setData(prev => {
      const next = { ...prev, ahorro: { ...prev.ahorro, [field]: value } };
      debouncedSave(next);
      return next;
    });
  }, [debouncedSave]);

  if (!data) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.textMuted }}>Cargando...</Text>
      </View>
    );
  }

  const ingresosTotal = INCOME_ITEMS.reduce((sum, { key }) =>
    sum + toMonthly(data.ingresos[key].monto, data.ingresos[key].periodicidad), 0);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Presupuesto</Text>

      {/* ── Ingresos ── */}
      <View style={s.section}>
        <SectionHeader
          icon="💰"
          label="Ingresos"
          total={ingresosTotal}
          expanded={!!expanded.ingresos}
          onPress={() => toggleSection('ingresos')}
        />
        {expanded.ingresos && (
          <View style={s.sectionBody}>
            {INCOME_ITEMS.map(({ key, label }) => (
              <IncomeRow
                key={key}
                label={label}
                item={data.ingresos[key]}
                onChangeMonto={v => updateIngreso(key, 'monto', v.replace(/[^0-9]/g, ''))}
                onOpenPeriod={() => openPeriodModal(
                  data.ingresos[key].periodicidad,
                  v => updateIngreso(key, 'periodicidad', v)
                )}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── Gastos por categoría ── */}
      {EXPENSE_CATEGORIES.map(cat => {
        const catTotal = cat.items.reduce((sum, { key }) => {
          const item = data.gastos[cat.key]?.[key];
          return sum + (item ? toMonthly(item.monto, item.periodicidad) : 0);
        }, 0);
        return (
          <View key={cat.key} style={s.section}>
            <SectionHeader
              icon={cat.icon}
              label={cat.label}
              total={catTotal}
              expanded={!!expanded[cat.key]}
              onPress={() => toggleSection(cat.key)}
            />
            {expanded[cat.key] && (
              <View style={s.sectionBody}>
                {cat.items.map(({ key, label }) => {
                  const item = data.gastos[cat.key]?.[key];
                  if (!item) return null;
                  return (
                    <ExpenseRow
                      key={key}
                      label={label}
                      item={item}
                      onChangeMonto={v => updateGasto(cat.key, key, 'monto', v.replace(/[^0-9]/g, ''))}
                      onOpenPeriod={() => openPeriodModal(
                        item.periodicidad,
                        v => updateGasto(cat.key, key, 'periodicidad', v)
                      )}
                      onToggleEsencial={() => updateGasto(cat.key, key, 'esencial', !item.esencial)}
                    />
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {/* ── Ahorro ── */}
      <View style={s.section}>
        <SectionHeader
          icon="🐷"
          label="Ahorro"
          total={toMonthly(data.ahorro.monto, data.ahorro.periodicidad)}
          expanded={!!expanded.ahorro}
          onPress={() => toggleSection('ahorro')}
        />
        {expanded.ahorro && (
          <View style={s.sectionBody}>
            <IncomeRow
              label="Ahorro deseado"
              item={data.ahorro}
              onChangeMonto={v => updateAhorro('monto', v.replace(/[^0-9]/g, ''))}
              onOpenPeriod={() => openPeriodModal(
                data.ahorro.periodicidad,
                v => updateAhorro('periodicidad', v)
              )}
            />
          </View>
        )}
      </View>

      <Text style={s.autoSaveNote}>Los cambios se guardan automáticamente</Text>

      <PeriodicidadModal
        visible={periodModal.visible}
        current={periodModal.current}
        onSelect={periodModal.onSelect}
        onClose={closePeriodModal}
      />
    </ScrollView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingTop: 52, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: 'bold', color: C.text, marginBottom: 20 },
    section: { marginBottom: 10 },
    sectionBody: {
      backgroundColor: C.card,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingBottom: 4,
      borderWidth: 1,
      borderColor: C.border,
      borderTopWidth: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
    },
    autoSaveNote: { textAlign: 'center', color: C.textMuted, fontSize: 12, marginTop: 8 },
  });
}
