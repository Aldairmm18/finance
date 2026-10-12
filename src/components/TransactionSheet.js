import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

function TransactionSheet({ state, onClose }) {
  const { colors: C } = useTheme();
  const editing = state?.tx || null;
  const visible = !!state;

  const [tipo, setTipo] = useState('gasto');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('otros');
  const [fecha, setFecha] = useState(localISODate());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recentDays, setRecentDays] = useState([]); // [hoy, ayer] al abrir la hoja

  useEffect(() => {
    if (!state) return;
    const tx = state.tx;
    const t = tx?.tipo || state.tipo || 'gasto';
    setTipo(t);
    setMonto(tx ? digitsOnly(Math.round(Number(tx.monto) || 0)) : '');
    setDescripcion(tx?.descripcion || '');
    setCategoria(tx ? normalizeCategory(tx.categoria) : (t === 'ingreso' ? 'salario' : 'comida'));
    setFecha(tx?.fecha ? dayKey(tx.fecha) : localISODate());
    setRecentDays([localISODate(), localISODate(new Date(Date.now() - 86400000))]);
    setError('');
    setBusy(false);
  }, [state]);

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

export function TransactionSheetProvider({ children }) {
  const [state, setState] = useState(null);
  const openNew = useCallback((tipo = 'gasto') => setState({ tipo, key: Date.now() }), []);
  const openEdit = useCallback((tx) => { if (tx) setState({ tx, key: Date.now() }); }, []);
  const close = useCallback(() => setState(null), []);
  const value = useMemo(() => ({ openNew, openEdit }), [openNew, openEdit]);

  return (
    <TransactionSheetContext.Provider value={value}>
      {children}
      <TransactionSheet state={state} onClose={close} />
    </TransactionSheetContext.Provider>
  );
}

export function useTransactionSheet() {
  return useContext(TransactionSheetContext);
}
