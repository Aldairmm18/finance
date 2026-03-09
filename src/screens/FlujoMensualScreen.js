import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadData, saveData } from '../utils/storage';
import { formatCOP, computeTotals, parseAmount } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function FlujoMensualScreen() {
  const [totals,    setTotals]   = useState(null);
  const [overrides, setOverrides]= useState({});
  const [fullData,  setFullData] = useState(null);
  const saveTimer = useRef(null);
  const { colors: C } = useTheme();

  useFocusEffect(useCallback(() => {
    loadData().then(d => {
      setFullData(d);
      setTotals(computeTotals(d));
      setOverrides(d.flujoMensual || {});
    });
  }, []));

  const s = useMemo(() => makeStyles(C), [C]);

  const debouncedSave = useCallback((newOverrides) => {
    if (!fullData) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveData({ ...fullData, flujoMensual: newOverrides }), 600);
  }, [fullData]);

  const handleChange = useCallback((monthIdx, field, value) => {
    setOverrides(prev => {
      const monthKey = String(monthIdx);
      const updated = { ...prev, [monthKey]: { ...(prev[monthKey] || {}), [field]: value.replace(/[^0-9]/g, '') } };
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
  const budgetGastos   = totals ? Math.round(totals.totalGastosMonthly) : 0;

  const getMonthValues = (idx) => {
    const override = overrides[String(idx)];
    const ingresos  = override?.ingresos !== undefined ? override.ingresos : String(budgetIngresos);
    const gastos    = override?.gastos   !== undefined ? override.gastos   : String(budgetGastos);
    const flujo     = parseAmount(ingresos) - parseAmount(gastos);
    const hasOverride = !!override;
    return { ingresos, gastos, flujo, hasOverride };
  };

  // Para calcular el máximo flujo absoluto (escala relativa de las barras)
  const allFlujos = MONTHS.map((_, idx) => getMonthValues(idx).flujo);
  const maxAbsFlujo = Math.max(...allFlujos.map(Math.abs), 1);

  const annualFlujo = allFlujos.reduce((a, b) => a + b, 0);

  // Meses positivos y negativos para el resumen
  const posCount = allFlujos.filter(f => f > 0).length;
  const negCount = allFlujos.filter(f => f < 0).length;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Flujo Mensual</Text>

      {/* ── Tarjeta resumen ── */}
      <View style={[s.summaryCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[s.summaryAccent, { backgroundColor: annualFlujo >= 0 ? C.teal : C.pink }]} />
        <View style={s.summaryBody}>
          <View style={{ flex: 1 }}>
            <Text style={[s.summaryLabel, { color: C.textMuted }]}>Flujo Anual Total</Text>
            <Text style={[s.summaryValue, { color: annualFlujo >= 0 ? C.teal : C.pink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatCOP(annualFlujo)}
            </Text>
            <Text style={[s.summaryHint, { color: C.textMuted }]}>
              Base: {formatCOP(budgetIngresos)}/mes ingresos · {formatCOP(budgetGastos)}/mes gastos
            </Text>
          </View>
          {/* Indicadores mes + / mes - */}
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={[s.pill, { backgroundColor: C.teal + '20', borderColor: C.teal + '40' }]}>
              <Text style={{ fontSize: 11, color: C.teal, fontWeight: '700' }}>+{posCount} meses</Text>
            </View>
            <View style={[s.pill, { backgroundColor: C.pink + '20', borderColor: C.pink + '40' }]}>
              <Text style={{ fontSize: 11, color: C.pink, fontWeight: '700' }}>−{negCount} meses</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Header de columnas ── */}
      <View style={[s.headerRow, { backgroundColor: C.border }]}>
        <Text style={[s.colHeader, { color: C.textMuted, flex: 1.4 }]}>Mes</Text>
        <Text style={[s.colHeader, { color: C.textMuted, flex: 1.6 }]}>Ingresos</Text>
        <Text style={[s.colHeader, { color: C.textMuted, flex: 1.6 }]}>Gastos</Text>
        <Text style={[s.colHeader, { color: C.textMuted, flex: 1.4, textAlign: 'right' }]}>Flujo</Text>
      </View>

      {/* ── Filas de meses ── */}
      {MONTHS.map((month, idx) => {
        const { ingresos, gastos, flujo, hasOverride } = getMonthValues(idx);
        const isPositive  = flujo >= 0;
        const flujoColor  = isPositive ? C.teal : C.pink;
        const barWidth    = Math.abs(flujo) / maxAbsFlujo;

        return (
          <View
            key={idx}
            style={[
              s.monthRow,
              { backgroundColor: C.card, borderColor: C.border },
              hasOverride && { borderColor: C.purple + '70' },
              !isPositive && { backgroundColor: C.pink + '08' },
            ]}
          >
            {/* Borde lateral de color según flujo */}
            <View style={[s.monthAccent, { backgroundColor: flujoColor }]} />

            <View style={{ flex: 1.4, paddingLeft: 10 }}>
              <Text style={[s.monthName, { color: C.text }]}>{month}</Text>
              {hasOverride && (
                <TouchableOpacity onPress={() => resetMonth(idx)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Text style={{ fontSize: 10, color: C.purple, marginTop: 2, fontWeight: '600' }}>↺ reset</Text>
                </TouchableOpacity>
              )}
              {/* Mini barra de flujo relativo */}
              <View style={{ marginTop: 5, height: 3, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ width: `${barWidth * 100}%`, height: '100%', backgroundColor: flujoColor, borderRadius: 2 }} />
              </View>
            </View>

            <TextInput
              style={[s.input, { flex: 1.6, color: C.text, backgroundColor: C.inputBg, borderColor: C.border }]}
              value={ingresos}
              onChangeText={v => handleChange(idx, 'ingresos', v)}
              keyboardType="numeric"
              placeholder={String(budgetIngresos)}
              placeholderTextColor={C.textMuted}
            />
            <TextInput
              style={[s.input, { flex: 1.6, marginHorizontal: 5, color: C.text, backgroundColor: C.inputBg, borderColor: C.border }]}
              value={gastos}
              onChangeText={v => handleChange(idx, 'gastos', v)}
              keyboardType="numeric"
              placeholder={String(budgetGastos)}
              placeholderTextColor={C.textMuted}
            />
            <Text style={[s.flujoValue, { flex: 1.4, color: flujoColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatCOP(flujo)}
            </Text>
          </View>
        );
      })}

      <Text style={[s.hint, { color: C.textMuted }]}>
        Edita cualquier campo para ajustar el flujo del mes. Los cambios se guardan automáticamente.
      </Text>
    </ScrollView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content:   { padding: 16, paddingTop: 52, paddingBottom: 40 },
    title:     { fontSize: 32, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginBottom: 20 },

    // Summary card
    summaryCard:  { borderRadius: 14, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
    summaryAccent:{ height: 3 },
    summaryBody:  { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    summaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
    summaryValue: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
    summaryHint:  { fontSize: 11, lineHeight: 16 },
    pill:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },

    // Table
    headerRow:  { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, marginBottom: 6 },
    colHeader:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

    // Month row
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 10,
      paddingVertical: 10,
      paddingRight: 10,
      marginBottom: 6,
      borderWidth: 1,
      overflow: 'hidden',
    },
    monthAccent: { width: 3, alignSelf: 'stretch', marginRight: 0, borderRadius: 0 },
    monthName:   { fontSize: 13, fontWeight: '600' },
    input: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 7,
      fontSize: 13,
      borderWidth: 1,
      marginRight: 5,
      fontWeight: '600',
    },
    flujoValue: { fontSize: 13, fontWeight: '800', textAlign: 'right', letterSpacing: -0.3 },
    hint:       { textAlign: 'center', fontSize: 11, marginTop: 16, lineHeight: 18, letterSpacing: 0.2 },
  });
}
