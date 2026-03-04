import React, { useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadData, saveData } from '../utils/storage';
import { COLORS, formatCOP, computeTotals, parseAmount } from '../utils/calculations';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function FlujoMensualScreen() {
  const [totals, setTotals] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [fullData, setFullData] = useState(null);
  const saveTimer = useRef(null);

  useFocusEffect(
    useCallback(() => {
      loadData().then(d => {
        setFullData(d);
        setTotals(computeTotals(d));
        setOverrides(d.flujoMensual || {});
      });
    }, [])
  );

  const debouncedSave = useCallback((newOverrides) => {
    if (!fullData) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveData({ ...fullData, flujoMensual: newOverrides });
    }, 600);
  }, [fullData]);

  const handleChange = useCallback((monthIdx, field, value) => {
    setOverrides(prev => {
      const monthKey = String(monthIdx);
      const updated = {
        ...prev,
        [monthKey]: { ...(prev[monthKey] || {}), [field]: value.replace(/[^0-9]/g, '') },
      };
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const resetMonth = useCallback((monthIdx) => {
    setOverrides(prev => {
      const updated = { ...prev };
      delete updated[String(monthIdx)];
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const budgetIngresos = totals ? Math.round(totals.ingresosMonthly) : 0;
  const budgetGastos = totals ? Math.round(totals.totalGastosMonthly) : 0;

  const getMonthValues = (idx) => {
    const override = overrides[String(idx)];
    const ingresos = override?.ingresos !== undefined ? override.ingresos : String(budgetIngresos);
    const gastos = override?.gastos !== undefined ? override.gastos : String(budgetGastos);
    const flujo = parseAmount(ingresos) - parseAmount(gastos);
    const hasOverride = !!override;
    return { ingresos, gastos, flujo, hasOverride };
  };

  const annualFlujo = MONTHS.reduce((sum, _, idx) => {
    const { flujo } = getMonthValues(idx);
    return sum + flujo;
  }, 0);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Flujo de Caja Mensual</Text>

      <View style={s.summaryCard}>
        <Text style={s.summaryLabel}>Flujo Anual Total</Text>
        <Text style={[s.summaryValue, { color: annualFlujo >= 0 ? COLORS.teal : COLORS.pink }]}>
          {formatCOP(annualFlujo)}
        </Text>
        <Text style={s.summaryHint}>
          Presupuesto base — Ingresos: {formatCOP(budgetIngresos)}/mes · Gastos: {formatCOP(budgetGastos)}/mes
        </Text>
      </View>

      <View style={s.headerRow}>
        <Text style={[s.colHeader, { flex: 1.2 }]}>Mes</Text>
        <Text style={[s.colHeader, { flex: 1.5 }]}>Ingresos</Text>
        <Text style={[s.colHeader, { flex: 1.5 }]}>Gastos</Text>
        <Text style={[s.colHeader, { flex: 1.4, textAlign: 'right' }]}>Flujo</Text>
      </View>

      {MONTHS.map((month, idx) => {
        const { ingresos, gastos, flujo, hasOverride } = getMonthValues(idx);
        const flujoColor = flujo >= 0 ? COLORS.teal : COLORS.pink;
        return (
          <View key={idx} style={[s.monthRow, hasOverride && s.monthRowOverride]}>
            <View style={{ flex: 1.2 }}>
              <Text style={s.monthName}>{month}</Text>
              {hasOverride && (
                <TouchableOpacity onPress={() => resetMonth(idx)}>
                  <Text style={s.resetBtn}>↺ reset</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[s.input, { flex: 1.5 }]}
              value={ingresos}
              onChangeText={v => handleChange(idx, 'ingresos', v)}
              keyboardType="numeric"
              placeholder={String(budgetIngresos)}
              placeholderTextColor={COLORS.textMuted}
            />
            <TextInput
              style={[s.input, { flex: 1.5, marginHorizontal: 6 }]}
              value={gastos}
              onChangeText={v => handleChange(idx, 'gastos', v)}
              keyboardType="numeric"
              placeholder={String(budgetGastos)}
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={[s.flujoValue, { flex: 1.4, color: flujoColor }]}>
              {formatCOP(flujo)}
            </Text>
          </View>
        );
      })}

      <Text style={s.hint}>Toca un campo para editar el mes. Los cambios se guardan automáticamente.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingTop: 52, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 20 },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  summaryLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  summaryValue: { fontSize: 26, fontWeight: 'bold', marginBottom: 6 },
  summaryHint: { fontSize: 11, color: COLORS.textMuted },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.border,
    borderRadius: 8,
    marginBottom: 4,
  },
  colHeader: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthRowOverride: { borderColor: COLORS.purple + '80' },
  monthName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  resetBtn: { fontSize: 10, color: COLORS.purple, marginTop: 2 },
  input: {
    backgroundColor: '#1a1a2e',
    color: COLORS.text,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  flujoValue: { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  hint: { textAlign: 'center', color: COLORS.textMuted, fontSize: 11, marginTop: 12 },
});
