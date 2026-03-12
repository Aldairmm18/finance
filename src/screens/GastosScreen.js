import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart } from 'react-native-chart-kit';
import { loadTransaccionesMes, getCurrentMes } from '../utils/storage';
import { formatCOP } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { supabase } from '../services/supabase';

const screenWidth = Dimensions.get('window').width;
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ─── Metadata ─────────────────────────────────────────────────────────────────

const CAT_META = {
  hogar: { label: 'Hogar', color: '#818cf8' },
  comida: { label: 'Comida', color: '#2dd4bf' },
  transporte: { label: 'Transporte', color: '#f59e0b' },
  creditos: { label: 'Créditos', color: '#f472b6' },
  entretenimiento: { label: 'Entretenimiento', color: '#60a5fa' },
  familia: { label: 'Familia', color: '#34d399' },
  salario: { label: 'Salario', color: '#2dd4bf' },
  bonos: { label: 'Bonos', color: '#818cf8' },
  comisiones: { label: 'Comisiones', color: '#60a5fa' },
  dividendos: { label: 'Dividendos', color: '#f472b6' },
  ahorro: { label: 'Ahorro', color: '#fbbf24' },
  ingresos: { label: 'Ingresos', color: '#2dd4bf' },
  otro: { label: 'Otro', color: '#94a3b8' },
  otros: { label: 'Otros', color: '#94a3b8' },
};

function catLabel(k) { return CAT_META[k]?.label || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Otro'); }
function catColor(k) { return CAT_META[k]?.color || '#94a3b8'; }

function mesLabel(mes) {
  const [y, m] = mes.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  const str = d.toLocaleString('es-CO', { month: 'long', year: 'numeric' });
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function addMes(mes, delta) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── TxRow ────────────────────────────────────────────────────────────────────

function TxRow({ tx, animVal, onLongPress }) {
  const { colors: C } = useTheme();
  const isIngreso = tx.tipo === 'ingreso';
  const fecha = tx.fecha ? tx.fecha.slice(5).replace('-', '/') : '';
  const animStyle = animVal ? {
    opacity: animVal,
    transform: [{ translateY: animVal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  } : {};
  return (
    <AnimatedTouchable
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={[
        { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderColor: C.border },
        animStyle,
      ]}
    >
      {/* Color dot */}
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: catColor(tx.categoria), marginRight: 10, flexShrink: 0 }} />
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ fontSize: 13, color: C.text, fontWeight: '500' }} numberOfLines={1}>
          {tx.descripcion || catLabel(tx.categoria)}
          {tx.es_extraordinario ? ' ⚡' : ''}
        </Text>
        <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
          {catLabel(tx.categoria)}{tx.subcategoria && tx.subcategoria !== 'otro' && tx.subcategoria !== tx.categoria ? ` · ${tx.subcategoria}` : ''} · {fecha}
        </Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '800', color: isIngreso ? C.teal : C.pink, flexShrink: 0 }}>
        {isIngreso ? '+' : '-'}{formatCOP(tx.monto || 0)}
      </Text>
    </AnimatedTouchable>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function GastosScreen() {
  const { colors: C } = useTheme();
  const [mes, setMes] = useState(getCurrentMes);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tipoFiltro, setTipoFiltro] = useState('todos');   // 'todos' | 'gasto' | 'ingreso'
  const [catFiltro, setCatFiltro] = useState('todos');
  const [search, setSearch] = useState('');

  const listAnims = useRef([...Array(30)].map(() => new Animated.Value(0))).current;

  const currentMes = getCurrentMes();

  const loadAll = useCallback(async () => {
    listAnims.forEach(a => a.setValue(0));
    try {
      const data = await loadTransaccionesMes(mes);
      setTxs(data || []);
      Animated.stagger(30, listAnims.slice(0, Math.min((data || []).length, 30)).map(a =>
        Animated.timing(a, { toValue: 1, duration: 280, useNativeDriver: true })
      )).start();
    } catch {
      setTxs([]);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  const eliminarTransaccion = useCallback(async (id) => {
    if (!id) return;
    if (!supabase) throw new Error('Sin conexión a Supabase');
    const { error } = await supabase.from('transacciones').delete().eq('id', id);
    if (error) throw error;
    setTxs(prev => prev.filter(tx => tx.id !== id));
  }, []);

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

  useFocusEffect(useCallback(() => {
    setLoading(true);
    setTxs([]);
    loadAll();
  }, [loadAll]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  useRealtimeSync(useCallback(async () => {
    if (mes === currentMes) await loadAll();
  }, [loadAll, mes, currentMes]));

  // ── Filtros ──
  const filtered = useMemo(() => {
    let list = txs;
    if (tipoFiltro !== 'todos') list = list.filter(tx => tx.tipo === tipoFiltro);
    if (catFiltro !== 'todos') list = list.filter(tx => tx.categoria === catFiltro);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(tx =>
        (tx.descripcion || '').toLowerCase().includes(q) ||
        (tx.categoria || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [txs, tipoFiltro, catFiltro, search]);

  // ── Totales del filtro ──
  const totalGastos = filtered.filter(tx => tx.tipo === 'gasto').reduce((s, tx) => s + (tx.monto || 0), 0);
  const totalIngresos = filtered.filter(tx => tx.tipo === 'ingreso').reduce((s, tx) => s + (tx.monto || 0), 0);

  // ── Categorías disponibles en las transacciones del mes ──
  const cats = useMemo(() => {
    const set = new Set(txs.map(tx => tx.categoria).filter(Boolean));
    return Array.from(set);
  }, [txs]);

  // ── PieChart data (solo gastos filtrados, excluyendo ingresos) ──
  const chartCfg = {
    backgroundColor: C.card,
    backgroundGradientFrom: C.card,
    backgroundGradientTo: C.card,
    color: () => 'rgba(128,128,128,0.4)',
  };

  const pieData = useMemo(() => {
    const gastos = filtered.filter(tx => tx.tipo === 'gasto');
    const bycat = {};
    for (const tx of gastos) {
      const k = tx.categoria || 'otro';
      bycat[k] = (bycat[k] || 0) + (tx.monto || 0);
    }
    return Object.entries(bycat)
      .map(([k, v]) => ({ name: catLabel(k), population: Math.round(v), color: catColor(k), legendFontColor: C.text, legendFontSize: 11 }))
      .filter(d => d.population > 0)
      .sort((a, b) => b.population - a.population);
  }, [filtered]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.teal} size="small" />
        <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 12 }}>Cargando...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: 52, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
    >
      {/* ── Header ── */}
      <Text style={{ fontSize: 32, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginBottom: 6 }}>
        Gastos
      </Text>

      {/* ── Selector de mes ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 8, paddingHorizontal: 4, marginBottom: 16 }}>
        <TouchableOpacity onPress={() => { setLoading(true); setMes(m => addMes(m, -1)); }} style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ fontSize: 18, color: C.textMuted }}>‹</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{mesLabel(mes)}</Text>
          <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{txs.length} transacciones</Text>
        </View>
        <TouchableOpacity onPress={() => { setLoading(true); setMes(m => addMes(m, 1)); }} style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ fontSize: 18, color: C.textMuted }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Buscador ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, marginBottom: 12 }}>
        <Text style={{ color: C.textMuted, marginRight: 8, fontSize: 14 }}>🔍</Text>
        <TextInput
          style={{ flex: 1, color: C.text, fontSize: 14, paddingVertical: 10 }}
          placeholder="Buscar descripción o categoría..."
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={{ paddingLeft: 8 }}>
            <Text style={{ color: C.textMuted, fontSize: 16 }}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filtro por tipo ── */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        {[
          { key: 'todos', label: 'Todos', color: C.purple },
          { key: 'gasto', label: 'Gastos', color: C.pink },
          { key: 'ingreso', label: 'Ingresos', color: C.teal },
        ].map(opt => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setTipoFiltro(opt.key)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: tipoFiltro === opt.key ? opt.color : C.card,
              borderWidth: 1,
              borderColor: tipoFiltro === opt.key ? opt.color : C.border,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: tipoFiltro === opt.key ? '#fff' : C.textMuted }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Filtro por categoría ── */}
      {cats.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 6, paddingRight: 8 }}>
            <TouchableOpacity
              onPress={() => setCatFiltro('todos')}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: catFiltro === 'todos' ? C.textMuted : C.card, borderWidth: 1, borderColor: catFiltro === 'todos' ? C.textMuted : C.border }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: catFiltro === 'todos' ? '#fff' : C.textMuted }}>Todas</Text>
            </TouchableOpacity>
            {cats.map(k => (
              <TouchableOpacity
                key={k}
                onPress={() => setCatFiltro(k)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: catFiltro === k ? catColor(k) : C.card, borderWidth: 1, borderColor: catFiltro === k ? catColor(k) : C.border }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: catFiltro === k ? '#fff' : C.textMuted }}>{catLabel(k)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Resumen del filtro ── */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {totalGastos > 0 && (
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, overflow: 'hidden' }}>
            <View style={{ height: 3, backgroundColor: C.pink, position: 'absolute', top: 0, left: 0, right: 0 }} />
            <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Gastos</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.pink }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatCOP(totalGastos)}</Text>
          </View>
        )}
        {totalIngresos > 0 && (
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, overflow: 'hidden' }}>
            <View style={{ height: 3, backgroundColor: C.teal, position: 'absolute', top: 0, left: 0, right: 0 }} />
            <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Ingresos</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.teal }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatCOP(totalIngresos)}</Text>
          </View>
        )}
        <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, overflow: 'hidden' }}>
          <View style={{ height: 3, backgroundColor: C.purple, position: 'absolute', top: 0, left: 0, right: 0 }} />
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Registros</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.purple }}>{filtered.length}</Text>
        </View>
      </View>

      {/* ── Gráfica de gastos por categoría ── */}
      {pieData.length > 0 && tipoFiltro !== 'ingreso' && (
        <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 16 }}>
          <View style={{ height: 3, backgroundColor: C.pink }} />
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
              Por categoría
            </Text>
            <PieChart
              data={pieData}
              width={screenWidth - 64}
              height={180}
              chartConfig={{
                backgroundColor: C.card,
                backgroundGradientFrom: C.card,
                backgroundGradientTo: C.card,
                color: () => 'rgba(128,128,128,0.4)',
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute={false}
            />
          </View>
        </View>
      )}

      {/* ── Lista de transacciones ── */}
      <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 8 }}>
        <View style={{ height: 3, backgroundColor: C.teal }} />
        <View style={{ padding: 16, paddingBottom: filtered.length === 0 ? 16 : 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
            Transacciones{search || catFiltro !== 'todos' || tipoFiltro !== 'todos' ? ' (filtradas)' : ''}
          </Text>

          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🔍</Text>
              <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center' }}>
                {txs.length === 0
                  ? 'Sin transacciones este mes.\nUsa el bot de Telegram o el\nbotón + del Dashboard.'
                  : 'Sin resultados con estos filtros.'}
              </Text>
            </View>
          ) : (
            filtered.map((tx, i) => (
              <TxRow
                key={tx.id ?? i}
                tx={tx}
                animVal={listAnims[i] || null}
                onLongPress={() => confirmarEliminacion(tx.id)}
              />
            ))
          )}
        </View>
      </View>

    </ScrollView>
  );
}
