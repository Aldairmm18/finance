import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { loadData, saveData } from '../utils/storage';
import { formatCOP, parseAmount } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';

const MILESTONES = [
  { pct: 25,  label: '25%'  },
  { pct: 50,  label: '50%'  },
  { pct: 75,  label: '75%'  },
  { pct: 100, iconName: 'checkmark-circle' },
];

// ─── InputField ───────────────────────────────────────────────────────────────
function InputField({ label, value, onChangeText, suffix, hint }) {
  const { colors: C } = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 13, color: C.text, fontWeight: '700', marginBottom: 4, letterSpacing: -0.1 }}>{label}</Text>
      {hint ? <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, lineHeight: 18 }}>{hint}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          style={{
            flex: 1,
            backgroundColor: C.inputBg,
            color: C.text,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 17,
            borderWidth: 1,
            borderColor: C.border,
            fontWeight: '700',
          }}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={C.textMuted}
        />
        {suffix ? (
          <View style={{ backgroundColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginLeft: 8 }}>
            <Text style={{ fontSize: 17, color: C.textMuted, fontWeight: '700' }}>{suffix}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Barra de progreso animada con milestones ─────────────────────────────────
function ProgressBar({ progreso, color }) {
  const { colors: C } = useTheme();
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: Math.min(progreso / 100, 1),
      duration: 1100,
      useNativeDriver: false,
    }).start();
  }, [progreso]);

  const width = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View>
      {/* Track con milestones */}
      <View style={[s.progressTrack, { backgroundColor: C.border }]}>
        {/* Fill animado */}
        <Animated.View style={[
          s.progressFill,
          { width, backgroundColor: color },
        ]} />
        {/* Markers de milestone en 25/50/75% */}
        {MILESTONES.slice(0, 3).map(m => (
          <View key={m.pct} style={[s.markerLine, { left: `${m.pct}%`, backgroundColor: C.bg }]} />
        ))}
      </View>

      {/* Labels de milestone debajo */}
      <View style={s.milestonesRow}>
        {MILESTONES.map(m => {
          const reached = progreso >= m.pct;
          return (
            <View key={m.pct} style={[s.milestoneItem, { left: `${m.pct}%` }]}>
              {m.iconName ? (
                <Ionicons name={m.iconName} size={12} color={reached ? color : C.textMuted} />
              ) : (
                <Text style={{ fontSize: 10, color: reached ? color : C.textMuted, fontWeight: reached ? '800' : '400', textAlign: 'center' }}>
                  {m.label}
                </Text>
              )}
            </View>
          );
        })}
        {/* Indicador del progreso actual */}
        <Animated.View style={[s.progressIndicator, { left: animVal.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) }]}>
          <View style={[s.indicatorDot, { backgroundColor: color }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  progressTrack: { height: 12, borderRadius: 6, overflow: 'hidden', position: 'relative' },
  progressFill:  { height: '100%', borderRadius: 6, position: 'absolute', left: 0, top: 0 },
  markerLine:    { position: 'absolute', width: 2, height: '100%', top: 0, marginLeft: -1 },
  milestonesRow: { position: 'relative', height: 20, marginTop: 6 },
  milestoneItem: { position: 'absolute', transform: [{ translateX: -12 }], width: 24, alignItems: 'center' },
  progressIndicator: { position: 'absolute', top: 0, transform: [{ translateX: -5 }] },
  indicatorDot:  { width: 10, height: 10, borderRadius: 5, marginTop: 1 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function TranquilidadScreen() {
  const [fields, setFields] = useState({
    gastosMensualesDeseados: '',
    rentabilidadAnual: '7',
    patrimonioActual: '',
  });
  const [fullData, setFullData] = useState(null);
  const saveTimer = useRef(null);
  const { colors: C } = useTheme();

  useFocusEffect(useCallback(() => {
    let isMounted = true;
    loadData().then(d => {
      if (!isMounted) return;
      setFullData(d);
      setFields(d.tranquilidad || { gastosMensualesDeseados: '', rentabilidadAnual: '7', patrimonioActual: '' });
    });
    return () => { isMounted = false; };
  }, []));

  const styles = useMemo(() => makeStyles(C), [C]);

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

  const gastos           = parseAmount(fields.gastosMensualesDeseados);
  const rentabilidad     = parseAmount(fields.rentabilidadAnual) / 100;
  const patrimonioActual = parseAmount(fields.patrimonioActual);
  const tasaMensual      = rentabilidad / 12;
  const patrimonioNecesario = tasaMensual > 0 ? gastos / tasaMensual : 0;
  const progreso = patrimonioNecesario > 0
    ? Math.min(100, (patrimonioActual / patrimonioNecesario) * 100)
    : 0;
  const cuantoFalta = Math.max(0, patrimonioNecesario - patrimonioActual);
  const progressColor = progreso >= 100 ? C.teal : C.purple;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

      <View style={styles.header}>
        <Text style={styles.title}>Tranquilidad</Text>
        <Text style={styles.subtitle}>
          ¿Cuánto necesitas para vivir de tus inversiones?
        </Text>
        <View style={[styles.headerDivider, { backgroundColor: C.border }]} />
      </View>

      {/* ── Inputs: gastos y rentabilidad ── */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <InputField
          label="Gastos mensuales deseados"
          value={fields.gastosMensualesDeseados}
          onChangeText={v => update('gastosMensualesDeseados', v)}
          hint="¿Cuánto necesitas al mes para vivir cómodamente?"
        />
        <InputField
          label="Rentabilidad esperada anual"
          value={fields.rentabilidadAnual}
          onChangeText={v => update('rentabilidadAnual', v)}
          suffix="%"
          hint="Rendimiento anual promedio de tus inversiones"
        />
      </View>

      {/* ── Resultado: patrimonio necesario ── */}
      {patrimonioNecesario > 0 && (
        <View style={[styles.resultCard, { borderColor: C.purple + '40', backgroundColor: C.purple + '12' }]}>
          <View style={[styles.resultAccent, { backgroundColor: C.purple }]} />
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={[styles.resultLabel, { color: C.purple }]}>PATRIMONIO NECESARIO</Text>
            <Text style={[styles.resultValue, { color: C.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatCOP(patrimonioNecesario)}
            </Text>
            <Text style={[styles.resultFormula, { color: C.textMuted }]}>
              {formatCOP(gastos)}/mes ÷ ({fields.rentabilidadAnual || 0}% ÷ 12)
            </Text>
          </View>
        </View>
      )}

      {/* ── Input: patrimonio actual ── */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <InputField
          label="Patrimonio actual"
          value={fields.patrimonioActual}
          onChangeText={v => update('patrimonioActual', v)}
          hint="Inversiones + ahorros + inmuebles (valor de mercado)"
        />
      </View>

      {/* ── Progreso hacia la libertad financiera ── */}
      {patrimonioNecesario > 0 && (
        <View style={[styles.progressCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.progressAccent, { backgroundColor: progressColor }]} />
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Libertad Financiera
              </Text>
              <Text style={{ fontSize: 26, fontWeight: '900', color: progressColor, letterSpacing: -0.5 }}>
                {progreso.toFixed(1)}%
              </Text>
            </View>

            {/* Barra animada con milestones */}
            <View style={{ marginBottom: 20, marginTop: 8 }}>
              <ProgressBar progreso={progreso} color={progressColor} />
            </View>

            {progreso >= 100 ? (
              <View style={[styles.achievedBanner, { backgroundColor: C.teal + '20', borderColor: C.teal + '40' }]}>
                <Ionicons name="sparkles" size={28} color={C.teal} style={{ marginBottom: 6 }} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.teal, textAlign: 'center' }}>
                  ¡Libertad financiera alcanzada!
                </Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>
                  Tus inversiones generan más de lo que necesitas para vivir.
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.statBox, { backgroundColor: C.inputBg, borderColor: C.border }]}>
                  <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                    Tienes
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.purple, letterSpacing: -0.3 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {formatCOP(patrimonioActual)}
                  </Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: C.inputBg, borderColor: C.border }]}>
                  <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                    Falta
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.pink, letterSpacing: -0.3 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {formatCOP(cuantoFalta)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      <Text style={[styles.formulaHint, { color: C.textMuted }]}>
        Fórmula: Patrimonio = Gastos mensuales ÷ (Rentabilidad anual / 12)
      </Text>
    </ScrollView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content:   { padding: 16, paddingTop: 52, paddingBottom: 40 },

    // Header
    header:        { marginBottom: 24 },
    title:         { fontSize: 32, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
    subtitle:      { fontSize: 13, color: C.textMuted, marginTop: 4, lineHeight: 20 },
    headerDivider: { height: 1, marginTop: 18 },

    // Cards
    card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14 },

    // Resultado
    resultCard:   { borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
    resultAccent: { height: 3 },
    resultLabel:  { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 },
    resultValue:  { fontSize: 34, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
    resultFormula:{ fontSize: 12, fontStyle: 'italic' },

    // Progreso
    progressCard:   { borderRadius: 14, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
    progressAccent: { height: 3 },
    achievedBanner: { borderRadius: 12, borderWidth: 1, padding: 20, alignItems: 'center' },

    // Stat boxes
    statBox: { flex: 1, borderRadius: 12, padding: 14, borderWidth: 1, alignItems: 'center' },

    formulaHint: { textAlign: 'center', fontSize: 11, marginTop: 8, fontStyle: 'italic', lineHeight: 18, letterSpacing: 0.2 },
  });
}
