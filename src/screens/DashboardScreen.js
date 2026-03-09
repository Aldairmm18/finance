import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart } from 'react-native-chart-kit';
import { loadData } from '../utils/storage';
import { formatCOP, computeTotals } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';

const screenWidth = Dimensions.get('window').width;

const GASTOS_META = {
  hogar:          { label: 'Hogar',          color: '#818cf8' },
  comida:         { label: 'Comida',         color: '#2dd4bf' },
  transporte:     { label: 'Transporte',     color: '#f59e0b' },
  creditos:       { label: 'Créditos',       color: '#f472b6' },
  entretenimiento:{ label: 'Entretenimiento',color: '#60a5fa' },
  familia:        { label: 'Familia',        color: '#34d399' },
};

const INGRESOS_META = {
  salario:    { label: 'Salario',    color: '#2dd4bf' },
  bonos:      { label: 'Bonos',     color: '#818cf8' },
  dividendos: { label: 'Dividendos',color: '#f472b6' },
  comisiones: { label: 'Comisiones',color: '#60a5fa' },
  otros:      { label: 'Otros',     color: '#94a3b8' },
};

// ─── Hook: count-up animado (easeOutCubic) ────────────────────────────────────
function useCountUp(target, triggerKey, duration = 850) {
  const [val, setVal] = useState(0);
  const frameRef = useRef(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const t0 = targetRef.current;
    if (!t0) { setVal(0); return; }
    setVal(0);
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= duration) { setVal(t0); return; }
      const progress = elapsed / duration;
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(t0 * eased));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [triggerKey, duration]);

  return val;
}

// ─── StatCard: barra de acento + label uppercase + número grande ──────────────
function StatCard({ label, value, sub, accentColor, half, animVal }) {
  const { colors: C } = useTheme();
  const animStyle = animVal ? {
    opacity: animVal,
    transform: [{ translateY: animVal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  } : {};
  return (
    <Animated.View style={[
      { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginBottom: 10 },
      half && { flex: 1 },
      animStyle,
    ]}>
      <View style={{ height: 3, backgroundColor: accentColor }} />
      <View style={{ padding: 14 }}>
        <Text style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 }}>
          {label}
        </Text>
        <Text
          style={{ fontSize: 20, fontWeight: '800', color: accentColor, letterSpacing: -0.5 }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value}
        </Text>
        {sub ? (
          <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>{sub}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ─── ChartCard: barra de acento + título uppercase ────────────────────────────
function ChartCard({ title, accentColor, animVal, children }) {
  const { colors: C } = useTheme();
  const animStyle = animVal ? {
    opacity: animVal,
    transform: [{ translateY: animVal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  } : {};
  return (
    <Animated.View style={[
      { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginBottom: 12 },
      animStyle,
    ]}>
      <View style={{ height: 3, backgroundColor: accentColor }} />
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 }}>
          {title}
        </Text>
        {children}
      </View>
    </Animated.View>
  );
}

// ─── EmptyState con ícono + texto descriptivo ─────────────────────────────────
function EmptyState({ icon, text }) {
  const { colors: C } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 36, marginBottom: 10 }}>{icon}</Text>
      <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function DashboardScreen() {
  const [totals, setTotals] = useState(null);
  const [focusKey, setFocusKey] = useState(0);
  const { colors: C } = useTheme();

  // 6 animated values: 4 stat cards + fondo card + 3 chart cards
  const cardAnims = useRef([...Array(8)].map(() => new Animated.Value(0))).current;

  useFocusEffect(useCallback(() => {
    cardAnims.forEach(a => a.setValue(0));
    loadData().then(d => {
      setTotals(computeTotals(d));
      setFocusKey(k => k + 1);
      Animated.stagger(65, cardAnims.map(a =>
        Animated.timing(a, { toValue: 1, duration: 420, useNativeDriver: true })
      )).start();
    });
  }, []));

  const s = useMemo(() => makeStyles(C), [C]);

  const animIngresos    = useCountUp(totals?.ingresosMonthly      ?? 0, focusKey);
  const animGastos      = useCountUp(totals?.totalGastosMonthly   ?? 0, focusKey);
  const animFlujo       = useCountUp(totals?.flujoCaja            ?? 0, focusKey);
  const animFlujoAhorro = useCountUp(totals?.flujoCajaConAhorro   ?? 0, focusKey);
  const animFondo       = useCountUp(totals?.fondoEmergencia      ?? 0, focusKey);

  if (!totals) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.textMuted, fontSize: 14, letterSpacing: 0.5 }}>Cargando...</Text>
      </View>
    );
  }

  const flujoCajaColor  = totals.flujoCaja >= 0          ? C.teal : C.pink;
  const flujoAhorroColor = totals.flujoCajaConAhorro >= 0 ? C.teal : C.pink;

  const gastosChartData = Object.entries(GASTOS_META)
    .map(([k, m]) => ({ name: m.label, population: Math.round(totals.gastosByCategory[k] || 0), color: m.color, legendFontColor: C.text, legendFontSize: 11 }))
    .filter(d => d.population > 0);

  const ingresosChartData = Object.entries(INGRESOS_META)
    .map(([k, m]) => ({ name: m.label, population: Math.round(totals.ingresosBySource[k] || 0), color: m.color, legendFontColor: C.text, legendFontSize: 11 }))
    .filter(d => d.population > 0);

  const tipoGastoData = [
    { name: 'Esenciales',   population: Math.round(totals.esencialesMonthly),   color: C.teal,   legendFontColor: C.text, legendFontSize: 11 },
    { name: 'No Esenciales',population: Math.round(totals.noEsencialesMonthly), color: C.pink,   legendFontColor: C.text, legendFontSize: 11 },
    { name: 'Créditos',     population: Math.round(totals.creditosMonthly),     color: C.purple, legendFontColor: C.text, legendFontSize: 11 },
  ].filter(d => d.population > 0);

  const chartWidth = screenWidth - 64;
  const chartCfg = {
    backgroundColor: C.card,
    backgroundGradientFrom: C.card,
    backgroundGradientTo: C.card,
    color: () => 'rgba(128,128,128,0.4)',
  };

  // Fecha actual como subtítulo del header
  const mesActual = (() => {
    const s = new Date().toLocaleString('es-CO', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>Dashboard</Text>
        <Text style={s.subtitle}>{mesActual}</Text>
        <View style={[s.headerDivider, { backgroundColor: C.border }]} />
      </View>

      {/* ── Fila 1: Ingresos + Gastos ── */}
      <View style={s.row}>
        <StatCard label="Ingresos Mensuales" value={formatCOP(animIngresos)} sub={formatCOP(totals.ingresosAnual) + ' al año'} accentColor={C.teal}   animVal={cardAnims[0]} half />
        <StatCard label="Gastos Mensuales"   value={formatCOP(animGastos)}   sub={formatCOP(totals.totalGastosAnual) + ' al año'} accentColor={C.pink}   animVal={cardAnims[1]} half />
      </View>

      {/* ── Fila 2: Flujos ── */}
      <View style={s.row}>
        <StatCard label="Flujo de Caja"  value={formatCOP(animFlujo)}       sub={formatCOP(totals.flujoCajaAnual) + ' al año'}           accentColor={flujoCajaColor}   animVal={cardAnims[2]} half />
        <StatCard label="Con Ahorro"     value={formatCOP(animFlujoAhorro)} sub={formatCOP(totals.flujoCajaConAhorroAnual) + ' al año'} accentColor={flujoAhorroColor} animVal={cardAnims[3]} half />
      </View>

      {/* ── Fondo de Emergencia (tarjeta hero) ── */}
      <Animated.View style={[s.fondoCard, { backgroundColor: C.card, borderColor: C.border }, {
        opacity: cardAnims[4],
        transform: [{ translateY: cardAnims[4].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }]}>
        <View style={[s.fondoAccent, { backgroundColor: C.purple }]} />
        <View style={s.fondoBody}>
          <View style={s.fondoLeft}>
            <Text style={[s.fondoIcon]}>🛡️</Text>
            <View>
              <Text style={[s.fondoLabel, { color: C.text }]}>Fondo de Emergencia</Text>
              <Text style={[s.fondoSub, { color: C.textMuted }]}>3 meses de gastos esenciales</Text>
            </View>
          </View>
          <Text style={[s.fondoValue, { color: C.purple }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatCOP(animFondo)}
          </Text>
        </View>
      </Animated.View>

      {/* ── Gráficas ── */}
      <ChartCard title="Distribución de Gastos" accentColor={C.pink} animVal={cardAnims[5]}>
        {gastosChartData.length > 0 ? (
          <PieChart data={gastosChartData} width={chartWidth} height={200} chartConfig={chartCfg} accessor="population" backgroundColor="transparent" paddingLeft="15" absolute={false} />
        ) : <EmptyState icon="📊" text={'Ingresa tus gastos en\nPresupuesto para ver la gráfica'} />}
      </ChartCard>

      <ChartCard title="Fuentes de Ingreso" accentColor={C.teal} animVal={cardAnims[6]}>
        {ingresosChartData.length > 0 ? (
          <PieChart data={ingresosChartData} width={chartWidth} height={200} chartConfig={chartCfg} accessor="population" backgroundColor="transparent" paddingLeft="15" absolute={false} />
        ) : <EmptyState icon="💰" text={'Ingresa tus fuentes de\ningreso en Presupuesto'} />}
      </ChartCard>

      <ChartCard title="Tipo de Gasto" accentColor={C.purple} animVal={cardAnims[7]}>
        {tipoGastoData.length > 0 ? (
          <PieChart data={tipoGastoData} width={chartWidth} height={200} chartConfig={chartCfg} accessor="population" backgroundColor="transparent" paddingLeft="15" absolute={false} />
        ) : <EmptyState icon="🗂️" text={'Clasifica tus gastos como\nEsencial / No Esencial'} />}
      </ChartCard>

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
    subtitle:      { fontSize: 13, color: C.textMuted, marginTop: 4, fontWeight: '500' },
    headerDivider: { height: 1, marginTop: 18 },

    // Stat rows
    row: { flexDirection: 'row', gap: 10, marginBottom: 2 },

    // Fondo de Emergencia
    fondoCard:   { borderRadius: 14, borderWidth: 1, marginBottom: 20, marginTop: 8, overflow: 'hidden' },
    fondoAccent: { height: 3 },
    fondoBody:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 12 },
    fondoLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    fondoIcon:   { fontSize: 22 },
    fondoLabel:  { fontSize: 13, fontWeight: '700', marginBottom: 2 },
    fondoSub:    { fontSize: 11 },
    fondoValue:  { fontSize: 19, fontWeight: '800', letterSpacing: -0.5, flexShrink: 0 },
  });
}
