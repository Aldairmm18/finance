import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, SectionList, ScrollView, TextInput, RefreshControl, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useMonthData } from '../hooks/useMonthData';
import { useTransactionSheet } from '../components/TransactionSheet';
import TransactionRow from '../components/TransactionRow';
import { Txt, Money, Chip, MonthSwitcher, EmptyState, Divider, StatusBarBackdrop } from '../components/ui';
import { normalizeCategory, categoryLabel } from '../utils/categories';
import { getCurrentMes, dayLabel, dayKey } from '../utils/dateUtils';
import { SPACE, RADIUS } from '../theme/tokens';

const styles = StyleSheet.create({
  sectionHeader: { marginTop: SPACE.xl, marginBottom: SPACE.xs },
  listContent: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xxl * 2 },
});

const TIPOS = [
  { key: 'todos', label: 'Todos' },
  { key: 'gasto', label: 'Gastos' },
  { key: 'ingreso', label: 'Ingresos' },
];

// ─── Lógica pura ─────────────────────────────────────────────────────────────

function matchesFilters(tx, { tipo, cat, search }) {
  if (tipo !== 'todos' && tx.tipo !== tipo) return false;
  if (cat !== 'todas' && normalizeCategory(tx.categoria) !== cat) return false;
  if (!search) return true;
  return `${tx.descripcion || ''} ${categoryLabel(tx.categoria)}`.toLowerCase().includes(search);
}

function sumByType(list) {
  return list.reduce((acc, tx) => {
    const field = tx.tipo === 'ingreso' ? 'ingresos' : 'gastos';
    acc[field] += Number(tx.monto) || 0;
    return acc;
  }, { ingresos: 0, gastos: 0 });
}

function groupByDay(list) {
  const byDay = new Map();
  for (const tx of list) {
    const key = dayKey(tx.fecha);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(tx);
  }
  return Array.from(byDay.entries())
    .sort(([x], [y]) => y.localeCompare(x))
    .map(([fecha, data]) => ({ title: dayLabel(fecha), data }));
}

function categoriesOf(txs) {
  const keys = new Set(txs.map(tx => normalizeCategory(tx.categoria)));
  return Array.from(keys).sort((x, y) => categoryLabel(x).localeCompare(categoryLabel(y)));
}

function useDebouncedValue(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// ─── Piezas de la cabecera ───────────────────────────────────────────────────

function SearchBar({ value, onChange }) {
  const { colors: C } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
      backgroundColor: C.sunken, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, marginTop: SPACE.md,
    }}>
      <Ionicons name="search" size={18} color={C.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Buscar por descripción o categoría"
        placeholderTextColor={C.textFaint}
        returnKeyType="search"
        accessibilityLabel="Buscar movimientos"
        style={{ flex: 1, minHeight: 44, fontSize: 16, color: C.text }}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
          <Ionicons name="close-circle" size={18} color={C.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

function FilterChips({ tipo, onTipo, categories, cat, onCat }) {
  const { colors: C } = useTheme();
  const showCats = categories.length > 1;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SPACE.md, marginHorizontal: -SPACE.lg }} contentContainerStyle={{ gap: SPACE.sm, paddingHorizontal: SPACE.lg }}>
      {TIPOS.map(t => <Chip key={t.key} label={t.label} selected={tipo === t.key} onPress={() => onTipo(t.key)} />)}
      {showCats ? <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: SPACE.xs }} /> : null}
      {showCats ? categories.map(k => (
        <Chip key={k} label={categoryLabel(k)} selected={cat === k} onPress={() => onCat(cat === k ? 'todas' : k)} />
      )) : null}
    </ScrollView>
  );
}

function TotalItem({ label, value, color }) {
  return (
    <View>
      <Txt variant="caption" muted>{label}</Txt>
      <Money value={value} variant="heading" color={color} />
    </View>
  );
}

/** Totales del filtro; oculta el tipo excluido o en cero (salvo que se filtre por él). */
function FilteredTotals({ tipo, totals }) {
  const { colors: C } = useTheme();
  const showGastos = tipo === 'gasto' || (tipo === 'todos' && totals.gastos > 0);
  const showIngresos = tipo === 'ingreso' || (tipo === 'todos' && totals.ingresos > 0);
  return (
    <View style={{ flexDirection: 'row', gap: SPACE.lg, marginTop: SPACE.lg }}>
      {showGastos ? <TotalItem label="Gastos" value={totals.gastos} color={C.expense} /> : null}
      {showIngresos ? <TotalItem label="Ingresos" value={totals.ingresos} color={C.income} /> : null}
    </View>
  );
}

function MovementsEmpty({ loaded, filtering, canAdd, onAdd }) {
  const { colors: C } = useTheme();
  if (!loaded) return <ActivityIndicator color={C.textMuted} style={{ marginTop: SPACE.xxl }} />;
  if (filtering) {
    return <EmptyState icon="search-outline" title="Sin resultados" body="Prueba con otra búsqueda o quita los filtros." />;
  }
  return (
    <EmptyState
      icon="receipt-outline"
      title="Sin movimientos en este mes"
      body="Lo que registres con el botón + o por el bot de Telegram aparece aquí."
      actionLabel={canAdd ? 'Registrar movimiento' : undefined}
      onAction={onAdd}
    />
  );
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

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
  const search = useDebouncedValue(searchInput.trim().toLowerCase(), 200);

  // La categoría elegida puede no existir en otro mes: se limpia al cambiar.
  const changeMonth = (next) => {
    setMes(next);
    setCat('todas');
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  const categoriesInMonth = useMemo(() => categoriesOf(txs), [txs]);
  const filtered = useMemo(() => txs.filter(tx => matchesFilters(tx, { tipo, cat, search })), [txs, tipo, cat, search]);
  const totals = useMemo(() => sumByType(filtered), [filtered]);
  const sections = useMemo(() => groupByDay(filtered), [filtered]);

  const renderSectionHeader = useCallback(({ section }) => (
    <Txt variant="label" muted style={styles.sectionHeader}>{section.title}</Txt>
  ), []);

  const renderItem = useCallback(({ item, index }) => (
    <View>
      {index > 0 ? <Divider inset={48} /> : null}
      <TransactionRow tx={item} onPress={openEdit} showDate={false} />
    </View>
  ), [openEdit]);

  const header = (
    <View>
      <View style={{ height: insets.top + SPACE.md }} />
      <Txt variant="title" accessibilityRole="header" style={{ marginBottom: SPACE.sm }}>Movimientos</Txt>
      <MonthSwitcher mes={mes} onChange={changeMonth} max={currentMes} />
      <SearchBar value={searchInput} onChange={setSearchInput} />
      <FilterChips tipo={tipo} onTipo={setTipo} categories={categoriesInMonth} cat={cat} onCat={setCat} />
      {loaded && filtered.length > 0 ? <FilteredTotals tipo={tipo} totals={totals} /> : null}
      {status === 'offline' ? (
        <Txt variant="caption" muted style={{ marginTop: SPACE.md }}>Sin conexión. Mostrando los últimos datos guardados.</Txt>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SectionList
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={styles.listContent}
        sections={sections}
        keyExtractor={(tx) => String(tx.id)}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textMuted} colors={[C.brand]} />}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        ListEmptyComponent={(
          <MovementsEmpty
            loaded={loaded}
            filtering={tipo !== 'todos' || cat !== 'todas' || !!search}
            canAdd={mes === currentMes}
            onAdd={() => openNew('gasto')}
          />
        )}
      />
      <StatusBarBackdrop />
    </View>
  );
}
