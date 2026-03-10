import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Modal, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadDataMes, saveDataMes, getCurrentMes } from '../utils/storage';
import { PERIODICIDADES, formatCOP, toMonthly, toAnnual, parseAmount } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Metadata ────────────────────────────────────────────────────────────────

const INCOME_ITEMS = [
  { key: 'salario',    label: 'Salario'    },
  { key: 'bonos',      label: 'Bonos'      },
  { key: 'dividendos', label: 'Dividendos' },
  { key: 'comisiones', label: 'Comisiones' },
  { key: 'otros',      label: 'Otros'      },
];

const EXPENSE_CATEGORIES = [
  {
    key: 'hogar', label: 'Hogar', icon: '🏠',
    items: [
      { key: 'arriendo',      label: 'Arriendo'       },
      { key: 'administracion',label: 'Administración'  },
      { key: 'luz',           label: 'Luz'             },
      { key: 'agua',          label: 'Agua'            },
      { key: 'gas',           label: 'Gas'             },
      { key: 'telefono',      label: 'Teléfono'        },
      { key: 'internet',      label: 'Internet'        },
      { key: 'tv',            label: 'TV'              },
      { key: 'otro',          label: 'Otro'            },
    ],
  },
  {
    key: 'comida', label: 'Comida', icon: '🍽️',
    items: [
      { key: 'mercado',      label: 'Mercado'          },
      { key: 'comidasFuera', label: 'Comidas por fuera'},
      { key: 'otro',         label: 'Otro'             },
    ],
  },
  {
    key: 'transporte', label: 'Transporte', icon: '🚗',
    items: [
      { key: 'gasolina',          label: 'Gasolina'            },
      { key: 'taxiUber',          label: 'Taxi / Uber'         },
      { key: 'transportePublico', label: 'Transporte público'  },
      { key: 'metro',             label: 'Metro'               },
      { key: 'mantenimientoAuto', label: 'Mantenimiento auto'  },
      { key: 'seguroAuto',        label: 'Seguro auto'         },
      { key: 'otro',              label: 'Otro'                },
    ],
  },
  {
    key: 'creditos', label: 'Créditos / Deudas', icon: '💳',
    items: [
      { key: 'creditoHipotecario', label: 'Crédito Hipotecario'},
      { key: 'creditoAuto',        label: 'Crédito Auto'       },
      { key: 'tarjetaCredito',     label: 'Tarjeta de Crédito' },
      { key: 'otro',               label: 'Otro'               },
    ],
  },
  {
    key: 'entretenimiento', label: 'Entretenimiento', icon: '🎉',
    items: [
      { key: 'viajes',      label: 'Viajes'                   },
      { key: 'restaurantes',label: 'Restaurantes'              },
      { key: 'diversion',   label: 'Diversión'                },
      { key: 'fiesta',      label: 'Fiesta'                   },
      { key: 'appleMusic',  label: 'Apple Music'              },
      { key: 'ia',          label: 'IA / ChatGPT'             },
      { key: 'otros',       label: 'Otros'                    },
    ],
  },
  {
    key: 'familia', label: 'Familia', icon: '👨‍👩‍👧',
    items: [
      { key: 'colegios',       label: 'Colegios'        },
      { key: 'seguroMedico',   label: 'Seguro Médico'   },
      { key: 'otrosSeguros',   label: 'Otros Seguros'   },
      { key: 'suscripciones',  label: 'Suscripciones'   },
      { key: 'gimnasio',       label: 'Gimnasio'        },
      { key: 'impuestos',      label: 'Impuestos'       },
      { key: 'entretenimiento',label: 'Entretenimiento' },
      { key: 'otros',          label: 'Otros'           },
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
          {PERIODICIDADES.map((p, i) => (
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

// ─── IncomeRow ────────────────────────────────────────────────────────────────

const IncomeRow = React.memo(({ label, item, onChangeMonto, onOpenPeriod }) => {
  const { colors: C } = useTheme();
  const monthly = toMonthly(item.monto, item.periodicidad);
  const annual  = toAnnual(item.monto, item.periodicidad);
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
  const monthly   = toMonthly(item.monto, item.periodicidad);
  const annual    = toAnnual(item.monto, item.periodicidad);
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

function SectionHeader({ icon, label, total, expanded, onPress }) {
  const { colors: C } = useTheme();
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.card,
        borderRadius: expanded ? 12 : 12,
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
      <Text style={{ fontSize: 20, marginRight: 12 }}>{icon}</Text>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: C.text, letterSpacing: -0.2 }}>{label}</Text>
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

/** Utilidades de navegación de meses */
function mesLabel(mes) {
  const [y, m] = mes.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  const str = d.toLocaleString('es-CO', { month: 'long', year: 'numeric' });
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function addMes(mes, delta) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PresupuestoScreen() {
  const [mes, setMes]           = useState(getCurrentMes);
  const [data, setData]         = useState(null);
  const [expanded, setExpanded] = useState({ ingresos: true });
  const [periodModal, setPeriodModal] = useState({ visible: false, current: 'mensual', onSelect: () => {} });
  const saveTimer = useRef(null);
  const { colors: C } = useTheme();

  const currentMes = getCurrentMes();
  const isFuture   = mes > currentMes;

  useFocusEffect(useCallback(() => {
    setData(null);
    loadDataMes(mes).then(d => setData(d));
  }, [mes]));

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
        gastos: { ...prev.gastos, [catKey]: { ...prev.gastos[catKey], [itemKey]: { ...prev.gastos[catKey][itemKey], [field]: value } } },
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
    sum + toMonthly(data.ingresos[key].monto, data.ingresos[key].periodicidad), 0);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Presupuesto</Text>

      {/* ── Navegador de mes ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 10, paddingHorizontal: 6 }}>
        <TouchableOpacity onPress={() => setMes(m => addMes(m, -1))} style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ fontSize: 18, color: C.textMuted }}>‹</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{mesLabel(mes)}</Text>
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
        </View>
        <TouchableOpacity onPress={() => setMes(m => addMes(m, 1))} style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ fontSize: 18, color: C.textMuted }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Ingresos ── */}
      <View style={s.section}>
        <SectionHeader icon="💰" label="Ingresos" total={ingresosTotal} expanded={!!expanded.ingresos} onPress={() => toggleSection('ingresos')} />
        {expanded.ingresos && (
          <View style={s.sectionBody}>
            {INCOME_ITEMS.map(({ key, label }) => (
              <IncomeRow
                key={key}
                label={label}
                item={data.ingresos[key]}
                onChangeMonto={v => updateIngreso(key, 'monto', v.replace(/[^0-9]/g, ''))}
                onOpenPeriod={() => openPeriodModal(data.ingresos[key].periodicidad, v => updateIngreso(key, 'periodicidad', v))}
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
            <SectionHeader icon={cat.icon} label={cat.label} total={catTotal} expanded={!!expanded[cat.key]} onPress={() => toggleSection(cat.key)} />
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
              </View>
            )}
          </View>
        );
      })}

      {/* ── Ahorro ── */}
      <View style={s.section}>
        <SectionHeader icon="🐷" label="Ahorro" total={toMonthly(data.ahorro.monto, data.ahorro.periodicidad)} expanded={!!expanded.ahorro} onPress={() => toggleSection('ahorro')} />
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
    </ScrollView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: C.bg },
    content:      { padding: 16, paddingTop: 52, paddingBottom: 48 },
    title:        { fontSize: 32, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginBottom: 24 },
    section:      { marginBottom: 12 },
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
