import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View, Alert, Keyboard, TextInput } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Sheet, Txt, Field, Chip, Segmented, Button } from './ui';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, normalizeCategory } from '../utils/categories';
import { localISODate, dayLabel, dayKey } from '../utils/dateUtils';
import { addTransaction, updateTransaction, deleteTransaction } from '../utils/storage';
import { notifyTransactionsChanged } from '../hooks/useRealtimeSync';
import { SPACE, NUM } from '../theme/tokens';

const digitsOnly = (v) => String(v || '').replace(/\D/g, '');
const groupDigits = (d) => d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const DEFAULT_CATEGORY = { ingreso: 'salario', gasto: 'comida' };
const PLACEHOLDER = { ingreso: 'Pago cliente, quincena…', gasto: 'Mercado del mes, Uber…' };
const SAVE_LABEL = { ingreso: 'Guardar ingreso', gasto: 'Guardar gasto' };
const categoriesFor = (tipo) => (tipo === 'ingreso' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);

/** Valores iniciales del formulario a partir de lo que se abrió (nuevo o edición). */
function initialForm(sheet) {
  const tx = sheet.tx;
  if (!tx) {
    const tipo = sheet.tipo || 'gasto';
    return { tipo, monto: '', descripcion: '', categoria: DEFAULT_CATEGORY[tipo], fecha: localISODate() };
  }
  return {
    tipo: tx.tipo || 'gasto',
    monto: digitsOnly(Math.round(Number(tx.monto) || 0)),
    descripcion: tx.descripcion || '',
    categoria: normalizeCategory(tx.categoria),
    fecha: tx.fecha ? dayKey(tx.fecha) : localISODate(),
  };
}

function AmountInput({ monto, onChange, error, isIncome, autoFocus }) {
  const { colors: C } = useTheme();
  return (
    <View style={{ alignItems: 'center', marginBottom: SPACE.xl }}>
      <Txt variant="label" muted>Monto</Txt>
      <TextInput
        value={monto ? `$${groupDigits(monto)}` : ''}
        onChangeText={(v) => onChange(digitsOnly(v).slice(0, 12))}
        placeholder="$0"
        placeholderTextColor={C.textFaint}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        accessibilityLabel="Monto"
        style={[{
          fontSize: monto.length > 9 ? 32 : 40,
          fontWeight: '600',
          color: isIncome ? C.income : C.text,
          alignSelf: 'stretch',
          textAlign: 'center',
          paddingVertical: SPACE.sm,
        }, NUM]}
      />
      {error ? <Txt variant="caption" color={C.expense}>{error}</Txt> : null}
    </View>
  );
}

/** Título + fila de chips de selección única. */
function ChipGroup({ label, options, selected, onSelect, style }) {
  return (
    <>
      <Txt variant="label" muted style={{ marginBottom: SPACE.sm }}>{label}</Txt>
      <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }, style]}>
        {options.map(o => (
          <Chip key={o.key} label={o.label} icon={o.icon} selected={selected === o.key} onPress={() => onSelect(o.key)} />
        ))}
      </View>
    </>
  );
}

function SheetFooter({ editing, tipo, busy, onSave, onDelete }) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Button title={editing ? 'Guardar cambios' : SAVE_LABEL[tipo]} onPress={onSave} loading={busy} />
      {editing ? <Button title="Eliminar" variant="danger" onPress={onDelete} disabled={busy} /> : null}
    </View>
  );
}

/**
 * Formulario de la hoja. Se monta de nuevo en cada apertura (key = sheet.key),
 * así el estado inicial sale directo de las props y no se ven valores viejos.
 */
function TransactionSheet({ sheet, onClose }) {
  const { colors: C } = useTheme();
  const editing = sheet.tx || null;
  const [form, setForm] = useState(() => initialForm(sheet));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // [hoy, ayer] calculados al abrir la hoja
  const [recentDays] = useState(() => [localISODate(), localISODate(new Date(Date.now() - 86400000))]);
  const { tipo, monto, descripcion, categoria, fecha } = form;
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const dateOptions = useMemo(() => {
    const days = recentDays.includes(fecha) ? recentDays : [...recentDays, fecha];
    return days.map(d => ({ key: d, label: dayLabel(d) }));
  }, [recentDays, fecha]);

  const changeTipo = (t) => {
    const keep = categoriesFor(t).some(c => c.key === categoria);
    set({ tipo: t, categoria: keep ? categoria : DEFAULT_CATEGORY[t] });
  };

  const changeMonto = (value) => {
    set({ monto: value });
    setError('');
  };

  const save = async () => {
    Keyboard.dismiss();
    const amount = Number(monto) || 0;
    if (amount <= 0) { setError('Escribe un monto mayor que cero.'); return; }
    setBusy(true);
    setError('');
    const payload = { tipo, monto: amount, categoria, descripcion: descripcion.trim(), fecha };
    try {
      if (editing) await updateTransaction(editing.id, payload);
      else await addTransaction(payload);
      notifyTransactionsChanged();
      onClose();
    } catch (e) {
      setBusy(false);
      setError(e?.message || 'No se pudo guardar. Intenta de nuevo.');
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteTransaction(editing.id);
      notifyTransactionsChanged();
      onClose();
    } catch (e) {
      setBusy(false);
      setError(e?.message || 'No se pudo eliminar.');
    }
  };

  const confirmDelete = () => {
    Alert.alert('Eliminar movimiento', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: remove },
    ]);
  };

  return (
    <Sheet
      visible={sheet.open}
      onClose={busy ? () => {} : onClose}
      title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}
      footer={<SheetFooter editing={editing} tipo={tipo} busy={busy} onSave={save} onDelete={confirmDelete} />}
    >
      <Segmented
        value={tipo}
        onChange={changeTipo}
        options={[{ key: 'gasto', label: 'Gasto' }, { key: 'ingreso', label: 'Ingreso', color: C.income }]}
        style={{ marginBottom: SPACE.xl }}
      />
      <AmountInput monto={monto} onChange={changeMonto} error={error} isIncome={tipo === 'ingreso'} autoFocus={!editing} />
      <Field
        label="Descripción"
        value={descripcion}
        onChangeText={(v) => set({ descripcion: v })}
        placeholder={PLACEHOLDER[tipo]}
        returnKeyType="done"
        maxLength={80}
      />
      <ChipGroup
        label="Categoría"
        options={categoriesFor(tipo)}
        selected={categoria}
        onSelect={(k) => set({ categoria: k })}
        style={{ marginBottom: SPACE.xl }}
      />
      <ChipGroup
        label="Fecha"
        options={dateOptions}
        selected={fecha}
        onSelect={(d) => set({ fecha: d })}
        style={{ marginBottom: SPACE.md }}
      />
    </Sheet>
  );
}

// ─── Proveedor global ────────────────────────────────────────────────────────

const TransactionSheetContext = createContext({ openNew: () => {}, openEdit: () => {} });

const CLOSED = { open: false, key: 0, tx: null, tipo: 'gasto' };

export function TransactionSheetProvider({ children }) {
  // `key` cambia solo al abrir: al cerrar se conserva para que la hoja anime su salida.
  const [sheet, setSheet] = useState(CLOSED);
  const openNew = useCallback((tipo = 'gasto') => setSheet({ open: true, key: Date.now(), tx: null, tipo }), []);
  const openEdit = useCallback((tx) => { if (tx) setSheet({ open: true, key: Date.now(), tx, tipo: tx.tipo }); }, []);
  const close = useCallback(() => setSheet(s => ({ ...s, open: false })), []);
  const value = useMemo(() => ({ openNew, openEdit }), [openNew, openEdit]);

  return (
    <TransactionSheetContext.Provider value={value}>
      {children}
      <TransactionSheet key={sheet.key} sheet={sheet} onClose={close} />
    </TransactionSheetContext.Provider>
  );
}

export function useTransactionSheet() {
  return useContext(TransactionSheetContext);
}
