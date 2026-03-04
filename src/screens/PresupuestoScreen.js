import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Modal, Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadData, saveData } from '../utils/storage';
import { COLORS, PERIODICIDADES, formatCOP, toMonthly, toAnnual } from '../utils/calculations';

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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={onClose}>
        <View style={ms.box}>
          <Text style={ms.title}>Periodicidad</Text>
          {PERIODICIDADES.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[ms.option, current === p.value && ms.optionActive]}
              onPress={() => { onSelect(p.value); onClose(); }}
            >
              <Text style={[ms.optionText, current === p.value && ms.optionTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  box: { backgroundColor: COLORS.card, borderRadius: 14, padding: 20, width: 240, borderWidth: 1, borderColor: COLORS.border },
  title: { color: COLORS.text, fontWeight: '700', fontSize: 16, marginBottom: 12, textAlign: 'center' },
  option: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 4 },
  optionActive: { backgroundColor: COLORS.teal + '30' },
  optionText: { color: COLORS.textMuted, fontSize: 15 },
  optionTextActive: { color: COLORS.teal, fontWeight: '700' },
});

// ─── IncomeRow ────────────────────────────────────────────────────────────────

const IncomeRow = React.memo(({ label, item, onChangeMonto, onOpenPeriod }) => {
  const monthly = toMonthly(item.monto, item.periodicidad);
  const annual = toAnnual(item.monto, item.periodicidad);
  return (
    <View style={rs.row}>
      <View style={rs.rowTop}>
        <Text style={rs.label}>{label}</Text>
        <TouchableOpacity style={rs.periodBtn} onPress={onOpenPeriod}>
          <Text style={rs.periodText}>{PERIODICIDADES.find(p => p.value === item.periodicidad)?.label || 'Mensual'}</Text>
        </TouchableOpacity>
      </View>
      <View style={rs.rowBottom}>
        <TextInput
          style={rs.input}
          value={item.monto}
          onChangeText={onChangeMonto}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={COLORS.textMuted}
        />
        <View style={rs.calcBox}>
          <Text style={rs.calcText}>M: <Text style={{ color: COLORS.teal }}>{formatCOP(monthly)}</Text></Text>
          <Text style={rs.calcText}>A: <Text style={{ color: COLORS.teal }}>{formatCOP(annual)}</Text></Text>
        </View>
      </View>
    </View>
  );
});

// ─── ExpenseRow ───────────────────────────────────────────────────────────────

const ExpenseRow = React.memo(({ label, item, onChangeMonto, onOpenPeriod, onToggleEsencial }) => {
  const monthly = toMonthly(item.monto, item.periodicidad);
  const annual = toAnnual(item.monto, item.periodicidad);
  return (
    <View style={rs.row}>
      <View style={rs.rowTop}>
        <Text style={rs.label}>{label}</Text>
        <TouchableOpacity
          style={[rs.badge, item.esencial ? rs.badgeE : rs.badgeNE]}
          onPress={onToggleEsencial}
        >
          <Text style={[rs.badgeText, item.esencial ? rs.badgeTextE : rs.badgeTextNE]}>
            {item.esencial ? 'E' : 'NE'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={rs.rowBottom}>
        <TouchableOpacity style={rs.periodBtn} onPress={onOpenPeriod}>
          <Text style={rs.periodText}>{PERIODICIDADES.find(p => p.value === item.periodicidad)?.label || 'Mensual'}</Text>
        </TouchableOpacity>
        <TextInput
          style={[rs.input, { flex: 1, marginHorizontal: 8 }]}
          value={item.monto}
          onChangeText={onChangeMonto}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={COLORS.textMuted}
        />
        <View style={rs.calcBox}>
          <Text style={rs.calcText}>M: <Text style={{ color: COLORS.pink }}>{formatCOP(monthly)}</Text></Text>
          <Text style={rs.calcText}>A: <Text style={{ color: COLORS.pink }}>{formatCOP(annual)}</Text></Text>
        </View>
      </View>
    </View>
  );
});

const rs = StyleSheet.create({
  row: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rowBottom: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 14, color: COLORS.text, flex: 1 },
  periodBtn: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  periodText: { fontSize: 12, color: COLORS.purple, fontWeight: '600' },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    color: COLORS.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  calcBox: { alignItems: 'flex-end', minWidth: 80 },
  calcText: { fontSize: 11, color: COLORS.textMuted },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
  badgeE: { backgroundColor: COLORS.teal + '30' },
  badgeNE: { backgroundColor: COLORS.pink + '30' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextE: { color: COLORS.teal },
  badgeTextNE: { color: COLORS.pink },
});

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ icon, label, total, expanded, onPress }) {
  return (
    <TouchableOpacity style={sh.header} onPress={onPress}>
      <Text style={sh.icon}>{icon}</Text>
      <Text style={sh.label}>{label}</Text>
      <Text style={sh.total}>{formatCOP(total)}/mes</Text>
      <Text style={sh.arrow}>{expanded ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}

const sh = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  icon: { fontSize: 18, marginRight: 10 },
  label: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
  total: { fontSize: 13, color: COLORS.pink, marginRight: 10 },
  arrow: { fontSize: 12, color: COLORS.textMuted },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PresupuestoScreen() {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState({ ingresos: true });
  const [periodModal, setPeriodModal] = useState({ visible: false, current: 'mensual', onSelect: () => {} });
  const saveTimer = useRef(null);

  useFocusEffect(
    useCallback(() => {
      loadData().then(d => setData(d));
    }, [])
  );

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
        <Text style={{ color: COLORS.textMuted }}>Cargando...</Text>
      </View>
    );
  }

  const ingresosTotal = INCOME_ITEMS.reduce((sum, { key }) =>
    sum + toMonthly(data.ingresos[key].monto, data.ingresos[key].periodicidad), 0);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingTop: 52, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 20 },
  section: { marginBottom: 10 },
  sectionBody: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  autoSaveNote: { textAlign: 'center', color: COLORS.textMuted, fontSize: 12, marginTop: 8 },
});
