import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useMonthData } from '../hooks/useMonthData';
import { useTransactionSheet } from '../components/TransactionSheet';
import TransactionRow from '../components/TransactionRow';
import {
  Screen, ScreenHeader, Txt, Money, Card, ProgressBar, SectionTitle, EmptyState,
  IconButton, Button, Divider, IconBadge,
} from '../components/ui';
import { compareByCategory, formatCOP } from '../utils/calculations';
import { categoryLabel, categoryIcon, categoryColor } from '../utils/categories';
import { getCurrentMes, mesLabel, nextMonthlyDate, dayLabel, localISODate } from '../utils/dateUtils';
import { getRolloverOffer, applyRollover, dismissRollover } from '../utils/storage';
import { recurringPaymentService } from '../services/recurringPaymentService';
import { SPACE } from '../theme/tokens';

function StatusNote({ status }) {
  if (status !== 'offline') return null;
  return (
    <Txt variant="caption" muted style={{ marginBottom: SPACE.md }}>
      Sin conexión. Mostrando los últimos datos guardados.
    </Txt>
  );
}

function RolloverCard({ offer, onApply, onDismiss, busy }) {
  const { colors: C } = useTheme();
  return (
    <Card style={{ marginBottom: SPACE.lg, backgroundColor: C.savingsSoft, borderColor: 'transparent' }}>
      <Txt variant="label" color={C.savings} style={{ marginBottom: 4 }}>Sobrante de {mesLabel(offer.prevMes).split(' ')[0].toLowerCase()}</Txt>
      <Txt style={{ marginBottom: SPACE.md, lineHeight: 21 }}>
        Te sobraron <Txt style={{ fontWeight: '600' }}>{formatCOP(offer.amount)}</Txt>. ¿Quieres pasarlos a este mes como ahorro?
      </Txt>
      <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
        <Button title="Pasar a ahorro" onPress={onApply} loading={busy} style={{ flex: 1, minHeight: 44 }} />
        <Button title="Ahora no" variant="ghost" onPress={onDismiss} disabled={busy} style={{ minHeight: 44 }} />
      </View>
    </Card>
  );
}

/** Aviso de sobrante del mes anterior: se consulta solo con datos frescos. */
function useRolloverOffer(mes, txs, status, reload) {
  const [offer, setOffer] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'live') return undefined;
    let alive = true;
    getRolloverOffer(mes, txs).then(o => { if (alive) setOffer(o); }).catch(() => {});
    return () => { alive = false; };
  }, [status, mes, txs]);

  const apply = async () => {
    setBusy(true);
    try {
      await applyRollover(mes, offer.amount, mesLabel(offer.prevMes).toLowerCase());
      setOffer(null);
      reload();
    } catch (e) {
      Alert.alert('No se pudo pasar el sobrante', e?.message || 'Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    dismissRollover(mes);
    setOffer(null);
  };

  return { offer, busy, apply, dismiss };
}

/** Próximos 2 pagos fijos del usuario. */
function useUpcomingPayments(userId, status) {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    if (!userId || status !== 'live') return undefined;
    let alive = true;
    recurringPaymentService.getAll(userId).then(list => { if (alive) setPayments(list || []); }).catch(() => {});
    return () => { alive = false; };
  }, [userId, status]);

  return useMemo(() => {
    const now = new Date();
    return payments
      .map(p => ({ ...p, next: nextMonthlyDate(p.day_of_month, now) }))
      .sort((a, b) => a.next - b.next)
      .slice(0, 2);
  }, [payments]);
}

function HeroAmount({ plan, actual, onPlan }) {
  const { colors: C } = useTheme();
  if (plan.gastos <= 0) {
    return (
      <View style={{ marginBottom: SPACE.xl }}>
        <Txt variant="label" muted>Balance del mes</Txt>
        <Money value={actual.balance} variant="display" color={actual.balance < 0 ? C.expense : C.text} style={{ marginTop: 2, marginBottom: SPACE.sm }} />
        <Button title="Armar mi plan del mes" variant="secondary" icon="wallet-outline" onPress={onPlan} style={{ alignSelf: 'flex-start', minHeight: 40 }} />
      </View>
    );
  }
  const remaining = plan.gastos - actual.gastos;
  const over = remaining < 0;
  return (
    <View style={{ marginBottom: SPACE.xl }}>
      <Txt variant="label" muted>{over ? 'Te pasaste del plan por' : 'Te queda por gastar'}</Txt>
      <Money value={Math.abs(remaining)} variant="display" color={over ? C.expense : C.text} style={{ marginTop: 2, marginBottom: SPACE.md }} />
      <ProgressBar ratio={actual.gastos / plan.gastos} color={over ? C.expense : C.brand} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.sm }}>
        <Txt variant="caption" muted>Gastado {formatCOP(actual.gastos)}</Txt>
        <Txt variant="caption" muted>de {formatCOP(plan.gastos)}</Txt>
      </View>
    </View>
  );
}

function TotalCard({ label, value, planned, color }) {
  return (
    <Card style={{ flex: 1 }}>
      <Txt variant="caption" muted>{label}</Txt>
      <Money value={value} variant="heading" color={color} style={{ marginTop: 4 }} adjustsFontSizeToFit />
      {planned > 0 ? <Txt variant="caption" faint style={{ marginTop: 2 }}>Plan {formatCOP(planned)}</Txt> : null}
    </Card>
  );
}

function CategoryProgress({ row, first }) {
  const { colors: C, mode } = useTheme();
  const over = row.planned > 0 && row.spent > row.planned;
  return (
    <View style={{ marginTop: first ? 0 : SPACE.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Txt>{categoryLabel(row.key)}</Txt>
        <Txt variant="caption" muted style={{ alignSelf: 'center' }}>
          <Txt variant="caption" color={over ? C.expense : C.text}>{formatCOP(row.spent)}</Txt>
          {row.planned > 0 ? ` de ${formatCOP(row.planned)}` : ''}
        </Txt>
      </View>
      <ProgressBar ratio={row.planned > 0 ? row.spent / row.planned : 1} color={over ? C.expense : categoryColor(row.key, mode)} height={4} />
    </View>
  );
}

function TopCategoriesSection({ rows, onMore }) {
  if (rows.length === 0) return null;
  return (
    <>
      <SectionTitle title="En qué se va" action="Ver análisis" onAction={onMore} />
      <Card>
        {rows.map((row, i) => <CategoryProgress key={row.key} row={row} first={i === 0} />)}
      </Card>
    </>
  );
}

function UpcomingSection({ payments, onMore }) {
  const { mode } = useTheme();
  if (payments.length === 0) return null;
  return (
    <>
      <SectionTitle title="Próximos pagos" action="Ver todos" onAction={onMore} />
      <Card style={{ paddingVertical: SPACE.xs }}>
        {payments.map((p, i) => (
          <View key={p.id}>
            {i > 0 ? <Divider inset={48} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md }}>
              <IconBadge icon={categoryIcon(p.category_key)} color={categoryColor(p.category_key, mode)} />
              <View style={{ flex: 1 }}>
                <Txt numberOfLines={1}>{p.name}</Txt>
                <Txt variant="caption" muted style={{ marginTop: 2 }}>{dayLabel(localISODate(p.next))}</Txt>
              </View>
              <Money value={p.amount} />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function RecentSection({ txs, onMore, onAdd, onOpen }) {
  return (
    <>
      <SectionTitle title="Recientes" action={txs.length ? 'Ver todos' : undefined} onAction={onMore} />
      <Card style={{ paddingVertical: SPACE.xs }}>
        {txs.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="Sin movimientos este mes"
            body="Registra un gasto o ingreso con el botón +, o envíalo por el bot de Telegram."
            actionLabel="Registrar movimiento"
            onAction={onAdd}
          />
        ) : txs.map((tx, i) => (
          <View key={String(tx.id)}>
            {i > 0 ? <Divider inset={48} /> : null}
            <TransactionRow tx={tx} onPress={onOpen} />
          </View>
        ))}
      </Card>
    </>
  );
}

export default function HomeScreen() {
  const { colors: C } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const { openNew, openEdit } = useTransactionSheet();
  const mes = getCurrentMes();
  const { txs, plan, actual, status, reload, loaded } = useMonthData(mes);
  const [refreshing, setRefreshing] = useState(false);
  const rollover = useRolloverOffer(mes, txs, status, reload);
  const upcoming = useUpcomingPayments(user?.id, status);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  const recent = useMemo(() => txs.slice(0, 5), [txs]);
  const topCategories = useMemo(() => compareByCategory(plan, actual).slice(0, 3), [plan, actual]);

  const header = (
    <ScreenHeader
      subtitle="Este mes"
      title={mesLabel(mes)}
      right={<IconButton icon="settings-outline" label="Ajustes" onPress={() => navigation.navigate('Ajustes')} />}
    />
  );

  if (!loaded) {
    return (
      <Screen>
        {header}
        <ActivityIndicator color={C.textMuted} style={{ marginTop: SPACE.xxl }} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {header}
      <StatusNote status={status} />
      {rollover.offer ? (
        <RolloverCard offer={rollover.offer} busy={rollover.busy} onApply={rollover.apply} onDismiss={rollover.dismiss} />
      ) : null}
      <HeroAmount plan={plan} actual={actual} onPlan={() => navigation.navigate('Plan')} />
      <View style={{ flexDirection: 'row', gap: SPACE.md }}>
        <TotalCard label="Ingresos" value={actual.ingresos} planned={plan.ingresos} color={C.income} />
        <TotalCard label="Gastos" value={actual.gastos} planned={plan.gastos} color={C.expense} />
      </View>
      <TopCategoriesSection rows={topCategories} onMore={() => navigation.navigate('Analisis')} />
      <UpcomingSection payments={upcoming} onMore={() => navigation.navigate('Pagos')} />
      <RecentSection
        txs={recent}
        onMore={() => navigation.navigate('Movimientos')}
        onAdd={() => openNew('gasto')}
        onOpen={openEdit}
      />
    </Screen>
  );
}
