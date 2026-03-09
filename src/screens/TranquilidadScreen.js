import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadData, saveData } from '../utils/storage';
import { formatCOP, parseAmount } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';

function InputField({ label, value, onChangeText, suffix, hint }) {
  const { colors: C } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, color: C.text, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      {hint ? <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>{hint}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          style={{
            flex: 1,
            backgroundColor: C.inputBg,
            color: C.text,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 16,
            borderWidth: 1,
            borderColor: C.border,
          }}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={C.textMuted}
        />
        {suffix ? <Text style={{ fontSize: 16, color: C.textMuted, marginLeft: 10, fontWeight: '600' }}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export default function TranquilidadScreen() {
  const [fields, setFields] = useState({ gastosMensualesDeseados: '', rentabilidadAnual: '7', patrimonioActual: '' });
  const [fullData, setFullData] = useState(null);
  const saveTimer = useRef(null);
  const { colors: C } = useTheme();

  useFocusEffect(
    useCallback(() => {
      loadData().then(d => {
        setFullData(d);
        setFields(d.tranquilidad || { gastosMensualesDeseados: '', rentabilidadAnual: '7', patrimonioActual: '' });
      });
    }, [])
  );

  const s = useMemo(() => makeStyles(C), [C]);

  const update = useCallback((key, value) => {
    const clean = value.replace(/[^0-9.]/g, '');
    setFields(prev => {
      const next = { ...prev, [key]: clean };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (fullData) saveData({ ...fullData, tranquilidad: next });
      }, 600);
      return next;
    });
  }, [fullData]);

  const gastos = parseAmount(fields.gastosMensualesDeseados);
  const rentabilidad = parseAmount(fields.rentabilidadAnual) / 100;
  const patrimonioActual = parseAmount(fields.patrimonioActual);

  const tasaMensual = rentabilidad / 12;
  const patrimonioNecesario = tasaMensual > 0 ? gastos / tasaMensual : 0;

  const progreso = patrimonioNecesario > 0
    ? Math.min(100, (patrimonioActual / patrimonioNecesario) * 100)
    : 0;

  const cuantoFalta = Math.max(0, patrimonioNecesario - patrimonioActual);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Tranquilidad Financiera</Text>

      <Text style={s.subtitle}>
        Calcula el patrimonio que necesitas para vivir de tus inversiones sin trabajar.
      </Text>

      <View style={s.card}>
        <InputField
          label="Gastos mensuales deseados"
          value={fields.gastosMensualesDeseados}
          onChangeText={v => update('gastosMensualesDeseados', v)}
          hint="¿Cuánto necesitas al mes para vivir?"
        />
        <InputField
          label="Rentabilidad esperada anual"
          value={fields.rentabilidadAnual}
          onChangeText={v => update('rentabilidadAnual', v)}
          suffix="%"
          hint="Rendimiento anual esperado de tus inversiones"
        />
      </View>

      {patrimonioNecesario > 0 && (
        <View style={s.resultCard}>
          <Text style={s.resultLabel}>Patrimonio Necesario</Text>
          <Text style={s.resultValue}>{formatCOP(patrimonioNecesario)}</Text>
          <Text style={s.resultFormula}>
            {formatCOP(gastos)}/mes ÷ ({fields.rentabilidadAnual || 0}% / 12)
          </Text>
        </View>
      )}

      <View style={s.card}>
        <InputField
          label="Patrimonio actual"
          value={fields.patrimonioActual}
          onChangeText={v => update('patrimonioActual', v)}
          hint="Suma de tus inversiones, ahorros e inmuebles"
        />
      </View>

      {patrimonioNecesario > 0 && (
        <View style={s.progressCard}>
          <View style={s.progressHeader}>
            <Text style={s.progressLabel}>Progreso hacia la libertad financiera</Text>
            <Text style={[s.progressPct, { color: progreso >= 100 ? C.teal : C.purple }]}>
              {progreso.toFixed(1)}%
            </Text>
          </View>

          <View style={s.progressBar}>
            <View style={[s.progressFill, {
              width: `${progreso}%`,
              backgroundColor: progreso >= 100 ? C.teal : C.purple,
            }]} />
          </View>

          {progreso >= 100 ? (
            <Text style={[s.statusText, { color: C.teal }]}>
              ¡Lograste la libertad financiera! 🎉
            </Text>
          ) : (
            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statBoxLabel}>Patrimonio actual</Text>
                <Text style={[s.statBoxValue, { color: C.purple }]}>{formatCOP(patrimonioActual)}</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statBoxLabel}>Falta</Text>
                <Text style={[s.statBoxValue, { color: C.pink }]}>{formatCOP(cuantoFalta)}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <Text style={s.hint}>
        Fórmula: Patrimonio = Gastos mensuales ÷ (Rentabilidad anual / 12)
      </Text>
    </ScrollView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingTop: 52, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: 'bold', color: C.text, marginBottom: 8 },
    subtitle: { fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 20 },
    card: {
      backgroundColor: C.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 16,
    },
    resultCard: {
      backgroundColor: C.purple + '20',
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: C.purple + '50',
      marginBottom: 16,
      alignItems: 'center',
    },
    resultLabel: { fontSize: 13, color: C.purple, marginBottom: 8, fontWeight: '600' },
    resultValue: { fontSize: 32, fontWeight: 'bold', color: C.text, marginBottom: 6 },
    resultFormula: { fontSize: 12, color: C.textMuted, fontStyle: 'italic' },
    progressCard: {
      backgroundColor: C.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 16,
    },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    progressLabel: { fontSize: 14, color: C.text, fontWeight: '600' },
    progressPct: { fontSize: 22, fontWeight: 'bold' },
    progressBar: {
      height: 14,
      backgroundColor: C.border,
      borderRadius: 7,
      overflow: 'hidden',
      marginBottom: 16,
    },
    progressFill: { height: '100%', borderRadius: 7 },
    statsRow: { flexDirection: 'row', gap: 12 },
    statBox: {
      flex: 1,
      backgroundColor: C.inputBg,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    statBoxLabel: { fontSize: 11, color: C.textMuted, marginBottom: 6 },
    statBoxValue: { fontSize: 16, fontWeight: 'bold' },
    statusText: { textAlign: 'center', fontSize: 16, fontWeight: '700' },
    hint: { textAlign: 'center', color: C.textMuted, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  });
}
