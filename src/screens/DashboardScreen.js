import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart } from 'react-native-chart-kit';
import {
  loadDataMes,
  getCurrentMes,
  loadTransaccionesMes,
  registrarExtraordinario,
  aplicarTraspasoSobrante,
} from '../utils/storage';
import { formatCOP, computeTotals, mergeTransacciones } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

const screenWidth = Dimensions.get('window').width;

const GASTOS_META = {
  hogar: { label: 'Hogar', color: '#818cf8' },
  comida: { label: 'Comida', color: '#2dd4bf' },
  transporte: { label: 'Transporte', color: '#f59e0b' },
  creditos: { label: 'Creditos', color: '#f472b6' },
  entretenimiento: { label: 'Entretenimiento', color: '#60a5fa' },
  familia: { label: 'Familia', color: '#34d399' },
};

const INGRESOS_META = {
  salario: { label: 'Salario', color: '#2dd4bf' },
  bonos: { label: 'Bonos', color: '#818cf8' },
  dividendos: { label: 'Dividendos', color: '#f472b6' },
  comisiones: { label: 'Comisiones', color: '#60a5fa' },
  hogar: { label: 'Hogar', color: '#a78bfa' },
  comida: { label: 'Comida', color: '#34d399' },
  transporte: { label: 'Transporte', color: '#f59e0b' },
  creditos: { label: 'Créditos', color: '#fb7185' },
  entretenimiento: { label: 'Entretenimiento', color: '#38bdf8' },
  familia: { label: 'Familia', color: '#4ade80' },
  ahorro: { label: 'Ahorro', color: '#fbbf24' },
  otros: { label: 'Otros', color: '#94a3b8' },
};

const EXTRA_CATS_GASTO = [
  { key: 'hogar', label: 'Hogar' },
  { key: 'comida', label: 'Comida' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'salud', label: 'Salud' },
  { key: 'entretenimiento', label: 'Entretenimiento' },
  { key: 'familia', label: 'Familia' },
  { key: 'educacion', label: 'Educacion' },
  { key: 'otros', label: 'Otros' },
];

const EXTRA_CATS_INGRESO = [
  { key: 'salario', label: 'Salario' },
  { key: 'bonos', label: 'Bonos' },
  { key: 'comisiones', label: 'Comisión' },
  { key: 'dividendos', label: 'Dividendos' },
  { key: 'hogar', label: 'Hogar' },
  { key: 'comida', label: 'Comida' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'creditos', label: 'Créditos' },
  { key: 'entretenimiento', label: 'Entretenimiento' },
  { key: 'familia', label: 'Familia' },
  { key: 'ahorro', label: 'Ahorro' },
  { key: 'otros', label: 'Otros' },
];

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

// ─── StatCard: barra de acento + label uppercase + numero grande ──────────────
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

// ─── ChartCard: barra de acento + titulo uppercase ────────────────────────────
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

// ─── EmptyState con icono + texto descriptivo ─────────────────────────────────
function EmptyState({ icon, text }) {
  const { colors: C } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 36, marginBottom: 10 }}>{icon}</Text>
      <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

// ─── ExtraFABModal: bottom sheet para registrar gasto o ingreso extraordinario ─
function ExtraFABModal({ visible, onClose, onSuccess }) {
  const { colors: C } = useTheme();
  const [tipo, setTipo] = useState('gasto');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('otros');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const cats = tipo === 'ingreso' ? EXTRA_CATS_INGRESO : EXTRA_CATS_GASTO;
  const accentColor = tipo === 'ingreso' ? C.teal : C.pink;

  const reset = () => {
    setTipo('gasto');
    setDescripcion('');
    setMonto('');
    setCategoria('otros');
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTipoChange = (t) => {
    setTipo(t);
    setCategoria(t === 'ingreso' ? 'salario' : 'otros');
    setError('');
  };

  const handleSubmit = async () => {
    const montoNum = parseFloat(String(monto).replace(/[^0-9.]/g, ''));
    if (!descripcion.trim()) { setError('Ingresa una descripcion'); return; }
    if (!montoNum || montoNum <= 0) { setError('Ingresa un monto valido'); return; }
    setError('');
    setLoading(true);
    try {
      await registrarExtraordinario({
        descripcion: descripcion.trim(),
        monto: montoNum,
        categoria,
        tipo,
      });
      reset();
      onSuccess();
    } catch (e) {
      setError(e.message || 'Error al guardar');
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={{
          backgroundColor: C.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 24,
          paddingBottom: 36,
          borderTopWidth: 1,
          borderColor: C.border,
        }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.3 }}>
                Transaccion extraordinaria
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                Registra algo fuera de tu presupuesto
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={{ paddingLeft: 12, paddingBottom: 4 }}>
              <Text style={{ fontSize: 22, color: C.textMuted, lineHeight: 24 }}>x</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 1, backgroundColor: C.border, marginVertical: 16 }} />

          {/* Tipo toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: 'hidden' }}>
            {[{ key: 'gasto', label: 'Gasto', color: C.pink }, { key: 'ingreso', label: 'Ingreso', color: C.teal }].map(opt => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => handleTipoChange(opt.key)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: tipo === opt.key ? opt.color : 'transparent',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: tipo === opt.key ? '#fff' : C.textMuted }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Descripcion */}
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>
            Descripcion
          </Text>
          <TextInput
            style={{
              backgroundColor: C.bg,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C.border,
              color: C.text,
              fontSize: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 14,
            }}
            placeholder={tipo === 'ingreso' ? 'Ej. Freelance, Venta, Regalo...' : 'Ej. Medico, Reparacion, Regalo...'}
            placeholderTextColor={C.textMuted}
            value={descripcion}
            onChangeText={setDescripcion}
            returnKeyType="next"
          />

          {/* Monto */}
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>
            Monto
          </Text>
          <TextInput
            style={{
              backgroundColor: C.bg,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C.border,
              color: C.text,
              fontSize: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 4,
            }}
            placeholder="0"
            placeholderTextColor={C.textMuted}
            value={monto}
            onChangeText={setMonto}
            keyboardType="numeric"
            returnKeyType="done"
          />
          {monto ? (
            <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>
              = {formatCOP(parseFloat(String(monto).replace(/[^0-9.]/g, '')) || 0)}
            </Text>
          ) : (
            <View style={{ marginBottom: 14 }} />
          )}

          {/* Categoria */}
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8 }}>
            Categoria
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {cats.map(cat => (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setCategoria(cat.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: categoria === cat.key ? accentColor : C.bg,
                  borderWidth: 1,
                  borderColor: categoria === cat.key ? accentColor : C.border,
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: categoria === cat.key ? '#fff' : C.textMuted,
                }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Error */}
          {error ? (
            <Text style={{ color: '#f472b6', fontSize: 12, marginBottom: 12 }}>{error}</Text>
          ) : null}

          {/* Boton guardar */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: accentColor,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 }}>
                {tipo === 'ingreso' ? 'Guardar ingreso' : 'Guardar gasto'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function DashboardScreen() {
  const [totals, setTotals] = useState(null);
  const [extraordinarios, setExtraordinarios] = useState([]);
  const [extrasIngreso, setExtrasIngreso] = useState([]);
  const [focusKey, setFocusKey] = useState(0);
  const [fabVisible, setFabVisible] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('idle'); // 'idle' | 'synced' | 'error'
  const { colors: C } = useTheme();

  // 9 animated values: 4 stat cards + fondo card + 3 chart cards + extraordinary card
  const cardAnims = useRef([...Array(9)].map(() => new Animated.Value(0))).current;

  const reload = useCallback(async () => {
    cardAnims.forEach(a => a.setValue(0));
    try {
      const mesActual = getCurrentMes();
      await aplicarTraspasoSobrante(mesActual);
      const [d, txs] = await Promise.all([loadDataMes(mesActual), loadTransaccionesMes()]);
      const base = computeTotals(d);
      setTotals(mergeTransacciones(base, txs));
      const extras = (txs || []).filter(tx => tx.es_extraordinario);
      setExtraordinarios(extras.filter(tx => tx.tipo === 'gasto'));
      setExtrasIngreso(extras.filter(tx => tx.tipo === 'ingreso'));
      setCloudStatus('synced');
      setFocusKey(k => k + 1);
      Animated.stagger(65, cardAnims.map(a =>
        Animated.timing(a, { toValue: 1, duration: 420, useNativeDriver: true })
      )).start();
    } catch {
      setCloudStatus('error');
    }
  }, []);

  useFocusEffect(useCallback(() => {
    reload();
  }, [reload]));

  const refreshExtras = useCallback(async () => {
    try {
      const txs = await loadTransaccionesMes();
      const extras = (txs || []).filter(tx => tx.es_extraordinario);
      setExtraordinarios(extras.filter(tx => tx.tipo === 'gasto'));
      setExtrasIngreso(extras.filter(tx => tx.tipo === 'ingreso'));
    } catch {
      // silencioso
    }
  }, []);

  useRealtimeSync(refreshExtras);

  const s = useMemo(() => makeStyles(C), [C]);

  const animIngresos = useCountUp(totals?.ingresosMonthly ?? 0, focusKey);
  const animGastos = useCountUp(totals?.totalGastosMonthly ?? 0, focusKey);
  const animFlujo = useCountUp(totals?.flujoCaja ?? 0, focusKey);
  const animFlujoAhorro = useCountUp(totals?.flujoCajaConAhorro ?? 0, focusKey);
  const animFondo = useCountUp(totals?.fondoEmergencia ?? 0, focusKey);

  if (!totals) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.teal} size="small" />
        <Text style={{ color: C.textMuted, fontSize: 13, letterSpacing: 0.5, marginTop: 12 }}>Cargando...</Text>
      </View>
    );
  }

  const flujoCajaColor = totals.flujoCaja >= 0 ? C.teal : C.pink;
  const flujoAhorroColor = totals.flujoCajaConAhorro >= 0 ? C.teal : C.pink;

  const gastosChartData = Object.entries(GASTOS_META)
    .map(([k, m]) => ({ name: m.label, population: Math.round(totals.gastosByCategory[k] || 0), color: m.color, legendFontColor: C.text, legendFontSize: 11 }))
    .filter(d => d.population > 0);

  const ingresosChartData = Object.entries(INGRESOS_META)
    .map(([k, m]) => ({ name: m.label, population: Math.round(totals.ingresosBySource[k] || 0), color: m.color, legendFontColor: C.text, legendFontSize: 11 }))
    .filter(d => d.population > 0);

  const tipoGastoData = [
    { name: 'Esenciales', population: Math.round(totals.esencialesMonthly), color: C.teal, legendFontColor: C.text, legendFontSize: 11 },
    { name: 'No Esenciales', population: Math.round(totals.noEsencialesMonthly), color: C.pink, legendFontColor: C.text, legendFontSize: 11 },
    { name: 'Creditos', population: Math.round(totals.creditosMonthly), color: C.purple, legendFontColor: C.text, legendFontSize: 11 },
  ].filter(d => d.population > 0);

  const chartWidth = screenWidth - 64;
  const chartCfg = {
    backgroundColor: C.card,
    backgroundGradientFrom: C.card,
    backgroundGradientTo: C.card,
    color: () => 'rgba(128,128,128,0.4)',
  };

  const mesActual = (() => {
    const str = new Date().toLocaleString('es-CO', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  })();

  const cloudDotColor = cloudStatus === 'synced' ? '#34d399' : cloudStatus === 'error' ? '#f472b6' : C.border;

  const totalExtrasGasto = extraordinarios.reduce((sum, ex) => sum + (ex.monto || 0), 0);
  const totalExtrasIngreso = extrasIngreso.reduce((sum, ex) => sum + (ex.monto || 0), 0);
  const hasExtras = extraordinarios.length > 0 || extrasIngreso.length > 0;
  const visibleGastos = extraordinarios.slice(0, 3);
  const visibleIngresos = extrasIngreso.slice(0, 2);
  const hiddenGastos = extraordinarios.length - visibleGastos.length;
  const hiddenIngresos = extrasIngreso.length - visibleIngresos.length;

  return (
    <View style={s.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.title}>Dashboard</Text>
            <View style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: cloudDotColor,
              marginTop: 4,
            }} />
          </View>
          <Text style={s.subtitle}>{mesActual}</Text>
          <View style={[s.headerDivider, { backgroundColor: C.border }]} />
        </View>

        {/* ── Fila 1: Ingresos + Gastos ── */}
        <View style={s.row}>
          <StatCard label="Ingresos Mensuales" value={formatCOP(animIngresos)} sub={formatCOP(totals.ingresosAnual) + ' al año'} accentColor={C.teal} animVal={cardAnims[0]} half />
          <StatCard label="Gastos Mensuales" value={formatCOP(animGastos)} sub={formatCOP(totals.totalGastosAnual) + ' al año'} accentColor={C.pink} animVal={cardAnims[1]} half />
        </View>

        {/* ── Fila 2: Flujos ── */}
        <View style={s.row}>
          <StatCard label="Flujo de Caja" value={formatCOP(animFlujo)} sub={formatCOP(totals.flujoCajaAnual) + ' al año'} accentColor={flujoCajaColor} animVal={cardAnims[2]} half />
          <StatCard label="Con Ahorro" value={formatCOP(animFlujoAhorro)} sub={formatCOP(totals.flujoCajaConAhorroAnual) + ' al año'} accentColor={flujoAhorroColor} animVal={cardAnims[3]} half />
        </View>

        {/* ── Fondo de Emergencia ── */}
        <Animated.View style={[s.fondoCard, { backgroundColor: C.card, borderColor: C.border }, {
          opacity: cardAnims[4],
          transform: [{ translateY: cardAnims[4].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        }]}>
          <View style={[s.fondoAccent, { backgroundColor: C.purple }]} />
          <View style={s.fondoBody}>
            <View style={s.fondoLeft}>
              <Text style={s.fondoIcon}>*</Text>
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

        {/* ── Extraordinarios (gastos e ingresos, solo si hay) ── */}
        {hasExtras && (
          <Animated.View style={[
            { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginBottom: 12 },
            {
              opacity: cardAnims[8],
              transform: [{ translateY: cardAnims[8].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            },
          ]}>
            <View style={{ height: 3, backgroundColor: '#f472b6' }} />
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
                Extraordinarios del mes
              </Text>

              {/* Gastos extraordinarios */}
              {extraordinarios.length > 0 && (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: C.textMuted }}>Gastos</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: C.pink }}>{formatCOP(totalExtrasGasto)}</Text>
                  </View>
                  {visibleGastos.map((ex, i) => (
                    <View key={ex.id ?? i} style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 6,
                      paddingLeft: 8,
                      borderBottomWidth: i < visibleGastos.length - 1 ? 1 : 0,
                      borderColor: C.border,
                    }}>
                      <Text style={{ fontSize: 13, color: C.text, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {ex.descripcion || 'Sin descripcion'}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.pink }}>
                        -{formatCOP(ex.monto || 0)}
                      </Text>
                    </View>
                  ))}
                  {hiddenGastos > 0 && (
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4, paddingLeft: 8 }}>
                      +{hiddenGastos} mas
                    </Text>
                  )}
                </>
              )}

              {/* Ingresos extraordinarios */}
              {extrasIngreso.length > 0 && (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginTop: extraordinarios.length > 0 ? 14 : 0 }}>
                    <Text style={{ fontSize: 12, color: C.textMuted }}>Ingresos</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: C.teal }}>{formatCOP(totalExtrasIngreso)}</Text>
                  </View>
                  {visibleIngresos.map((ex, i) => (
                    <View key={ex.id ?? i} style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 6,
                      paddingLeft: 8,
                      borderBottomWidth: i < visibleIngresos.length - 1 ? 1 : 0,
                      borderColor: C.border,
                    }}>
                      <Text style={{ fontSize: 13, color: C.text, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {ex.descripcion || 'Sin descripcion'}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.teal }}>
                        +{formatCOP(ex.monto || 0)}
                      </Text>
                    </View>
                  ))}
                  {hiddenIngresos > 0 && (
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4, paddingLeft: 8 }}>
                      +{hiddenIngresos} mas
                    </Text>
                  )}
                </>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── Graficas ── */}
        <ChartCard title="Distribucion de Gastos" accentColor={C.pink} animVal={cardAnims[5]}>
          {gastosChartData.length > 0 ? (
            <PieChart data={gastosChartData} width={chartWidth} height={200} chartConfig={chartCfg} accessor="population" backgroundColor="transparent" paddingLeft="15" absolute={false} />
          ) : <EmptyState icon="+" text={'Ingresa tus gastos en\nPresupuesto para ver la grafica'} />}
        </ChartCard>

        <ChartCard title="Fuentes de Ingreso" accentColor={C.teal} animVal={cardAnims[6]}>
          {ingresosChartData.length > 0 ? (
            <PieChart data={ingresosChartData} width={chartWidth} height={200} chartConfig={chartCfg} accessor="population" backgroundColor="transparent" paddingLeft="15" absolute={false} />
          ) : <EmptyState icon="$" text={'Ingresa tus fuentes de\ningreso en Presupuesto'} />}
        </ChartCard>

        <ChartCard title="Tipo de Gasto" accentColor={C.purple} animVal={cardAnims[7]}>
          {tipoGastoData.length > 0 ? (
            <PieChart data={tipoGastoData} width={chartWidth} height={200} chartConfig={chartCfg} accessor="population" backgroundColor="transparent" paddingLeft="15" absolute={false} />
          ) : <EmptyState icon="#" text={'Clasifica tus gastos como\nEsencial / No Esencial'} />}
        </ChartCard>

      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        onPress={() => setFabVisible(true)}
        style={{
          position: 'absolute',
          bottom: 28,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: C.pink,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 8,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32, marginTop: -2 }}>+</Text>
      </TouchableOpacity>

      {/* ── Modal extraordinario ── */}
      <ExtraFABModal
        visible={fabVisible}
        onClose={() => setFabVisible(false)}
        onSuccess={() => {
          setFabVisible(false);
          refreshExtras();
        }}
      />
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingTop: 52, paddingBottom: 100 },

    // Header
    header: { marginBottom: 24 },
    title: { fontSize: 32, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: C.textMuted, marginTop: 4, fontWeight: '500' },
    headerDivider: { height: 1, marginTop: 18 },

    // Stat rows
    row: { flexDirection: 'row', gap: 10, marginBottom: 2 },

    // Fondo de Emergencia
    fondoCard: { borderRadius: 14, borderWidth: 1, marginBottom: 20, marginTop: 8, overflow: 'hidden' },
    fondoAccent: { height: 3 },
    fondoBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 12 },
    fondoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    fondoIcon: { fontSize: 22 },
    fondoLabel: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
    fondoSub: { fontSize: 11 },
    fondoValue: { fontSize: 19, fontWeight: '800', letterSpacing: -0.5, flexShrink: 0 },
  });
}
