import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadDataMes, getCurrentMes, loadTransaccionesMes, loadTransaccionesAnio } from '../utils/storage';
import { computeTotals, mergeTransacciones, formatCOP, toMonthly } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { supabase } from '../services/supabase';

// ─── Metadata de categorías ───────────────────────────────────────────────────

const CAT_META = {
  hogar: { label: 'Hogar', icon: '🏠', color: '#818cf8' },
  comida: { label: 'Comida', icon: '🍽️', color: '#2dd4bf' },
  transporte: { label: 'Transporte', icon: '🚗', color: '#f59e0b' },
  creditos: { label: 'Créditos', icon: '💳', color: '#f472b6' },
  entretenimiento: { label: 'Entretenimiento', icon: '🎉', color: '#60a5fa' },
  familia: { label: 'Familia', icon: '👨‍👩‍👧', color: '#34d399' },
};

const TIPO_LABELS = {
  hogar: 'Hogar',
  comida: 'Comida',
  transporte: 'Transporte',
  creditos: 'Créditos',
  entretenimiento: 'Entretenimiento',
  familia: 'Familia',
  salario: 'Salario',
  bonos: 'Bonos',
  comisiones: 'Comisiones',
  dividendos: 'Dividendos',
  ahorro: 'Ahorro',
  ingresos: 'Ingresos',
  otro: 'Otro',
  otros: 'Otros',
};

function mesLabel(mes) {
  const [y, m] = mes.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  const str = d.toLocaleString('es-CO', { month: 'long', year: 'numeric' });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ ratio, color }) {
  const { colors: C } = useTheme();
  const clamped = Math.min(ratio, 1);
  const barColor = ratio > 1 ? '#f472b6' : ratio > 0.8 ? '#f59e0b' : color;
  return (
    <View style={{ height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ height: 5, width: `${Math.round(clamped * 100)}%`, backgroundColor: barColor, borderRadius: 3 }} />
    </View>
  );
}

// ─── CategoryProgressCard ────────────────────────────────────────────────────

function CategoryProgressCard({ catKey, actual, planned, animVal }) {
  const { colors: C } = useTheme();
  const meta = CAT_META[catKey] || { label: catKey, icon: '•', color: C.purple };
  const ratio = planned > 0 ? actual / planned : actual > 0 ? 1.01 : 0;
  const pct = planned > 0 ? Math.round(ratio * 100) : null;
  const over = ratio > 1;
  const pctColor = over ? '#f472b6' : ratio > 0.8 ? '#f59e0b' : C.teal;

  const animStyle = animVal ? {
    opacity: animVal,
    transform: [{ translateY: animVal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  } : {};

  return (
    <Animated.View style={[
      { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8 },
      animStyle,
    ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 18, marginRight: 8 }}>{meta.icon}</Text>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: C.text }}>{meta.label}</Text>
        {pct !== null && (
          <View style={{
            backgroundColor: pctColor + '22',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: pctColor }}>{pct}%</Text>
          </View>
        )}
      </View>
      <ProgressBar ratio={ratio} color={meta.color} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 11, color: over ? '#f472b6' : C.textMuted }}>
          Gastado: <Text style={{ fontWeight: '700', color: over ? '#f472b6' : C.text }}>{formatCOP(actual)}</Text>
        </Text>
        {planned > 0 && (
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            Presup: <Text style={{ fontWeight: '600' }}>{formatCOP(planned)}</Text>
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

// ─── TxRow: fila de transacción ───────────────────────────────────────────────

function TxRow({ tx, onLongPress }) {
  const { colors: C } = useTheme();
  const isIngreso = tx.tipo === 'ingreso';
  const cat = TIPO_LABELS[tx.categoria] || (tx.categoria || 'Otro');
  const fecha = tx.fecha ? tx.fecha.slice(5) : '';  // MM-DD
  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderColor: C.border }}
    >
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ fontSize: 13, color: C.text, fontWeight: '500' }} numberOfLines={1}>
          {tx.descripcion || cat}
          {tx.es_extraordinario ? ' ⚡' : ''}
        </Text>
        <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{cat} · {fecha}</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '800', color: isIngreso ? C.teal : C.pink }}>
        {isIngreso ? '+' : '-'}{formatCOP(tx.monto || 0)}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export default function ResumenMesScreen() {
  const { colors: C } = useTheme();
  const [viewMode, setViewMode] = useState('mes'); // 'mes' | 'anio'
  const [anioSelected, setAnioSelected] = useState(new Date().getFullYear());
  const currentYear = new Date().getFullYear();

  // ── Monthly state ──
  const [planned, setPlanned] = useState(null);
  const [actual, setActual] = useState(null);
  const [txs, setTxs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('idle');

  // ── Annual state ──
  const [anioTxs, setAnioTxs] = useState([]);
  const [anioLoading, setAnioLoading] = useState(false);

  // ── Historic annual modal state ──
  const [historicoVisible, setHistoricoVisible] = useState(false);
  const [historicoYear, setHistoricoYear] = useState(currentYear - 1);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoStats, setHistoricoStats] = useState(null);

  const cardAnims = useRef([...Array(8)].map(() => new Animated.Value(0))).current;

  const mes = getCurrentMes();

  // ── Load monthly data ──
  const loadAll = useCallback(async () => {
    cardAnims.forEach(a => a.setValue(0));
    try {
      const [d, transactions] = await Promise.all([
        loadDataMes(mes),
        loadTransaccionesMes(),
      ]);
      const base = computeTotals(d);
      const merged = mergeTransacciones(base, transactions);
      setPlanned(base);
      setActual(merged);
      setTxs(transactions || []);
      setCloudStatus('synced');
      Animated.stagger(50, cardAnims.map(a =>
        Animated.timing(a, { toValue: 1, duration: 380, useNativeDriver: true })
      )).start();
    } catch {
      setCloudStatus('error');
    }
  }, []);

  // ── Load annual data ──
  const loadAnio = useCallback(async (year) => {
    setAnioLoading(true);
    try {
      const data = await loadTransaccionesAnio(year);
      setAnioTxs(data || []);
    } catch {
      setAnioTxs([]);
    } finally {
      setAnioLoading(false);
    }
  }, []);

  const eliminarTransaccion = useCallback(async (id) => {
    if (!id) return;
    if (!supabase) throw new Error('Sin conexión a Supabase');
    const { error } = await supabase.from('transacciones').delete().eq('id', id);
    if (error) throw error;
    await loadAll();
  }, [loadAll]);

  const confirmarEliminacion = useCallback((id) => {
    if (!id) return;
    Alert.alert(
      'Eliminar registro',
      '¿Estás seguro de que deseas eliminar este movimiento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarTransaccion(id);
            } catch (e) {
              Alert.alert('Error', e?.message || 'No se pudo eliminar el movimiento.');
            }
          },
        },
      ],
    );
  }, [eliminarTransaccion]);

  // ── Historic annual aggregation (by month) ──
  const loadHistorico = useCallback(async (year) => {
    setHistoricoLoading(true);
    try {
      let totalIngresos = 0;
      let totalGastos = 0;
      for (let m = 1; m <= 12; m += 1) {
        const mesKey = `${year}-${String(m).padStart(2, '0')}`;
        const [d, transactions] = await Promise.all([
          loadDataMes(mesKey),
          loadTransaccionesMes(mesKey),
        ]);
        const base = computeTotals(d);
        const merged = mergeTransacciones(base, transactions);
        totalIngresos += merged?.ingresosMonthly || 0;
        totalGastos += merged?.totalGastosMonthly || 0;
      }
      setHistoricoStats({
        totalIngresos,
        totalGastos,
        balance: totalIngresos - totalGastos,
      });
    } catch {
      setHistoricoStats(null);
    } finally {
      setHistoricoLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (viewMode === 'mes') loadAll();
    else loadAnio(anioSelected);
  }, [loadAll, loadAnio, viewMode, anioSelected]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (viewMode === 'mes') await loadAll();
    else await loadAnio(anioSelected);
    setRefreshing(false);
  }, [loadAll, loadAnio, viewMode, anioSelected]);

  useRealtimeSync(loadAll);

  // ── Annual aggregation ──
  const anioStats = useMemo(() => {
    if (anioTxs.length === 0) return null;
    let totalGastos = 0;
    let totalIngresos = 0;
    const gastoByCat = {};
    const monthlyGastos = new Array(12).fill(0);
    const monthlyIngresos = new Array(12).fill(0);

    for (const tx of anioTxs) {
      const m = tx.monto || 0;
      const monthIdx = tx.fecha ? parseInt(tx.fecha.split('-')[1], 10) - 1 : 0;
      if (tx.tipo === 'ingreso') {
        totalIngresos += m;
        monthlyIngresos[monthIdx] += m;
      } else {
        totalGastos += m;
        const cat = tx.categoria || 'otro';
        gastoByCat[cat] = (gastoByCat[cat] || 0) + m;
        monthlyGastos[monthIdx] += m;
      }
    }

    return {
      totalGastos, totalIngresos,
      balance: totalIngresos - totalGastos,
      gastoByCat,
      monthlyGastos, monthlyIngresos,
      txCount: anioTxs.length,
    };
  }, [anioTxs]);

  // ── Loading state ──
  if (viewMode === 'mes' && !actual) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.teal} size="small" />
        <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 12 }}>Cargando...</Text>
      </View>
    );
  }

  const cloudDotColor = cloudStatus === 'synced' ? '#34d399' : cloudStatus === 'error' ? '#f472b6' : C.border;
  const historicoMaxYear = currentYear - 1;
  const historicoMinYear = 2000;
  const historicoHasPastYears = historicoMaxYear >= historicoMinYear;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: 52, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
    >
      {/* ── Header ── */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: C.text, letterSpacing: -0.5 }}>
            Resumen
          </Text>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: cloudDotColor, marginTop: 4 }} />
        </View>
        <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 4, fontWeight: '500' }}>
          {viewMode === 'mes' ? mesLabel(mes) : `Año ${anioSelected}`}
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (!historicoHasPastYears) return;
            setHistoricoVisible(true);
            const safeYear = Math.min(historicoMaxYear, Math.max(historicoMinYear, historicoYear));
            if (safeYear !== historicoYear) setHistoricoYear(safeYear);
            loadHistorico(safeYear);
          }}
          disabled={!historicoHasPastYears}
          style={{
            alignSelf: 'flex-start',
            marginTop: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: C.border,
            backgroundColor: C.card,
            opacity: historicoHasPastYears ? 1 : 0.5,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.textMuted }}>
            Ver Histórico Anual
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── View mode toggle ── */}
      <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: 'hidden' }}>
        {[{ key: 'mes', label: 'Mes actual' }, { key: 'anio', label: 'Histórico anual' }].map(opt => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setViewMode(opt.key)}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: viewMode === opt.key ? C.teal : 'transparent',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: viewMode === opt.key ? '#fff' : C.textMuted }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── ANNUAL VIEW ── */}
      {viewMode === 'anio' && (
        <>
          {/* Year navigation */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 8, paddingHorizontal: 6, marginBottom: 16 }}>
            <TouchableOpacity onPress={() => setAnioSelected(y => y - 1)} style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ fontSize: 18, color: C.textMuted }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>{anioSelected}</Text>
            <TouchableOpacity onPress={() => setAnioSelected(y => y + 1)} style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ fontSize: 18, color: C.textMuted }}>›</Text>
            </TouchableOpacity>
          </View>

          {anioLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator color={C.teal} size="small" />
              <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 12 }}>Cargando año {anioSelected}...</Text>
            </View>
          ) : !anioStats ? (
            <View style={{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 28, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>📊</Text>
              <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center' }}>
                Sin transacciones registradas en {anioSelected}
              </Text>
            </View>
          ) : (
            <>
              {/* Annual totals */}
              <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 12 }}>
                <View style={{ height: 3, backgroundColor: anioStats.balance >= 0 ? C.teal : C.pink }} />
                <View style={{ flexDirection: 'row', padding: 16 }}>
                  <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: C.border }}>
                    <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>Ingresos</Text>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: C.teal }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {formatCOP(anioStats.totalIngresos)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: C.border }}>
                    <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>Gastos</Text>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: C.pink }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {formatCOP(anioStats.totalGastos)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>Balance</Text>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: anioStats.balance >= 0 ? C.teal : C.pink }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {formatCOP(anioStats.balance)}
                    </Text>
                  </View>
                </View>
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  <Text style={{ fontSize: 11, color: C.textMuted, textAlign: 'center' }}>
                    {anioStats.txCount} transacciones en {anioSelected}
                  </Text>
                </View>
              </View>

              {/* Category breakdown */}
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 }}>
                Gastos por categoría
              </Text>
              {Object.entries(anioStats.gastoByCat)
                .sort(([, a], [, b]) => b - a)
                .map(([catKey, amount]) => {
                  const meta = CAT_META[catKey] || { label: catKey, icon: '•', color: C.purple };
                  const pct = anioStats.totalGastos > 0 ? Math.round((amount / anioStats.totalGastos) * 100) : 0;
                  return (
                    <View key={catKey} style={{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 18, marginRight: 8 }}>{meta.icon}</Text>
                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: C.text }}>{meta.label}</Text>
                        <View style={{ backgroundColor: (meta.color || C.purple) + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: meta.color || C.purple }}>{pct}%</Text>
                        </View>
                      </View>
                      <View style={{ height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
                        <View style={{ height: 5, width: `${pct}%`, backgroundColor: meta.color || C.purple, borderRadius: 3 }} />
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 6 }}>
                        {formatCOP(amount)}
                      </Text>
                    </View>
                  );
                })}

              {/* Monthly comparison bars */}
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, marginTop: 16 }}>
                Comparación mensual
              </Text>
              <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 8 }}>
                {(() => {
                  const maxVal = Math.max(...anioStats.monthlyGastos, ...anioStats.monthlyIngresos, 1);
                  return MONTH_NAMES.map((name, idx) => {
                    const g = anioStats.monthlyGastos[idx];
                    const ing = anioStats.monthlyIngresos[idx];
                    if (g === 0 && ing === 0) return null;
                    return (
                      <View key={idx} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: C.text }}>{name}</Text>
                          <Text style={{ fontSize: 11, color: C.textMuted }}>
                            Bal: <Text style={{ fontWeight: '700', color: ing - g >= 0 ? C.teal : C.pink }}>{formatCOP(ing - g)}</Text>
                          </Text>
                        </View>
                        <View style={{ height: 4, backgroundColor: C.teal + '40', borderRadius: 2, overflow: 'hidden', marginBottom: 2 }}>
                          <View style={{ height: 4, width: `${Math.round((ing / maxVal) * 100)}%`, backgroundColor: C.teal, borderRadius: 2 }} />
                        </View>
                        <View style={{ height: 4, backgroundColor: C.pink + '40', borderRadius: 2, overflow: 'hidden' }}>
                          <View style={{ height: 4, width: `${Math.round((g / maxVal) * 100)}%`, backgroundColor: C.pink, borderRadius: 2 }} />
                        </View>
                      </View>
                    );
                  });
                })()}
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 10, height: 4, borderRadius: 2, backgroundColor: C.teal }} />
                    <Text style={{ fontSize: 10, color: C.textMuted }}>Ingresos</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 10, height: 4, borderRadius: 2, backgroundColor: C.pink }} />
                    <Text style={{ fontSize: 10, color: C.textMuted }}>Gastos</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </>
      )}

      {/* ── MONTHLY VIEW (original) ── */}
      {viewMode === 'mes' && actual && (
        <>
          <View style={{ height: 1, backgroundColor: C.border, marginBottom: 20 }} />

          {/* ── Totales principales ── */}
          <Animated.View style={{
            opacity: cardAnims[0],
            transform: [{ translateY: cardAnims[0].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            backgroundColor: C.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.border,
            overflow: 'hidden',
            marginBottom: 12,
          }}>
            <View style={{ height: 3, backgroundColor: (actual.ingresosMonthly - actual.totalGastosMonthly) >= 0 ? C.teal : C.pink }} />
            <View style={{ flexDirection: 'row', padding: 16, gap: 0 }}>
              <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: C.border }}>
                <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>Ingresos</Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: C.teal }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatCOP(actual.ingresosMonthly)}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: C.border }}>
                <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>Gastos</Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: C.pink }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatCOP(actual.totalGastosMonthly)}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>Balance</Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: (actual.ingresosMonthly - actual.totalGastosMonthly) >= 0 ? C.teal : C.pink }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatCOP(actual.ingresosMonthly - actual.totalGastosMonthly)}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* ── Tipo de gasto ── */}
          <Animated.View style={{
            opacity: cardAnims[1],
            transform: [{ translateY: cardAnims[1].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            backgroundColor: C.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.border,
            overflow: 'hidden',
            marginBottom: 20,
          }}>
            <View style={{ height: 3, backgroundColor: C.purple }} />
            <View style={{ flexDirection: 'row', padding: 14, gap: 0 }}>
              {[
                { label: 'Esenciales', val: actual.esencialesMonthly, color: C.teal },
                { label: 'No Esenciales', val: actual.noEsencialesMonthly, color: C.pink },
                { label: 'Créditos', val: actual.creditosMonthly, color: C.purple },
              ].map((item, i) => (
                <View key={item.label} style={{ flex: 1, alignItems: 'center', borderRightWidth: i < 2 ? 1 : 0, borderColor: C.border }}>
                  <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 5, textAlign: 'center' }}>{item.label}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: item.color }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {formatCOP(item.val)}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ── Progreso por categoría ── */}
          <Animated.View style={{
            opacity: cardAnims[2],
            transform: [{ translateY: cardAnims[2].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            marginBottom: 8,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
              Progreso por categoría
            </Text>
          </Animated.View>

          {(() => {
            const catEntries = Object.keys(CAT_META).map(k => ({
              key: k,
              actual: actual.gastosByCategory[k] || 0,
              planned: planned?.gastosByCategory[k] || 0,
            })).filter(e => e.actual > 0 || e.planned > 0);

            return catEntries.length === 0 ? (
              <Animated.View style={{
                opacity: cardAnims[3],
                backgroundColor: C.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: C.border,
                padding: 28,
                alignItems: 'center',
                marginBottom: 20,
              }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>📊</Text>
                <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center' }}>
                  {'Aún no hay transacciones ni\npresupuesto registrados este mes'}
                </Text>
              </Animated.View>
            ) : (
              catEntries.map((e, i) => (
                <CategoryProgressCard key={e.key} catKey={e.key} actual={e.actual} planned={e.planned} animVal={cardAnims[Math.min(3 + i, 7)]} />
              ))
            );
          })()}

          {/* ── Últimas transacciones ── */}
          {(() => {
            const recentTxs = [...txs].sort((a, b) => b.fecha?.localeCompare(a.fecha)).slice(0, 12);
            return recentTxs.length > 0 ? (
              <Animated.View style={{
                opacity: cardAnims[7],
                transform: [{ translateY: cardAnims[7].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                backgroundColor: C.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: C.border,
                overflow: 'hidden',
                marginTop: 8,
                marginBottom: 8,
              }}>
                <View style={{ height: 3, backgroundColor: C.teal }} />
                <View style={{ padding: 16 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                    Últimas transacciones
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
                    {txs.length} registradas este mes
                  </Text>
                  {recentTxs.map((tx, i) => (
                    <TxRow key={tx.id ?? i} tx={tx} onLongPress={() => confirmarEliminacion(tx.id)} />
                  ))}
                </View>
              </Animated.View>
            ) : null;
          })()}
        </>
      )}

      {/* ── Modal Histórico Anual (consolidado por meses) ── */}
      <Modal
        visible={historicoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoricoVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 18 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>
                Histórico Anual
              </Text>
              <TouchableOpacity onPress={() => setHistoricoVisible(false)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 18, color: C.textMuted }}>x</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
              Selecciona un año pasado
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 8, paddingHorizontal: 6, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  const next = Math.max(historicoMinYear, historicoYear - 1);
                  setHistoricoYear(next);
                  loadHistorico(next);
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 18, color: C.textMuted }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>{historicoYear}</Text>
              <TouchableOpacity
                onPress={() => {
                  const next = Math.min(historicoMaxYear, historicoYear + 1);
                  if (next === historicoYear) return;
                  setHistoricoYear(next);
                  loadHistorico(next);
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 6 }}
                disabled={historicoYear >= historicoMaxYear}
              >
                <Text style={{ fontSize: 18, color: historicoYear >= historicoMaxYear ? C.border : C.textMuted }}>›</Text>
              </TouchableOpacity>
            </View>

            {historicoLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                <ActivityIndicator color={C.teal} size="small" />
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 10 }}>Calculando...</Text>
              </View>
            ) : (historicoStats && (historicoStats.totalIngresos > 0 || historicoStats.totalGastos > 0)) ? (
              <View style={{ backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
                <View style={{ height: 3, backgroundColor: (historicoStats?.balance ?? 0) >= 0 ? C.teal : C.pink }} />
                <View style={{ flexDirection: 'row', padding: 14 }}>
                  <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: C.border }}>
                    <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>Ingresos</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: C.teal }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {formatCOP(historicoStats?.totalIngresos || 0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: C.border }}>
                    <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>Gastos</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: C.pink }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {formatCOP(historicoStats?.totalGastos || 0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 }}>Balance</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: (historicoStats?.balance ?? 0) >= 0 ? C.teal : C.pink }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {formatCOP(historicoStats?.balance || 0)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 22, alignItems: 'center' }}>
                <Text style={{ fontSize: 26, marginBottom: 8 }}>📭</Text>
                <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center' }}>
                  Sin registros para {historicoYear}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
