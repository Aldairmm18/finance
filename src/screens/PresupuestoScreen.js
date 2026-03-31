import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Modal, LayoutAnimation, UIManager, Platform, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadDataMes, saveDataMes, getCurrentMes, computeRollover } from '../utils/storage';
import { PERIODICIDADES, formatCOP, toMonthly, toAnnual, parseAmount } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { mesLabel, addMes } from '../utils/dateUtils';
import { getCategoryColor } from '../utils/categoryTheme';
import { subcategoryService } from '../services/subcategoryService';
import SubcategoryModal from '../components/SubcategoryModal';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Metadata ────────────────────────────────────────────────────────────────

const INCOME_ITEMS = [
  { key: 'salario', label: 'Salario' },
  { key: 'bonos', label: 'Bonos' },
  { key: 'dividendos', label: 'Dividendos' },
  { key: 'comisiones', label: 'Comisiones' },
  { key: 'hogar', label: 'Hogar' },
  { key: 'comida', label: 'Comida' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'creditos', label: 'Créditos' },
  { key: 'entretenimiento', label: 'Entretenimiento' },
  { key: 'familia', label: 'Familia' },
  { key: 'ahorro', label: 'Ahorro' },
  { key: 'otros', label: 'Otros' },
];

const EXPENSE_CATEGORIES = [
  {
    key: 'hogar', label: 'Hogar', iconName: 'home',
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
    key: 'comida', label: 'Comida', iconName: 'fast-food',
    items: [
      { key: 'mercado', label: 'Mercado' },
      { key: 'comidasFuera', label: 'Comidas por fuera' },
      { key: 'otro', label: 'Otro' },
    ],
  },
  {
    key: 'transporte', label: 'Transporte', iconName: 'bus',
    items: [
      { key: 'gasolina', label: 'Gasolina' },
      { key: 'taxiUber', label: 'Taxi / Uber' },
      { key: 'transportePublico', label: 'Transporte público' },
      { key: 'metro', label: 'Metro' },
      { key: 'mantenimientoAuto', label: 'Mantenimiento auto' },
      { key: 'seguroAuto', label: 'Seguro auto' },
      { key: 'otro', label: 'Otro' },
    ],
  },
  {
    key: 'creditos', label: 'Créditos / Deudas', iconName: 'card',
    items: [
      { key: 'creditoHipotecario', label: 'Crédito Hipotecario' },
      { key: 'creditoAuto', label: 'Crédito Auto' },
      { key: 'tarjetaCredito', label: 'Tarjeta de Crédito' },
      { key: 'otro', label: 'Otro' },
    ],
  },
  {
    key: 'entretenimiento', label: 'Entretenimiento', iconName: 'game-controller',
    items: [
      { key: 'viajes', label: 'Viajes' },
      { key: 'restaurantes', label: 'Restaurantes' },
      { key: 'diversion', label: 'Diversión' },
      { key: 'fiesta', label: 'Fiesta' },
      { key: 'appleMusic', label: 'Apple Music' },
      { key: 'ia', label: 'IA / ChatGPT' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    key: 'familia', label: 'Familia', iconName: 'people',
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
  // ── MEJORA 3: Nueva categoría Salud ──────────────────────────────────────────
  {
    key: 'salud', label: 'Salud', iconName: 'heart',
    items: [
      { key: 'medicamentos', label: 'Medicamentos' },
      { key: 'consultas', label: 'Consultas médicas' },
      { key: 'examenes', label: 'Exámenes / Labs' },
      { key: 'optica', label: 'Óptica' },
      { key: 'otro', label: 'Otro' },
    ],
  },
];

// ─── PeriodicidadModal ────────────────────────────────────────────────────────

function PeriodicidadModal({ visible, current, onSelect, onClose }) {
  const { colors: C } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 8, width: 260, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center', paddingVertical: 14, paddingHorizontal: 16 }}>
            Periodicidad
          </Text>
          {PERIODICIDADES.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[
                { paddingVertical: 13, paddingHorizontal: 20, borderRadius: 10, marginHorizontal: 8, marginBottom: 4 },
                current === p.value && { backgroundColor: C.teal + '20' },
              ]}
              onPress={() => { onSelect(p.value); onClose(); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[
                  { fontSize: 15, color: C.textMuted },
                  current === p.value && { color: C.teal, fontWeight: '700' },
                ]}>
                  {p.label}
                </Text>
                {current === p.value && (
                  <Text style={{ color: C.teal, fontSize: 16 }}>✓</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 8 }} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── MonthYearPickerModal ─────────────────────────────────────────────────────

const MONTH_NAMES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function MonthYearPickerModal({ visible, currentMes, onSelect, onClose }) {
  const { colors: C } = useTheme();
  const [y, m] = currentMes.split('-').map(Number);
  const [pickerYear, setPickerYear] = React.useState(y);

  React.useEffect(() => {
    if (visible) {
      const [yr] = currentMes.split('-').map(Number);
      setPickerYear(yr);
    }
  }, [visible, currentMes]);

  const handleSelect = (monthIdx) => {
    const selected = `${pickerYear}-${String(monthIdx + 1).padStart(2, '0')}`;
    onSelect(selected);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 20, width: 300, borderWidth: 1, borderColor: C.border }}>
          {/* Year navigator */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={{ padding: 8 }}>
              <Text style={{ fontSize: 18, color: C.textMuted }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>{pickerYear}</Text>
            <TouchableOpacity onPress={() => setPickerYear(y => y + 1)} style={{ padding: 8 }}>
              <Text style={{ fontSize: 18, color: C.textMuted }}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Month grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MONTH_NAMES_SHORT.map((name, idx) => {
              const isSelected = pickerYear === y && idx === m - 1;
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleSelect(idx)}
                  style={{
                    width: '30%',
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    backgroundColor: isSelected ? C.teal : C.bg,
                    borderWidth: 1,
                    borderColor: isSelected ? C.teal : C.border,
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: isSelected ? '#fff' : C.text,
                  }}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Today button */}
          <TouchableOpacity
            onPress={() => { onSelect(getCurrentMes()); onClose(); }}
            style={{ marginTop: 14, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: C.purple + '20', borderWidth: 1, borderColor: C.purple + '40' }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.purple }}>Mes actual</Text>
          </TouchableOpacity>
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
  const formatted = item.monto ? formatCOP(parseAmount(item.monto)) : null;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 14, color: C.text, flex: 1, fontWeight: '500' }}>{label}</Text>
        <TouchableOpacity
          style={{ backgroundColor: C.teal + '18', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.teal + '40' }}
          onPress={onOpenPeriod}
        >
          <Text style={{ fontSize: 11, color: C.teal, fontWeight: '700', letterSpacing: 0.3 }}>
            {PERIODICIDADES.find(p => p.value === item.periodicidad)?.label || 'Mensual'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <TextInput
            style={{
              backgroundColor: C.inputBg,
              color: C.text,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 9,
              fontSize: 15,
              borderWidth: 1,
              borderColor: C.border,
              fontWeight: '600',
            }}
            value={item.monto}
            onChangeText={onChangeMonto}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={C.textMuted}
          />
          {formatted && (
            <Text style={{ fontSize: 11, color: C.teal, marginTop: 4, marginLeft: 2, fontWeight: '600' }}>
              = {formatted}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 12, minWidth: 76 }}>
          <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>
            /mes  <Text style={{ color: C.teal, fontWeight: '700' }}>{formatCOP(monthly)}</Text>
          </Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            /año  <Text style={{ color: C.teal, fontWeight: '700' }}>{formatCOP(annual)}</Text>
          </Text>
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
  const formatted = item.monto ? formatCOP(parseAmount(item.monto)) : null;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 14, color: C.text, flex: 1, fontWeight: '500' }}>{label}</Text>
        <TouchableOpacity
          style={[
            { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginLeft: 8, borderWidth: 1 },
            item.esencial
              ? { backgroundColor: C.teal + '18', borderColor: C.teal + '50' }
              : { backgroundColor: C.pink + '18', borderColor: C.pink + '50' },
          ]}
          onPress={onToggleEsencial}
        >
          <Text style={[
            { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
            item.esencial ? { color: C.teal } : { color: C.pink },
          ]}>
            {item.esencial ? 'Esencial' : 'No Esencial'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <TouchableOpacity
          style={{ backgroundColor: C.purple + '18', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.purple + '40', marginRight: 8, marginTop: 0 }}
          onPress={onOpenPeriod}
        >
          <Text style={{ fontSize: 11, color: C.purple, fontWeight: '700', letterSpacing: 0.3 }}>
            {PERIODICIDADES.find(p => p.value === item.periodicidad)?.label || 'Mensual'}
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TextInput
            style={{
              backgroundColor: C.inputBg,
              color: C.text,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 9,
              fontSize: 15,
              borderWidth: 1,
              borderColor: C.border,
              fontWeight: '600',
            }}
            value={item.monto}
            onChangeText={onChangeMonto}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={C.textMuted}
          />
          {formatted && (
            <Text style={{ fontSize: 11, color: C.pink, marginTop: 4, marginLeft: 2, fontWeight: '600' }}>
              = {formatted}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 10, minWidth: 76 }}>
          <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>
            /mes  <Text style={{ color: C.pink, fontWeight: '700' }}>{formatCOP(monthly)}</Text>
          </Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            /año  <Text style={{ color: C.pink, fontWeight: '700' }}>{formatCOP(annual)}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
});

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ iconName, iconColor, label, total, expanded, onPress, onAddSubcat, subcatCount }) {
  const { colors: C } = useTheme();
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.card,
        borderRadius: 12,
        borderBottomLeftRadius: expanded ? 0 : 12,
        borderBottomRightRadius: expanded ? 0 : 12,
        paddingHorizontal: 16,
        paddingVertical: 15,
        marginBottom: 0,
        borderWidth: 1,
        borderColor: C.border,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={iconName} size={18} color={iconColor || C.textMuted} style={{ marginRight: 12 }} />
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: C.text, letterSpacing: -0.2 }}>{label}</Text>

      {/* Badge de subcategorías personalizadas */}
      {subcatCount > 0 && (
        <View style={{ backgroundColor: C.teal + '22', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 }}>
          <Text style={{ fontSize: 10, color: C.teal, fontWeight: '700' }}>{subcatCount}</Text>
        </View>
      )}

      {/* Botón agregar subcategoría */}
      {onAddSubcat && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onAddSubcat(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ paddingHorizontal: 6 }}
        >
          <Ionicons name="add-circle-outline" size={18} color={C.teal} />
        </TouchableOpacity>
      )}

      <Text style={{ fontSize: 13, fontWeight: '700', color: total > 0 ? C.pink : C.textMuted, marginRight: 12 }}>
        {formatCOP(total)}<Text style={{ fontSize: 10, fontWeight: '400', color: C.textMuted }}>/mes</Text>
      </Text>
      <View style={{
        width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 10, color: C.textMuted, lineHeight: 14 }}>{expanded ? '▲' : '▼'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function PresupuestoScreen() {
  const [mes, setMes] = useState(getCurrentMes);
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState({ ingresos: true });
  const [periodModal, setPeriodModal] = useState({ visible: false, current: 'mensual', onSelect: () => {} });
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [rollover, setRollover] = useState({ surplus: 0, prevMes: '' });
  const [rolloverDismissed, setRolloverDismissed] = useState(false);
  // ── Subcategorías ──
  const [subcategories, setSubcategories] = useState({});
  const [subcatModalVisible, setSubcatModalVisible] = useState(false);
  const [editingSubcat, setEditingSubcat] = useState(null);
  const [activeCatKey, setActiveCatKey] = useState(null);
  const saveTimer = useRef(null);
  const { colors: C } = useTheme();
  const { user } = useAuth();

  const currentMes = getCurrentMes();
  const isFuture = mes > currentMes;

  useFocusEffect(useCallback(() => {
    let isMounted = true;
    setData(null);
    setRolloverDismissed(false);

    loadDataMes(mes).then(d => {
      if (!isMounted) return;
      setData(d);
      if (d?.rolloverAplicado?.[mes]) setRollover({ surplus: 0, prevMes: '' });
    });

    computeRollover(mes).then(r => {
      if (isMounted) setRollover(r);
    }).catch(() => {});

    if (user) {
      subcategoryService.getAll(user.id).then(subs => {
        if (!isMounted) return;
        const grouped = subs.reduce((acc, s) => {
          if (!acc[s.category_key]) acc[s.category_key] = [];
          acc[s.category_key].push(s);
          return acc;
        }, {});
        setSubcategories(grouped);
      }).catch(() => {});
    }

    return () => { isMounted = false; };
  }, [mes, user]));

  const s = useMemo(() => makeStyles(C), [C]);

  const debouncedSave = useCallback((newData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDataMes(mes, newData), 600);
  }, [mes]);

  const openPeriodModal = useCallback((current, onSelect) => {
    setPeriodModal({ visible: true, current, onSelect });
  }, []);

  const closePeriodModal = useCallback(() => {
    setPeriodModal(p => ({ ...p, visible: false }));
  }, []);

  const toggleSection = useCallback((key) => {
    LayoutAnimation.configureNext({
      duration: 280,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const updateIngreso = useCallback((key, field, value) => {
    setData(prev => {
      const next = { ...prev, ingresos: { ...prev.ingresos, [key]: { ...prev.ingresos[key], [field]: value } } };
      debouncedSave(next);
      return next;
    });
  }, [debouncedSave]);

  const updateGasto = useCallback((catKey, itemKey, field, value) => {
    setData(prev => {
      const next = {
        ...prev,
        gastos: { ...prev.gastos, [catKey]: { ...prev.gastos[catKey], [itemKey]: { ...prev.gastos[catKey]?.[itemKey], [field]: value } } },
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
        <Text style={{ color: C.textMuted, fontSize: 14 }}>Cargando...</Text>
      </View>
    );
  }

  const ingresosTotal = INCOME_ITEMS.reduce((sum, { key }) =>
    sum + toMonthly(data.ingresos[key]?.monto, data.ingresos[key]?.periodicidad), 0);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Presupuesto</Text>

      {/* ── Rollover banner ── */}
      {rollover.surplus > 0 && !rolloverDismissed && !data?.rolloverAplicado?.[mes] && (
        <View style={{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.teal + '60', padding: 14, marginBottom: 16, overflow: 'hidden' }}>
          <View style={{ height: 3, backgroundColor: C.teal, position: 'absolute', top: 0, left: 0, right: 0 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="cash" size={16} color={C.teal} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>Sobrante del mes anterior</Text>
              <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Tienes {formatCOP(rollover.surplus)} disponibles de {rollover.prevMes}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                setData(prev => {
                  const currentAhorro = parseAmount(prev.ingresos.ahorro?.monto || '0');
                  const newAhorro = currentAhorro + rollover.surplus;
                  const next = {
                    ...prev,
                    ingresos: {
                      ...prev.ingresos,
                      ahorro: { ...prev.ingresos.ahorro, monto: String(newAhorro) },
                    },
                    rolloverAplicado: { ...(prev.rolloverAplicado || {}), [mes]: rollover.surplus },
                  };
                  saveDataMes(mes, next);
                  return next;
                });
                setRollover({ surplus: 0, prevMes: '' });
              }}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: C.teal }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>Aplicar como ahorro</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRolloverDismissed(true)}
              style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', backgroundColor: C.bg, borderWidth: 1, borderColor: C.border }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.textMuted }}>Ignorar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Already applied rollover info ── */}
      {data?.rolloverAplicado?.[mes] > 0 && (
        <View style={{ backgroundColor: C.teal + '12', borderRadius: 10, borderWidth: 1, borderColor: C.teal + '30', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 }}>
          <Text style={{ fontSize: 12, color: C.teal, fontWeight: '600' }}>
            ✓ Traspaso de {formatCOP(data.rolloverAplicado[mes])} aplicado como ahorro
          </Text>
        </View>
      )}

      {/* ── Navegador de mes ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 10, paddingHorizontal: 6 }}>
        <TouchableOpacity onPress={() => setMes(m => addMes(m, -1))} style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ fontSize: 18, color: C.textMuted }}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMonthPickerVisible(true)} style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{mesLabel(mes)} ▾</Text>
          {mes === currentMes && (
            <View style={{ backgroundColor: C.teal + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 }}>
              <Text style={{ fontSize: 10, color: C.teal, fontWeight: '700', letterSpacing: 0.8 }}>MES ACTUAL</Text>
            </View>
          )}
          {mes < currentMes && (
            <View style={{ backgroundColor: C.textMuted + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 }}>
              <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 0.8 }}>MES PASADO</Text>
            </View>
          )}
          {isFuture && (
            <View style={{ backgroundColor: C.purple + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 }}>
              <Text style={{ fontSize: 10, color: C.purple, fontWeight: '700', letterSpacing: 0.8 }}>MES FUTURO</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMes(m => addMes(m, 1))} style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ fontSize: 18, color: C.textMuted }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Ingresos ── */}
      <View style={s.section}>
        <SectionHeader iconName="cash" iconColor={C.teal} label="Ingresos" total={ingresosTotal} expanded={!!expanded.ingresos} onPress={() => toggleSection('ingresos')} />
        {expanded.ingresos && (
          <View style={s.sectionBody}>
            {INCOME_ITEMS.map(({ key, label }) => (
              <IncomeRow
                key={key}
                label={label}
                item={data.ingresos[key] ?? { monto: '', periodicidad: 'mensual' }}
                onChangeMonto={v => updateIngreso(key, 'monto', v.replace(/[^0-9]/g, ''))}
                onOpenPeriod={() => openPeriodModal(data.ingresos[key]?.periodicidad ?? 'mensual', v => updateIngreso(key, 'periodicidad', v))}
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
        const catSubs = subcategories[cat.key] || [];
        const catColor = getCategoryColor(cat.key);
        return (
          <View key={cat.key} style={s.section}>
            <SectionHeader
              iconName={cat.iconName}
              iconColor={catColor}
              label={cat.label}
              total={catTotal}
              expanded={!!expanded[cat.key]}
              onPress={() => toggleSection(cat.key)}
              subcatCount={catSubs.length}
              onAddSubcat={() => {
                setActiveCatKey(cat.key);
                setEditingSubcat(null);
                setSubcatModalVisible(true);
              }}
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
                      onOpenPeriod={() => openPeriodModal(item.periodicidad, v => updateGasto(cat.key, key, 'periodicidad', v))}
                      onToggleEsencial={() => updateGasto(cat.key, key, 'esencial', !item.esencial)}
                    />
                  );
                })}

                {/* ── Subcategorías personalizadas ── */}
                {catSubs.length > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, marginTop: 4 }}>
                    <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                      Personalizadas
                    </Text>
                    {catSubs.map(sub => (
                      <TouchableOpacity
                        key={sub.id}
                        onLongPress={() => {
                          Alert.alert(sub.name, '¿Qué deseas hacer?', [
                            {
                              text: 'Editar',
                              onPress: () => {
                                setActiveCatKey(cat.key);
                                setEditingSubcat(sub);
                                setSubcatModalVisible(true);
                              },
                            },
                            {
                              text: 'Eliminar',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await subcategoryService.delete(sub.id);
                                  setSubcategories(prev => ({
                                    ...prev,
                                    [cat.key]: (prev[cat.key] || []).filter(s => s.id !== sub.id),
                                  }));
                                } catch (e) {
                                  Alert.alert('Error', e?.message || 'No se pudo eliminar');
                                }
                              },
                            },
                            { text: 'Cancelar', style: 'cancel' },
                          ]);
                        }}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}
                      >
                        <MaterialCommunityIcons name={sub.icon} size={16} color={sub.color} style={{ marginRight: 10 }} />
                        <Text style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: '500' }}>{sub.name}</Text>
                        {sub.duration_months ? (
                          <Text style={{ fontSize: 11, color: C.textMuted }}>
                            {sub.duration_months} mes{sub.duration_months > 1 ? 'es' : ''}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* ── Ahorro ── */}
      <View style={s.section}>
        <SectionHeader iconName="wallet" iconColor={C.purple} label="Ahorro" total={toMonthly(data.ahorro.monto, data.ahorro.periodicidad)} expanded={!!expanded.ahorro} onPress={() => toggleSection('ahorro')} />
        {expanded.ahorro && (
          <View style={s.sectionBody}>
            <IncomeRow
              label="Ahorro deseado"
              item={data.ahorro}
              onChangeMonto={v => updateAhorro('monto', v.replace(/[^0-9]/g, ''))}
              onOpenPeriod={() => openPeriodModal(data.ahorro.periodicidad, v => updateAhorro('periodicidad', v))}
            />
          </View>
        )}
      </View>

      <Text style={s.autoSaveNote}>Los cambios de {mesLabel(mes)} se guardan automáticamente</Text>

      <PeriodicidadModal
        visible={periodModal.visible}
        current={periodModal.current}
        onSelect={periodModal.onSelect}
        onClose={closePeriodModal}
      />

      <MonthYearPickerModal
        visible={monthPickerVisible}
        currentMes={mes}
        onSelect={setMes}
        onClose={() => setMonthPickerVisible(false)}
      />

      <SubcategoryModal
        visible={subcatModalVisible}
        onClose={() => { setSubcatModalVisible(false); setEditingSubcat(null); }}
        categoryKey={activeCatKey}
        editData={editingSubcat}
        onSave={async (payload) => {
          try {
            if (editingSubcat) {
              const updated = await subcategoryService.update(editingSubcat.id, payload);
              setSubcategories(prev => ({
                ...prev,
                [activeCatKey]: (prev[activeCatKey] || []).map(s =>
                  s.id === editingSubcat.id ? updated : s
                ),
              }));
            } else {
              const created = await subcategoryService.create(user.id, {
                ...payload,
                category_key: activeCatKey,
              });
              setSubcategories(prev => ({
                ...prev,
                [activeCatKey]: [...(prev[activeCatKey] || []), created],
              }));
            }
            setSubcatModalVisible(false);
            setEditingSubcat(null);
          } catch (e) {
            Alert.alert('Error', e?.message || 'No se pudo guardar la subcategoría');
          }
        }}
      />
    </ScrollView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingTop: 52, paddingBottom: 48 },
    title: { fontSize: 32, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginBottom: 24 },
    section: { marginBottom: 12 },
    sectionBody: {
      backgroundColor: C.card,
      borderRadius: 12,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      paddingHorizontal: 16,
      paddingBottom: 4,
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: C.border,
    },
    autoSaveNote: { textAlign: 'center', color: C.textMuted, fontSize: 11, marginTop: 12, letterSpacing: 0.3 },
  });
}
