import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, SectionList, ScrollView, TextInput, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useMonthData } from '../hooks/useMonthData';
import { useTransactionSheet } from '../components/TransactionSheet';
import TransactionRow from '../components/TransactionRow';
import { Txt, Money, Chip, MonthSwitcher, EmptyState, Divider } from '../components/ui';
import { normalizeCategory, categoryLabel } from '../utils/categories';
import { getCurrentMes, dayLabel } from '../utils/dateUtils';
import { SPACE, RADIUS } from '../theme/tokens';

const TIPOS = [
  { key: 'todos', label: 'Todos' },
  { key: 'gasto', label: 'Gastos' },
  { key: 'ingreso', label: 'Ingresos' },
];

export default function MovementsScreen() {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();
  const { openEdit, openNew } = useTransactionSheet();
  const currentMes = getCurrentMes();
  const [mes, setMes] = useState(currentMes);
  const { txs, status, reload, loaded } = useMonthData(mes, { withPlan: false });
  const [refreshing, setRefreshing] = useState(false);
  const [tipo, setTipo] = useState('todos');
  const [cat, setCat] = useState('todas');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Al cambiar de mes, el filtro de categoría puede no existir en el nuevo mes.
  useEffect(() => { setCat('todas'); }, [mes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  const categoriesInMonth = useMemo(() => {
    const keys = new Set(txs.map(tx => normalizeCategory(tx.categoria)));
    return Array.from(keys).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
  }, [txs]);

  const filtered = useMemo(() => txs.filter(tx => {
    if (tipo !== 'todos' && tx.tipo !== tipo) return false;
    if (cat !== 'todas' && normalizeCategory(tx.categoria) !== cat) return false;
    if (search) {
      const haystack = `${tx.descripcion || ''} ${categoryLabel(tx.categoria)}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }), [txs, tipo, cat, search]);

  const totals = useMemo(() => filtered.reduce((acc, tx) => {
    const m = Number(tx.monto) || 0;
    if (tx.tipo === 'ingreso') acc.ingresos += m; else acc.gastos += m;
    return acc;
  }, { ingresos: 0, gastos: 0 }), [filtered]);

  const sections = useMemo(() => {
    const byDay = new Map();
    for (const tx of filtered) {
      const key = tx.fecha || '';
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(tx);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([fecha, data]) => ({ title: dayLabel(fecha), data }));
  }, [filtered]);

  const filtering = tipo !== 'todos' || cat !== 'todas' || !!search;

  const header = (
    <View style={{ paddingTop: insets.top + SPACE.md }}>
      <Txt variant="title" accessibilityRole="header" style={{ marginBottom: SPACE.sm }}>Movimientos</Txt>
      <MonthSwitcher mes={mes} onChange={setMes} max={currentMes} />

      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
        backgroundColor: C.sunken, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, marginTop: SPACE.md,
      }}>
        <Ionicons name="search" size={18} color={C.textFaint} />
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Buscar por descripción o categoría"
          placeholderTextColor={C.textFaint}
          returnKeyType="search"
          accessibilityLabel="Buscar movimientos"
          style={{ flex: 1, minHeight: 44, fontSize: 16, color: C.text }}
        />
        {searchInput ? (
          <Pressable onPress={() => setSearchInput('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
            <Ionicons name="close-circle" size={18} color={C.textFaint} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SPACE.md, marginHorizontal: -SPACE.lg }} contentContainerStyle={{ gap: SPACE.sm, paddingHorizontal: SPACE.lg }}>
        {TIPOS.map(t => <Chip key={t.key} label={t.label} selected={tipo === t.key} onPress={() => setTipo(t.key)} />)}
        {categoriesInMonth.length > 1 ? <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: SPACE.xs }} /> : null}
        {categoriesInMonth.length > 1 ? categoriesInMonth.map(k => (
          <Chip key={k} label={categoryLabel(k)} selected={cat === k} onPress={() => setCat(cat === k ? 'todas' : k)} />
        )) : null}
      </ScrollView>

      {loaded && filtered.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: SPACE.lg, marginTop: SPACE.lg }}>
          {tipo !== 'ingreso' ? (
            <View>
              <Txt variant="caption" muted>Gastos</Txt>
              <Money value={totals.gastos} variant="heading" color={C.expense} />
            </View>
          ) : null}
          {tipo !== 'gasto' ? (
            <View>
              <Txt variant="caption" muted>Ingresos</Txt>
              <Money value={totals.ingresos} variant="heading" color={C.income} />
            </View>
          ) : null}
        </View>
      ) : null}
      {status === 'offline' ? (
        <Txt variant="caption" muted style={{ marginTop: SPACE.md }}>Sin conexión. Mostrando los últimos datos guardados.</Txt>
      ) : null}
    </View>
  );

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xxl * 2 }}
      sections={sections}
      keyExtractor={(tx, i) => String(tx.id ?? i)}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textMuted} colors={[C.brand]} />}
      renderSectionHeader={({ section }) => (
        <Txt variant="label" muted style={{ marginTop: SPACE.xl, marginBottom: SPACE.xs }}>{section.title}</Txt>
      )}
      renderItem={({ item, index }) => (
        <View>
          {index > 0 ? <Divider inset={48} /> : null}
          <TransactionRow tx={item} onPress={openEdit} showDate={false} />
        </View>
      )}
      ListEmptyComponent={!loaded ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: SPACE.xxl }} />
      ) : filtering ? (
        <EmptyState icon="search-outline" title="Sin resultados" body="Prueba con otra búsqueda o quita los filtros." />
      ) : (
        <EmptyState
          icon="receipt-outline"
          title="Sin movimientos en este mes"
          body="Lo que registres con el botón + o por el bot de Telegram aparece aquí."
          actionLabel={mes === currentMes ? 'Registrar movimiento' : undefined}
          onAction={() => openNew('gasto')}
        />
      )}
    />
  );
}
