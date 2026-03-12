import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadTransaccionesAnio } from '../utils/storage';
import { formatCOP } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function FlujoMensualScreen() {
  const [anioTxs, setAnioTxs] = useState([]);
  const { colors: C } = useTheme();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  useFocusEffect(useCallback(() => {
    let isActive = true;
    loadTransaccionesAnio(selectedYear)
      .then((txs) => {
        if (!isActive) return;
        setAnioTxs(txs || []);
      })
      .catch(() => {
        if (!isActive) return;
        setAnioTxs([]);
      });
    return () => { isActive = false; };
  }, [selectedYear]));

  const s = useMemo(() => makeStyles(C), [C]);

  const monthlyActuals = useMemo(() => {
    const ingresos = new Array(12).fill(0);
    const gastos = new Array(12).fill(0);
    for (const tx of anioTxs) {
      const fecha = tx?.fecha;
      if (!fecha || typeof fecha !== 'string') continue;
      const monthIdx = parseInt(fecha.split('-')[1], 10) - 1;
      if (Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) continue;
      const monto = Number(tx.monto) || 0;
      if (tx.tipo === 'ingreso') ingresos[monthIdx] += monto;
      else gastos[monthIdx] += monto;
    }
    return { ingresos, gastos };
  }, [anioTxs]);

  const getMonthValues = (idx) => {
    const ingresos = Math.round(monthlyActuals.ingresos[idx] || 0);
    const gastos = Math.round(monthlyActuals.gastos[idx] || 0);
    const flujo = ingresos - gastos;
    return { ingresos, gastos, flujo };
  };

  // Para calcular el máximo flujo absoluto (escala relativa de las barras)
  const allFlujos = MONTHS.map((_, idx) => getMonthValues(idx).flujo);
  const maxAbsFlujo = Math.max(...allFlujos.map(Math.abs), 1);

  const annualFlujo = allFlujos.reduce((a, b) => a + b, 0);
  const annualIngresos = monthlyActuals.ingresos.reduce((a, b) => a + b, 0);
  const annualGastos = monthlyActuals.gastos.reduce((a, b) => a + b, 0);
  const avgIngresos = annualIngresos / 12;
  const avgGastos = annualGastos / 12;

  // Meses positivos y negativos para el resumen
  const posCount = allFlujos.filter(f => f > 0).length;
  const negCount = allFlujos.filter(f => f < 0).length;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Flujo Mensual</Text>

      {/* ── Selector de año ── */}
      <View style={[s.yearRow, { backgroundColor: C.card, borderColor: C.border }]}>
        <TouchableOpacity onPress={() => setSelectedYear(y => y - 1)} style={s.yearBtn}>
          <Text style={[s.yearBtnText, { color: C.textMuted }]}>‹</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[s.yearValue, { color: C.text }]}>{selectedYear}</Text>
          {selectedYear === currentYear && (
            <View style={[s.yearPill, { backgroundColor: C.teal + '22', borderColor: C.teal + '40' }]}>
              <Text style={[s.yearPillText, { color: C.teal }]}>AÑO ACTUAL</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setSelectedYear(y => Math.min(currentYear, y + 1))}
          style={s.yearBtn}
          disabled={selectedYear >= currentYear}
        >
          <Text style={[s.yearBtnText, { color: selectedYear >= currentYear ? C.border : C.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>

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
              Actual: {formatCOP(avgIngresos)}/mes ingresos · {formatCOP(avgGastos)}/mes gastos
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
        const { ingresos, gastos, flujo } = getMonthValues(idx);
        const isPositive  = flujo >= 0;
        const flujoColor  = isPositive ? C.teal : C.pink;
        const barWidth    = Math.abs(flujo) / maxAbsFlujo;

        return (
          <View
            key={idx}
            style={[
              s.monthRow,
              { backgroundColor: C.card, borderColor: C.border },
              !isPositive && { backgroundColor: C.pink + '08' },
            ]}
          >
            {/* Borde lateral de color según flujo */}
            <View style={[s.monthAccent, { backgroundColor: flujoColor }]} />

            <View style={{ flex: 1.4, paddingLeft: 10 }}>
              <Text style={[s.monthName, { color: C.text }]}>{month}</Text>
              {/* Mini barra de flujo relativo */}
              <View style={{ marginTop: 5, height: 3, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ width: `${barWidth * 100}%`, height: '100%', backgroundColor: flujoColor, borderRadius: 2 }} />
              </View>
            </View>

            <View style={[s.readonlyBox, { flex: 1.6, backgroundColor: C.inputBg, borderColor: C.border }]}>
              <Text style={[s.readonlyText, { color: C.text }]}>{formatCOP(ingresos)}</Text>
            </View>
            <View style={[s.readonlyBox, { flex: 1.6, marginHorizontal: 5, backgroundColor: C.inputBg, borderColor: C.border }]}>
              <Text style={[s.readonlyText, { color: C.text }]}>{formatCOP(gastos)}</Text>
            </View>
            <Text style={[s.flujoValue, { flex: 1.4, color: flujoColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatCOP(flujo)}
            </Text>
          </View>
        );
      })}

      <Text style={[s.hint, { color: C.textMuted }]}>
        Valores calculados automáticamente desde tus transacciones del año {selectedYear}.
      </Text>
    </ScrollView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content:   { padding: 16, paddingTop: 52, paddingBottom: 40 },
    title:     { fontSize: 32, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginBottom: 20 },

    // Year selector
    yearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      marginBottom: 16,
    },
    yearBtn: { paddingHorizontal: 14, paddingVertical: 6 },
    yearBtnText: { fontSize: 18 },
    yearValue: { fontSize: 17, fontWeight: '800' },
    yearPill: {
      marginTop: 4,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderWidth: 1,
    },
    yearPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },

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
    readonlyBox: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderWidth: 1,
      marginRight: 5,
      justifyContent: 'center',
      minHeight: 34,
    },
    readonlyText: { fontSize: 13, fontWeight: '600' },
    flujoValue: { fontSize: 13, fontWeight: '800', textAlign: 'right', letterSpacing: -0.3 },
    hint:       { textAlign: 'center', fontSize: 11, marginTop: 16, lineHeight: 18, letterSpacing: 0.2 },
  });
}
