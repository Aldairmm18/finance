import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadDataMes, getCurrentMes, loadTransaccionesMes } from '../utils/storage';
import { computeTotals, mergeTransacciones, formatCOP, toMonthly } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

// ─── Metadata de categorías ───────────────────────────────────────────────────

const CAT_META = {
  hogar:           { label: 'Hogar',           icon: '🏠', color: '#818cf8' },
  comida:          { label: 'Comida',           icon: '🍽️', color: '#2dd4bf' },
  transporte:      { label: 'Transporte',       icon: '🚗', color: '#f59e0b' },
  creditos:        { label: 'Créditos',         icon: '💳', color: '#f472b6' },
  entretenimiento: { label: 'Entretenimiento',  icon: '🎉', color: '#60a5fa' },
  familia:         { label: 'Familia',          icon: '👨‍👩‍👧', color: '#34d399' },
};

const TIPO_LABELS = {
  hogar:           'Hogar',
  comida:          'Comida',
  transporte:      'Transporte',
  creditos:        'Créditos',
  entretenimiento: 'Entretenimiento',
  familia:         'Familia',
  ingresos:        'Ingresos',
  otro:            'Otro',
  otros:           'Otros',
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
  const meta    = CAT_META[catKey] || { label: catKey, icon: '•', color: C.purple };
  const ratio   = planned > 0 ? actual / planned : actual > 0 ? 1.01 : 0;
  const pct     = planned > 0 ? Math.round(ratio * 100) : null;
  const over    = ratio > 1;
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

function TxRow({ tx }) {
  const { colors: C } = useTheme();
  const isIngreso = tx.tipo === 'ingreso';
  const cat  = TIPO_LABELS[tx.categoria] || (tx.categoria || 'Otro');
  const fecha = tx.fecha ? tx.fecha.slice(5) : '';  // MM-DD
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderColor: C.border }}>
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
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ResumenMesScreen() {
  const { colors: C } = useTheme();
  const [planned, setPlanned]   = useState(null);  // totals from budget
  const [actual, setActual]     = useState(null);   // totals after merge
  const [txs, setTxs]           = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('idle');

  const cardAnims = useRef([...Array(8)].map(() => new Animated.Value(0))).current;

  const mes = getCurrentMes();

  const loadAll = useCallback(async () => {
    cardAnims.forEach(a => a.setValue(0));
    try {
      const [d, transactions] = await Promise.all([
        loadDataMes(mes),
        loadTransaccionesMes(),
      ]);
      const base    = computeTotals(d);
      const merged  = mergeTransacciones(base, transactions);
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

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  useRealtimeSync(loadAll);

  if (!actual) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.teal} size="small" />
        <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 12 }}>Cargando...</Text>
      </View>
    );
  }

  const cloudDotColor = cloudStatus === 'synced' ? '#34d399' : cloudStatus === 'error' ? '#f472b6' : C.border;

  // Balance
  const balance   = actual.ingresosMonthly - actual.totalGastosMonthly;
  const balColor  = balance >= 0 ? C.teal : C.pink;

  // Categorías con actividad o presupuesto
  const catEntries = Object.keys(CAT_META).map(k => ({
    key:     k,
    actual:  actual.gastosByCategory[k]  || 0,
    planned: planned.gastosByCategory[k] || 0,
  })).filter(e => e.actual > 0 || e.planned > 0);

  // Transacciones recientes (últimas 12)
  const recentTxs = [...txs].sort((a, b) => b.fecha?.localeCompare(a.fecha)).slice(0, 12);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: 52, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
    >
      {/* ── Header ── */}
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: C.text, letterSpacing: -0.5 }}>
            Resumen
          </Text>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: cloudDotColor, marginTop: 4 }} />
        </View>
        <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 4, fontWeight: '500' }}>
          {mesLabel(mes)}
        </Text>
        <View style={{ height: 1, backgroundColor: C.border, marginTop: 18 }} />
      </View>

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
        <View style={{ height: 3, backgroundColor: balColor }} />
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
            <Text style={{ fontSize: 17, fontWeight: '800', color: balColor }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatCOP(balance)}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Tipo de gasto (esenciales / no esenciales / créditos) ── */}
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
            { label: 'Esenciales',    val: actual.esencialesMonthly,   color: C.teal   },
            { label: 'No Esenciales', val: actual.noEsencialesMonthly, color: C.pink   },
            { label: 'Créditos',      val: actual.creditosMonthly,     color: C.purple },
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

      {catEntries.length === 0 ? (
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
      )}

      {/* ── Últimas transacciones ── */}
      {recentTxs.length > 0 && (
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
              <TxRow key={tx.id ?? i} tx={tx} />
            ))}
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}
