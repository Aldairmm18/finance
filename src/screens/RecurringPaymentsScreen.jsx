import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, Alert, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { recurringPaymentService } from '../services/recurringPaymentService';
import { notificationService } from '../services/notificationService';
import { subcategoryService } from '../services/subcategoryService';
import {
  Screen, Txt, Money, Card, Divider, Sheet, Field, Chip, Button, EmptyState, IconBadge, IconButton,
} from '../components/ui';
import { EXPENSE_CATEGORIES, normalizeCategory, categoryIcon, categoryColor, categoryLabel } from '../utils/categories';
import { nextMonthlyDate, dayLabel, localISODate } from '../utils/dateUtils';
import { SPACE, RADIUS } from '../theme/tokens';

const NOTIFY_OPTIONS = [1, 3, 5, 7];
const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '');
const groupDigits = (d) => d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ─── Formulario ──────────────────────────────────────────────────────────────

/** Se monta de nuevo en cada apertura (key = sheet.key); el estado inicial sale de las props. */
function PaymentSheet({ sheet, userId, onClose, onSaved }) {
  const { colors: C } = useTheme();
  const editing = sheet.payment || null;

  const [name, setName] = useState(editing?.name || '');
  const [amount, setAmount] = useState(() => (editing ? digitsOnly(Math.round(Number(editing.amount) || 0)) : ''));
  const [category, setCategory] = useState(() => (editing ? normalizeCategory(editing.category_key) : 'hogar'));
  const [subcategoryId, setSubcategoryId] = useState(editing?.subcategory_id || null);
  const [day, setDay] = useState(editing ? String(editing.day_of_month) : '');
  const [notifyDays, setNotifyDays] = useState(editing?.notify_days_before ?? 3);
  const [allSubcats, setAllSubcats] = useState([]);
  const [newSubcat, setNewSubcat] = useState(null); // null = cerrado, string = escribiendo
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // Cargar subcategorías al abrir (datos externos, por eso sí va en un efecto).
  useEffect(() => {
    if (!sheet.open || !userId) return undefined;
    let alive = true;
    subcategoryService.getAll(userId)
      .then(list => { if (alive) setAllSubcats(list || []); })
      .catch(() => { if (alive) setAllSubcats([]); });
    return () => { alive = false; };
  }, [sheet.open, userId]);

  // Las subcategorías antiguas pueden tener claves "master" (p. ej. Servicios).
  const subcats = useMemo(
    () => allSubcats.filter(s => normalizeCategory(s.category_key) === category),
    [allSubcats, category],
  );

  const addSubcat = async () => {
    const label = (newSubcat || '').trim();
    if (!label) { setNewSubcat(null); return; }
    try {
      const created = await subcategoryService.create({
        name: label,
        category_key: category,
        icon: 'tag-outline',
        color: categoryColor(category, 'light'),
      });
      setAllSubcats(prev => [...prev, created]);
      setSubcategoryId(created.id);
      setNewSubcat(null);
    } catch (e) {
      Alert.alert('No se pudo crear la subcategoría', e?.message || 'Intenta de nuevo.');
    }
  };

  const save = async () => {
    const amountNum = Number(amount) || 0;
    const dayNum = parseInt(day, 10);
    const next = {};
    if (!name.trim()) next.name = 'Escribe un nombre.';
    if (amountNum <= 0) next.amount = 'Escribe un monto mayor que cero.';
    if (!dayNum || dayNum < 1 || dayNum > 31) next.day = 'Elige un día entre 1 y 31.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const payload = {
      name: name.trim(),
      amount: amountNum,
      category_key: category,
      subcategory_id: subcategoryId || null,
      day_of_month: dayNum,
      notify_days_before: notifyDays,
    };
    try {
      if (editing) await recurringPaymentService.update(editing.id, payload);
      else await recurringPaymentService.create(payload);
      await onSaved();
      onClose();
    } catch (e) {
      setBusy(false);
      Alert.alert('No se pudo guardar', e?.message || 'Intenta de nuevo.');
    }
  };

  const confirmDelete = () => {
    Alert.alert('Eliminar pago fijo', `Dejarás de recibir recordatorios de ${editing.name}.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await recurringPaymentService.delete(editing.id);
            await onSaved();
            onClose();
          } catch (e) {
            setBusy(false);
            Alert.alert('No se pudo eliminar', e?.message || 'Intenta de nuevo.');
          }
        },
      },
    ]);
  };

  return (
    <Sheet
      visible={sheet.open}
      onClose={busy ? () => {} : onClose}
      title={editing ? 'Editar pago fijo' : 'Nuevo pago fijo'}
      footer={(
        <View style={{ gap: SPACE.sm }}>
          <Button title={editing ? 'Guardar cambios' : 'Guardar pago'} onPress={save} loading={busy} />
          {editing ? <Button title="Eliminar" variant="danger" onPress={confirmDelete} disabled={busy} /> : null}
        </View>
      )}
    >
      <Field label="Nombre" value={name} onChangeText={setName} placeholder="Netflix, plan de celular…" error={errors.name} maxLength={60} />
      <Field
        label="Monto"
        value={amount ? `$${groupDigits(amount)}` : ''}
        onChangeText={v => setAmount(digitsOnly(v).slice(0, 12))}
        keyboardType="number-pad"
        placeholder="$0"
        error={errors.amount}
      />
      <Field
        label="Día del cobro"
        value={day}
        onChangeText={v => setDay(digitsOnly(v).slice(0, 2))}
        keyboardType="number-pad"
        placeholder="15"
        error={errors.day}
        hint="Si el mes tiene menos días, te avisamos para el último día del mes."
      />

      <Txt variant="label" muted style={{ marginBottom: SPACE.sm }}>Categoría</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.lg }}>
        {EXPENSE_CATEGORIES.map(c => (
          <Chip key={c.key} label={c.label} icon={c.icon} selected={category === c.key} onPress={() => { setCategory(c.key); setSubcategoryId(null); }} />
        ))}
      </View>

      <Txt variant="label" muted style={{ marginBottom: SPACE.sm }}>Subcategoría (opcional)</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.lg }}>
        <Chip label="Ninguna" selected={!subcategoryId} onPress={() => setSubcategoryId(null)} />
        {subcats.map(s => (
          <Chip key={s.id} label={s.name} selected={subcategoryId === s.id} onPress={() => setSubcategoryId(s.id)} />
        ))}
        {newSubcat === null ? (
          <Chip label="Nueva" icon="add" onPress={() => setNewSubcat('')} />
        ) : null}
      </View>
      {newSubcat !== null ? (
        <View style={{ flexDirection: 'row', gap: SPACE.sm, marginTop: -SPACE.sm, marginBottom: SPACE.lg }}>
          <TextInput
            value={newSubcat}
            onChangeText={setNewSubcat}
            placeholder={`Subcategoría de ${categoryLabel(category).toLowerCase()}`}
            placeholderTextColor={C.textFaint}
            autoFocus
            onSubmitEditing={addSubcat}
            returnKeyType="done"
            style={{ flex: 1, minHeight: 44, fontSize: 16, color: C.text, backgroundColor: C.sunken, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md }}
          />
          <Button title="Agregar" variant="secondary" onPress={addSubcat} style={{ minHeight: 44 }} />
        </View>
      ) : null}

      <Txt variant="label" muted style={{ marginBottom: SPACE.sm }}>Recordarme antes</Txt>
      <View style={{ flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.md }}>
        {NOTIFY_OPTIONS.map(n => (
          <Chip key={n} label={`${n} día${n > 1 ? 's' : ''}`} selected={notifyDays === n} onPress={() => setNotifyDays(n)} />
        ))}
      </View>
    </Sheet>
  );
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

export default function RecurringPaymentsScreen() {
  const { colors: C, mode } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [payments, setPayments] = useState(null);
  const [failed, setFailed] = useState(false);
  // `key` cambia solo al abrir, para que la hoja anime su salida al cerrar.
  const [sheet, setSheet] = useState({ open: false, key: 0, payment: null });
  const openSheet = (payment) => setSheet({ open: true, key: Date.now(), payment });
  const closeSheet = () => setSheet(sh => ({ ...sh, open: false }));

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await recurringPaymentService.getAll(user.id);
      setPayments(data || []);
      setFailed(false);
      notificationService.rescheduleAll(data || []);
    } catch {
      setFailed(true);
      setPayments(p => p || []);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <IconButton icon="add" label="Agregar pago fijo" onPress={() => openSheet(null)} color={C.brand} />,
    });
  }, [navigation, C.brand]);

  const sorted = useMemo(() => {
    const now = new Date();
    return (payments || [])
      .map(p => ({ ...p, next: nextMonthlyDate(p.day_of_month, now) }))
      .sort((a, b) => a.next - b.next);
  }, [payments]);

  const monthlyTotal = sorted.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <Screen withTopInset={false}>
      {payments === null ? <ActivityIndicator color={C.textMuted} style={{ marginTop: SPACE.xxl }} /> : (
        <>
          {failed ? <Txt variant="caption" muted style={{ marginBottom: SPACE.md }}>No se pudieron cargar los pagos. Revisa tu conexión.</Txt> : null}
          {sorted.length > 0 ? (
            <View style={{ marginBottom: SPACE.xl }}>
              <Txt variant="label" muted>Total al mes</Txt>
              <Money value={monthlyTotal} variant="display" />
              <Txt variant="caption" muted>{sorted.length} pago{sorted.length > 1 ? 's' : ''} con recordatorio</Txt>
            </View>
          ) : null}

          <Card style={{ paddingVertical: SPACE.xs }}>
            {sorted.length === 0 ? (
              <EmptyState
                icon="repeat-outline"
                title="Sin pagos fijos"
                body="Agrega arriendo, servicios o suscripciones y te avisamos antes de cada cobro."
                actionLabel="Agregar pago fijo"
                onAction={() => openSheet(null)}
              />
            ) : sorted.map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <Divider inset={48} /> : null}
                <Pressable onPress={() => openSheet(p)} accessibilityRole="button" accessibilityHint="Abre el pago para editarlo">
                  {({ pressed }) => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md, opacity: pressed ? 0.6 : 1 }}>
                      <IconBadge icon={categoryIcon(p.category_key)} color={categoryColor(p.category_key, mode)} />
                      <View style={{ flex: 1 }}>
                        <Txt numberOfLines={1}>{p.name}</Txt>
                        <Txt variant="caption" muted style={{ marginTop: 2 }} numberOfLines={1}>
                          Día {p.day_of_month} · próximo {dayLabel(localISODate(p.next)).toLowerCase()}
                          {p.subcategories?.name ? ` · ${p.subcategories.name}` : ''}
                        </Txt>
                      </View>
                      <Money value={p.amount} />
                    </View>
                  )}
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}

      <PaymentSheet key={sheet.key} sheet={sheet} userId={user?.id} onClose={closeSheet} onSaved={load} />
    </Screen>
  );
}
