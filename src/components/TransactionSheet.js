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

/**
 * Formulario de la hoja. Se monta de nuevo en cada apertura (key = sheet.key),
 * así el estado inicial sale directo de las props y no se ven valores viejos.
 */
function TransactionSheet({ sheet, onClose }) {
  const { colors: C } = useTheme();
  const editing = sheet.tx || null;
  const visible = sheet.open;
  const initialTipo = editing?.tipo || sheet.tipo || 'gasto';

  const [tipo, setTipo] = useState(initialTipo);
  const [monto, setMonto] = useState(() => (editing ? digitsOnly(Math.round(Number(editing.monto) || 0)) : ''));
  const [descripcion, setDescripcion] = useState(editing?.descripcion || '');
  const [categoria, setCategoria] = useState(() => (
    editing ? normalizeCategory(editing.categoria) : (initialTipo === 'ingreso' ? 'salario' : 'comida')
  ));
  const [fecha, setFecha] = useState(() => (editing?.fecha ? dayKey(editing.fecha) : localISODate()));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // [hoy, ayer] calculados al abrir la hoja
  const [recentDays] = useState(() => [localISODate(), localISODate(new Date(Date.now() - 86400000))]);

  const cats = tipo === 'ingreso' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const dateOptions = useMemo(() => {
    const opts = [...recentDays];
    if (fecha && !opts.includes(fecha)) opts.push(fecha);
    return opts;
  }, [recentDays, fecha]);

  const changeTipo = (t) => {
    setTipo(t);
    const valid = (t === 'ingreso' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).some(c => c.key === categoria);
    if (!valid) setCategoria(t === 'ingreso' ? 'salario' : 'comida');
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

  const confirmDelete = () => {
    Alert.alert('Eliminar movimiento', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteTransaction(editing.id);
            notifyTransactionsChanged();
            onClose();
          } catch (e) {
            setBusy(false);
            setError(e?.message || 'No se pudo eliminar.');
          }
        },
      },
    ]);
  };

  const amountColor = tipo === 'ingreso' ? C.income : C.text;

  return (
    <Sheet
      visible={visible}
      onClose={busy ? () => {} : onClose}
      title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}
      footer={(
        <View style={{ gap: SPACE.sm }}>
          <Button title={editing ? 'Guardar cambios' : tipo === 'ingreso' ? 'Guardar ingreso' : 'Guardar gasto'} onPress={save} loading={busy} />
          {editing ? <Button title="Eliminar" variant="danger" onPress={confirmDelete} disabled={busy} /> : null}
        </View>
      )}
    >
      <Segmented
        value={tipo}
        onChange={changeTipo}
        options={[{ key: 'gasto', label: 'Gasto' }, { key: 'ingreso', label: 'Ingreso', color: C.income }]}
        style={{ marginBottom: SPACE.xl }}
      />

      <View style={{ alignItems: 'center', marginBottom: SPACE.xl }}>
        <Txt variant="label" muted>Monto</Txt>
        <TextInput
          value={monto ? `$${groupDigits(monto)}` : ''}
          onChangeText={(v) => { setMonto(digitsOnly(v).slice(0, 12)); if (error) setError(''); }}
          placeholder="$0"
          placeholderTextColor={C.textFaint}
          keyboardType="number-pad"
          autoFocus={!editing}
          accessibilityLabel="Monto"
          style={[{ fontSize: monto.length > 9 ? 32 : 40, fontWeight: '600', color: amountColor, alignSelf: 'stretch', textAlign: 'center', paddingVertical: SPACE.sm }, NUM]}
        />
        {error ? <Txt variant="caption" color={C.expense}>{error}</Txt> : null}
      </View>

      <Field
        label="Descripción"
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder={tipo === 'ingreso' ? 'Pago cliente, quincena…' : 'Mercado del mes, Uber…'}
        returnKeyType="done"
        maxLength={80}
      />

      <Txt variant="label" muted style={{ marginBottom: SPACE.sm }}>Categoría</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.xl }}>
        {cats.map(c => (
          <Chip key={c.key} label={c.label} icon={c.icon} selected={categoria === c.key} onPress={() => setCategoria(c.key)} />
        ))}
      </View>

      <Txt variant="label" muted style={{ marginBottom: SPACE.sm }}>Fecha</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.md }}>
        {dateOptions.map(d => (
          <Chip key={d} label={dayLabel(d)} selected={fecha === d} onPress={() => setFecha(d)} />
        ))}
      </View>
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
