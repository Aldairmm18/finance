import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart } from 'react-native-chart-kit';
import {
  loadDataMes,
  getCurrentMes,
  loadTransaccionesMes,
  aplicarTraspasoSobrante,
} from '../utils/storage';
import { formatCOP, computeTotals, mergeTransacciones } from '../utils/calculations';
import { MASTER_CATEGORIES, CATEGORY_COLORS, normalizeCategoria, getCategoryIcon } from '../utils/categoryTheme';
import { useTheme } from '../context/ThemeContext';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { supabase } from '../services/supabase';
import ExtraFABModal from '../components/ExtraFABModal';
import EditTransaccionModal from '../components/EditTransaccionModal';
import StatCard, { useCountUp } from '../components/StatCard';
import ChartCard from '../components/ChartCard';

const screenWidth = Dimensions.get('window').width;

// ─── EmptyState con icono + texto descriptivo ─────────────────────────────────
function EmptyState({ icon, text }) {
  const { colors: C } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 12 }}>
      <Ionicons name={icon} size={36} color={C.textMuted} style={{ marginBottom: 10 }} />
      <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

// ─── RecentTxRow: fila simple para transacciones recientes ────────────────
function RecentTxRow({ tx, onPress, onLongPress }) {
  const { colors: C } = useTheme();
  const isIngreso = tx.tipo === 'ingreso';
  const master = normalizeCategoria(tx.categoria);
  const label = master || (tx.categoria ? tx.categoria.charAt(0).toUpperCase() + tx.categoria.slice(1) : 'Otros');
  const dotColor = CATEGORY_COLORS[master] || (isIngreso ? C.teal : C.pink);
  const iconName = getCategoryIcon(master);
  const fecha = tx.fecha ? tx.fecha.slice(5).replace('-', '/') : '';
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: C.border }}
    >
      <Ionicons name={iconName} size={16} color={dotColor} style={{ marginRight: 10 }} />
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ fontSize: 13, color: C.text, fontWeight: '500' }} numberOfLines={1}>
          {tx.descripcion || label}
          {tx.es_extraordinario ? (
            <>
              {' '}
              <Ionicons name="flash" size={12} color={C.purple} />
            </>
          ) : null}
        </Text>
        <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
          {label} · {fecha}
        </Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '800', color: isIngreso ? C.teal : C.pink, flexShrink: 0 }}>
        {isIngreso ? '+' : '-'}{formatCOP(tx.monto || 0)}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function DashboardScreen() {
  const [totals, setTotals] = useState(null);
  const [extraordinarios, setExtraordinarios] = useState([]);
  const [extrasIngreso, setExtrasIngreso] = useState([]);
  const [transaccionesMes, setTransaccionesMes] = useState([]);
  const [focusKey, setFocusKey] = useState(0);
  const [fabVisible, setFabVisible] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('idle'); // 'idle' | 'synced' | 'error'
  const [editingTransaction, setEditingTransaction] = useState(null);
  const { colors: C, mode } = useTheme();

  const cardAnims = useRef([...Array(9)].map(() => new Animated.Value(0))).current;

  const reload = useCallback(async (isMounted) => {
    cardAnims.forEach(a => a.setValue(0));
    try {
      const mesActual = getCurrentMes();
      await aplicarTraspasoSobrante(mesActual);
      const [d, txs] = await Promise.all([loadDataMes(mesActual), loadTransaccionesMes()]);
      if (!isMounted?.current) return;
      const base = computeTotals(d);
      setTotals(mergeTransacciones(base, txs));
      setTransaccionesMes(txs || []);
      const extras = (txs || []).filter(tx => tx.es_extraordinario);
      setExtraordinarios(extras.filter(tx => tx.tipo === 'gasto'));
      setExtrasIngreso(extras.filter(tx => tx.tipo === 'ingreso'));
      setCloudStatus('synced');
      setFocusKey(k => k + 1);
      Animated.stagger(65, cardAnims.map(a =>
        Animated.timing(a, { toValue: 1, duration: 420, useNativeDriver: true })
      )).start();
    } catch {
      if (!isMounted?.current) return;
      setCloudStatus('error');
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const isMounted = { current: true };
    reload(isMounted);
    return () => { isMounted.current = false; };
  }, [reload]));

  const refreshExtras = useCallback(async () => {
    try {
      const txs = await loadTransaccionesMes();
      setTransaccionesMes(txs || []);
      const extras = (txs || []).filter(tx => tx.es_extraordinario);
      setExtraordinarios(extras.filter(tx => tx.tipo === 'gasto'));
      setExtrasIngreso(extras.filter(tx => tx.tipo === 'ingreso'));
    } catch {
      // silencioso
    }
  }, []);

  const abrirEdicion = useCallback((tx) => {
    if (!tx) return;
    setEditingTransaction(tx);
  }, []);

  const cerrarEdicion = useCallback(() => {
    setEditingTransaction(null);
  }, []);

  const eliminarTransaccion = useCallback(async (id) => {
    if (!id) return;
    try {
      if (!supabase) throw new Error('Sin conexión a Supabase');
      const { error } = await supabase.from('transacciones').delete().eq('id', id);
      if (error) throw error;
      await reload();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo eliminar el movimiento.');
    }
  }, [reload]);

  const confirmarEliminacion = useCallback((id) => {
    if (!id) return;
    Alert.alert(
      'Eliminar registro',
      '¿Estás seguro de que deseas eliminar este movimiento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => eliminarTransaccion(id) },
      ],
    );
  }, [eliminarTransaccion]);

  useRealtimeSync(reload);

  const s = useMemo(() => makeStyles(C), [C]);

  const recentTxs = useMemo(() => {
    return [...(transaccionesMes || [])]
      .sort((a, b) => (b?.fecha || '').localeCompare(a?.fecha || ''))
      .slice(0, 8);
  }, [transaccionesMes]);

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

  const CHART_PALETTE = mode === 'dark'
    ? ['#14B8A6','#E88C99','#9333EA','#F59E0B','#6B7A99','#2563EB','#10B981','#F97316','#EC4899','#8B5CF6']
    : ['#14B3A8','#E07A85','#9333EA','#D97706','#9CA3AF','#3B82F6','#059669','#EA580C','#DB2777','#7C3AED'];

  const gastosByMaster = MASTER_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {});
  for (const [k, v] of Object.entries(totals.gastosByCategory || {})) {
    const master = normalizeCategoria(k);
    gastosByMaster[master] = (gastosByMaster[master] || 0) + (Number(v) || 0);
  }
  const gastosChartData = MASTER_CATEGORIES
    .map((cat, i) => ({
      name: cat,
      population: Math.round(gastosByMaster[cat] || 0),
      color: CHART_PALETTE[i % CHART_PALETTE.length],
      legendFontColor: C.text,
      legendFontSize: 11,
    }))
    .filter(d => d.population > 0);

  const ingresosByMaster = MASTER_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {});
  for (const [k, v] of Object.entries(totals.ingresosBySource || {})) {
    const master = normalizeCategoria(k);
    ingresosByMaster[master] = (ingresosByMaster[master] || 0) + (Number(v) || 0);
  }
  const ingresosChartData = MASTER_CATEGORIES
    .map((cat, i) => ({
      name: cat,
      population: Math.round(ingresosByMaster[cat] || 0),
      color: CHART_PALETTE[i % CHART_PALETTE.length],
      legendFontColor: C.text,
      legendFontSize: 11,
    }))
    .filter(d => d.population > 0);

  const tipoGastoData = [
    { name: 'Esenciales', population: Math.round(totals.esencialesMonthly), color: C.teal, legendFontColor: C.text, legendFontSize: 11 },
    { name: 'No Esenciales', population: Math.round(totals.noEsencialesMonthly), color: C.pink, legendFontColor: C.text, legendFontSize: 11 },
    { name: 'Créditos', population: Math.round(totals.creditosMonthly), color: C.purple, legendFontColor: C.text, legendFontSize: 11 },
  ].filter(d => d.population > 0);

  const chartWidth = screenWidth - 64;
  const chartCfg = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: C.card,
    backgroundGradientTo: C.card,
    color: (opacity = 1) => `rgba(20, 184, 166, ${opacity})`,
    labelColor: () => C.textMuted,
    strokeWidth: 2,
    propsForLabels: { fontSize: 11 },
  };

  const mesActual = (() => {
    const str = new Date().toLocaleString('es-CO', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  })();

  const cloudDotColor = cloudStatus === 'synced' ? C.teal : cloudStatus === 'error' ? C.pink : C.border;

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
          {/* Hero number — flujo neto del mes */}
          {totals && (
            <View style={{ marginTop: 12, marginBottom: 4 }}>
              <Text style={{
                fontSize: 38,
                fontWeight: '900',
                color: totals.flujoCaja >= 0 ? C.teal : C.pink,
                letterSpacing: -1,
                lineHeight: 42,
              }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {formatCOP(totals.flujoCaja)}
              </Text>
              <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 }}>
                FLUJO NETO DEL MES
              </Text>
            </View>
          )}
          <View style={[s.headerDivider, { backgroundColor: C.border }]} />
        </View>

        <View style={s.row}>
          <StatCard label="Ingresos Mensuales" value={formatCOP(animIngresos)} sub={formatCOP(totals.ingresosAnual) + ' al año'} accentColor={C.teal} animVal={cardAnims[0]} half />
          <StatCard label="Gastos Mensuales" value={formatCOP(animGastos)} sub={formatCOP(totals.totalGastosAnual) + ' al año'} accentColor={C.pink} animVal={cardAnims[1]} half />
        </View>

        <View style={s.row}>
          <StatCard label="Flujo de Caja" value={formatCOP(animFlujo)} sub={formatCOP(totals.flujoCajaAnual) + ' al año'} accentColor={flujoCajaColor} animVal={cardAnims[2]} half />
          <StatCard label="Con Ahorro" value={formatCOP(animFlujoAhorro)} sub={formatCOP(totals.flujoCajaConAhorroAnual) + ' al año'} accentColor={flujoAhorroColor} animVal={cardAnims[3]} half />
        </View>

        <Animated.View style={[s.fondoCard, { backgroundColor: C.card, borderColor: C.border }, {
          opacity: cardAnims[4],
          transform: [{ translateY: cardAnims[4].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        }]}>
          <View style={[s.fondoAccent, { backgroundColor: C.purple }]} />
          <View style={s.fondoBody}>
            <View style={s.fondoLeft}>
              <Ionicons name="shield-checkmark-outline" size={22} color={C.purple} />
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

        {hasExtras && (
          <Animated.View style={[
            { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginBottom: 12 },
            {
              opacity: cardAnims[8],
              transform: [{ translateY: cardAnims[8].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            },
          ]}>
            <View style={{ height: 3, backgroundColor: C.pink }} />
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
                Extraordinarios del mes
              </Text>

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
                        {ex.descripcion || 'Sin descripción'}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.pink }}>
                        -{formatCOP(ex.monto || 0)}
                      </Text>
                    </View>
                  ))}
                  {hiddenGastos > 0 && (
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4, paddingLeft: 8 }}>
                      +{hiddenGastos} más
                    </Text>
                  )}
                </>
              )}

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
                        {ex.descripcion || 'Sin descripción'}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.teal }}>
                        +{formatCOP(ex.monto || 0)}
                      </Text>
                    </View>
                  ))}
                  {hiddenIngresos > 0 && (
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4, paddingLeft: 8 }}>
                      +{hiddenIngresos} más
                    </Text>
                  )}
                </>
              )}
            </View>
          </Animated.View>
        )}

        {recentTxs.length > 0 && (
          <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 12 }}>
            <View style={{ height: 3, backgroundColor: C.teal }} />
            <View style={{ padding: 16, paddingBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                Transacciones recientes
              </Text>
              <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
                {transaccionesMes.length} registradas este mes
              </Text>
              {recentTxs.map((tx, i) => (
                <RecentTxRow
                  key={tx.id ?? i}
                  tx={tx}
                  onPress={() => abrirEdicion(tx)}
                  onLongPress={() => confirmarEliminacion(tx.id)}
                />
              ))}
            </View>
          </View>
        )}

        <ChartCard title="Distribución de Gastos" accentColor={C.pink} animVal={cardAnims[5]}>
          {gastosChartData.length > 0 ? (
            <PieChart data={gastosChartData} width={chartWidth} height={200} chartConfig={chartCfg} accessor="population" backgroundColor="transparent" paddingLeft="15" absolute={false} />
          ) : <EmptyState icon="pie-chart-outline" text={'Ingresa tus gastos en\nPresupuesto para ver la gráfica'} />}
        </ChartCard>

        <ChartCard title="Fuentes de Ingreso" accentColor={C.teal} animVal={cardAnims[6]}>
          {ingresosChartData.length > 0 ? (
            <PieChart data={ingresosChartData} width={chartWidth} height={200} chartConfig={chartCfg} accessor="population" backgroundColor="transparent" paddingLeft="15" absolute={false} />
          ) : <EmptyState icon="trending-up-outline" text={'Ingresa tus fuentes de\ningreso en Presupuesto'} />}
        </ChartCard>

        <ChartCard title="Tipo de Gasto" accentColor={C.purple} animVal={cardAnims[7]}>
          {tipoGastoData.length > 0 ? (
            <PieChart data={tipoGastoData} width={chartWidth} height={200} chartConfig={chartCfg} accessor="population" backgroundColor="transparent" paddingLeft="15" absolute={false} />
          ) : <EmptyState icon="layers-outline" text={'Clasifica tus gastos como\nEsencial / No Esencial'} />}
        </ChartCard>

      </ScrollView>

      <EditTransaccionModal
        transaction={editingTransaction}
        onClose={cerrarEdicion}
        onUpdated={reload}
      />

      <TouchableOpacity
        onPress={() => setFabVisible(true)}
        style={{
          position: 'absolute',
          bottom: 28,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: C.teal,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: C.teal,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

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
    fondoLabel: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
    fondoSub: { fontSize: 11 },
    fondoValue: { fontSize: 19, fontWeight: '800', letterSpacing: -0.5, flexShrink: 0 },
  });
}
