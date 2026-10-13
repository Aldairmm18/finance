import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useMonthData } from '../hooks/useMonthData';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import {
  Screen, Txt, Money, Card, Divider, Segmented, MonthSwitcher, ProgressBar, SectionTitle,
  EmptyState, IconButton, Field,
} from '../components/ui';
import { compareByCategory, computeActuals, computePlan, formatCOP, parseAmount, parseCOP } from '../utils/calculations';
import { categoryLabel, categoryColor } from '../utils/categories';
import { getCurrentMes, monthShort } from '../utils/dateUtils';
import { loadTransaccionesAnio, loadData, saveData, loadDataMes } from '../utils/storage';
import { SPACE } from '../theme/tokens';

// ─── Mes: plan vs real ───────────────────────────────────────────────────────

function PlanVsActualRow({ label, actual, planned, color }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt variant="caption" muted>{label}</Txt>
      <Money value={actual} variant="heading" color={color} adjustsFontSizeToFit />
      <Txt variant="caption" faint>{planned > 0 ? `de ${formatCOP(planned)} plan` : 'sin plan'}</Txt>
      {planned > 0 ? <View style={{ marginTop: SPACE.sm }}><ProgressBar ratio={actual / planned} color={color} height={4} /></View> : null}
      {!planned ? <View style={{ height: 4 + SPACE.sm }} /> : null}
    </View>
  );
}

function MonthView() {
  const { colors: C, mode } = useTheme();
  const currentMes = getCurrentMes();
  const [mes, setMes] = useState(currentMes);
  const { plan, actual, loaded, status } = useMonthData(mes);
  const rows = useMemo(() => compareByCategory(plan, actual), [plan, actual]);

  const typeSplit = [
    { key: 'esenciales', label: 'Esenciales', value: plan.esenciales, color: C.brand },
    { key: 'noEsenciales', label: 'No esenciales', value: plan.noEsenciales, color: C.warning },
    { key: 'creditos', label: 'Créditos', value: plan.creditos, color: C.savings },
  ].filter(s => s.value > 0);
  const splitTotal = typeSplit.reduce((s, x) => s + x.value, 0);

  return (
    <>
      <MonthSwitcher mes={mes} onChange={setMes} max={currentMes} />
      {status === 'offline' ? <Txt variant="caption" muted center>Sin conexión. Datos guardados.</Txt> : null}

      {!loaded ? <ActivityIndicator color={C.textMuted} style={{ marginTop: SPACE.xxl }} /> : (
        <>
          <Card style={{ marginTop: SPACE.md }}>
            <View style={{ flexDirection: 'row', gap: SPACE.lg }}>
              <PlanVsActualRow label="Ingresos" actual={actual.ingresos} planned={plan.ingresos} color={C.income} />
              <PlanVsActualRow label="Gastos" actual={actual.gastos} planned={plan.gastos} color={C.expense} />
            </View>
            <View style={{ marginTop: SPACE.md }}><Divider /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.md }}>
              <Txt muted>Balance real</Txt>
              <Money value={actual.balance} color={actual.balance < 0 ? C.expense : C.text} style={{ fontWeight: '600' }} />
            </View>
          </Card>

          <SectionTitle title="Por categoría" />
          {rows.length === 0 ? (
            <Card><EmptyState icon="pie-chart-outline" title="Nada que comparar aún" body="Arma tu plan o registra movimientos para ver cómo vas en cada categoría." /></Card>
          ) : (
            <Card>
              {rows.map((row, i) => {
                const over = row.planned > 0 && row.spent > row.planned;
                const pct = row.planned > 0 ? Math.round((row.spent / row.planned) * 100) : null;
                return (
                  <View key={row.key} style={{ marginTop: i === 0 ? 0 : SPACE.lg }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Txt>{categoryLabel(row.key)}</Txt>
                      <Txt variant="caption" color={over ? C.expense : C.textMuted} style={{ alignSelf: 'center' }}>
                        {pct !== null ? `${pct}%` : 'Sin plan'}
                      </Txt>
                    </View>
                    <ProgressBar ratio={row.planned > 0 ? row.spent / row.planned : 1} color={over ? C.expense : categoryColor(row.key, mode)} height={4} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Txt variant="caption" muted>Gastado {formatCOP(row.spent)}</Txt>
                      {row.planned > 0 ? (
                        <Txt variant="caption" color={over ? C.expense : C.textMuted}>
                          {over ? `Excedido ${formatCOP(row.spent - row.planned)}` : `Quedan ${formatCOP(row.planned - row.spent)}`}
                        </Txt>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </Card>
          )}

          {splitTotal > 0 ? (
            <>
              <SectionTitle title="Tipo de gasto planeado" />
              <Card>
                <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
                  {typeSplit.map(s => <View key={s.key} style={{ flex: s.value, backgroundColor: s.color }} />)}
                </View>
                {typeSplit.map(s => (
                  <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', marginTop: SPACE.md, gap: SPACE.sm }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                    <Txt style={{ flex: 1 }}>{s.label}</Txt>
                    <Txt variant="caption" muted>{Math.round((s.value / splitTotal) * 100)}%</Txt>
                    <Money value={s.value} style={{ minWidth: 110, textAlign: 'right' }} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </>
  );
}

// ─── Año ─────────────────────────────────────────────────────────────────────

function YearView() {
  const { colors: C, mode } = useTheme();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [txs, setTxs] = useState(null);
  const [failed, setFailed] = useState(false);
  const reqRef = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    const rows = await loadTransaccionesAnio(year);
    if (reqRef.current !== id) return;
    setFailed(rows === null);
    setTxs(rows || []);
  }, [year]);

  useEffect(() => { setTxs(null); }, [year]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeSync(load);

  const stats = useMemo(() => {
    if (!txs) return null;
    const months = Array.from({ length: 12 }, () => ({ ingresos: 0, gastos: 0 }));
    for (const tx of txs) {
      const idx = Number(String(tx.fecha || '').split('-')[1]) - 1;
      if (idx < 0 || idx > 11 || Number.isNaN(idx)) continue;
      const m = Number(tx.monto) || 0;
      if (tx.tipo === 'ingreso') months[idx].ingresos += m; else months[idx].gastos += m;
    }
    const totals = computeActuals(txs);
    const topCats = Object.entries(totals.byCategory).sort(([, a], [, b]) => b - a).slice(0, 5);
    const max = Math.max(1, ...months.map(m => Math.max(m.ingresos, m.gastos)));
    return { months, totals, topCats, max };
  }, [txs]);

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" label="Año anterior" onPress={() => setYear(y => y - 1)} color={C.textMuted} />
        <Txt variant="heading">{year}</Txt>
        <View style={{ opacity: year < currentYear ? 1 : 0.3 }} pointerEvents={year < currentYear ? 'auto' : 'none'}>
          <IconButton icon="chevron-forward" label="Año siguiente" onPress={() => setYear(y => y + 1)} color={C.textMuted} />
        </View>
      </View>

      {!stats ? <ActivityIndicator color={C.textMuted} style={{ marginTop: SPACE.xxl }} /> : failed ? (
        <Card style={{ marginTop: SPACE.md }}><EmptyState icon="cloud-offline-outline" title="Sin conexión" body="El resumen anual necesita internet." actionLabel="Reintentar" onAction={load} /></Card>
      ) : stats.totals.count === 0 ? (
        <Card style={{ marginTop: SPACE.md }}><EmptyState icon="calendar-outline" title={`Sin movimientos en ${year}`} body="Cuando registres ingresos y gastos, verás aquí cómo cerró cada mes." /></Card>
      ) : (
        <>
          <Card style={{ marginTop: SPACE.md }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="caption" muted>Ingresos</Txt>
                <Money value={stats.totals.ingresos} variant="heading" color={C.income} adjustsFontSizeToFit />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="caption" muted>Gastos</Txt>
                <Money value={stats.totals.gastos} variant="heading" color={C.expense} adjustsFontSizeToFit />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="caption" muted>Balance</Txt>
                <Money value={stats.totals.balance} variant="heading" color={stats.totals.balance < 0 ? C.expense : C.text} adjustsFontSizeToFit />
              </View>
            </View>
          </Card>

          <SectionTitle title="Mes a mes" />
          <Card>
            {stats.months.map((m, idx) => {
              if (!m.ingresos && !m.gastos) return null;
              const bal = m.ingresos - m.gastos;
              return (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm }}>
                  <Txt variant="label" muted style={{ width: 34, textTransform: 'capitalize' }}>{monthShort(idx)}</Txt>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ height: 4, borderRadius: 2, width: `${(m.ingresos / stats.max) * 100}%`, backgroundColor: C.income }} />
                    <View style={{ height: 4, borderRadius: 2, width: `${(m.gastos / stats.max) * 100}%`, backgroundColor: C.expense }} />
                  </View>
                  <Money value={bal} variant="caption" sign color={bal < 0 ? C.expense : C.text} style={{ width: 100, textAlign: 'right' }} />
                </View>
              );
            })}
            <View style={{ flexDirection: 'row', gap: SPACE.lg, marginTop: SPACE.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 4, borderRadius: 2, backgroundColor: C.income }} />
                <Txt variant="caption" muted>Ingresos</Txt>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 4, borderRadius: 2, backgroundColor: C.expense }} />
                <Txt variant="caption" muted>Gastos</Txt>
              </View>
            </View>
          </Card>

          {stats.topCats.length > 0 ? (
            <>
              <SectionTitle title="Donde más gastaste" />
              <Card>
                {stats.topCats.map(([key, amount], i) => (
                  <View key={key} style={{ marginTop: i === 0 ? 0 : SPACE.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Txt>{categoryLabel(key)}</Txt>
                      <Money value={amount} variant="caption" color={C.textMuted} />
                    </View>
                    <ProgressBar ratio={amount / stats.totals.gastos} color={categoryColor(key, mode)} height={4} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </>
  );
}

// ─── Meta: libertad financiera ───────────────────────────────────────────────

const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '');
const groupDigits = (d) => d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function GoalView() {
  const { colors: C } = useTheme();
  const [fields, setFields] = useState(null);
  const [fondo, setFondo] = useState(0);
  const baseRef = useRef(null);     // presupuesto base completo (se guarda entero)
  const pendingRef = useRef(null);  // datos por guardar
  const timerRef = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (!pendingRef.current) return;
    saveData(pendingRef.current);
    pendingRef.current = null;
  }, []);

  // Cargar al enfocar; guardar lo pendiente al salir de la pantalla.
  useFocusEffect(useCallback(() => {
    let alive = true;
    loadData().then(d => {
      if (!alive) return;
      baseRef.current = d;
      setFields(d.tranquilidad);
    });
    loadDataMes(getCurrentMes()).then(d => { if (alive) setFondo(computePlan(d).fondoEmergencia); }).catch(() => {});
    return () => { alive = false; flush(); };
  }, [flush]));

  useEffect(() => flush, [flush]);

  const update = (key, value) => {
    if (!baseRef.current) return;
    const next = { ...baseRef.current.tranquilidad, [key]: value };
    baseRef.current = { ...baseRef.current, tranquilidad: next };
    pendingRef.current = baseRef.current;
    setFields(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 700);
  };

  if (!fields) return <ActivityIndicator color={C.textMuted} style={{ marginTop: SPACE.xxl }} />;

  const gastos = parseCOP(fields.gastosMensualesDeseados);
  const rentabilidad = parseAmount(String(fields.rentabilidadAnual || '').replace(',', '.')) / 100;
  const patrimonio = parseCOP(fields.patrimonioActual);
  const necesario = rentabilidad > 0 ? (gastos * 12) / rentabilidad : 0;
  const progreso = necesario > 0 ? Math.min(1, patrimonio / necesario) : 0;
  const falta = Math.max(0, necesario - patrimonio);

  return (
    <>
      <Txt muted style={{ lineHeight: 21, marginBottom: SPACE.lg }}>
        Calcula cuánto patrimonio necesitas para cubrir tus gastos solo con lo que rinden tus inversiones.
      </Txt>
      <Card>
        <Field
          label="Gastos mensuales que quieres cubrir"
          value={fields.gastosMensualesDeseados ? `$${groupDigits(digitsOnly(fields.gastosMensualesDeseados))}` : ''}
          onChangeText={v => update('gastosMensualesDeseados', digitsOnly(v).slice(0, 12))}
          keyboardType="number-pad"
          placeholder="$0"
        />
        <Field
          label="Rentabilidad anual esperada"
          value={String(fields.rentabilidadAnual ?? '')}
          onChangeText={v => update('rentabilidadAnual', v.replace(/[^0-9.,]/g, '').slice(0, 5))}
          keyboardType="decimal-pad"
          placeholder="7"
          suffix="%"
          hint="Un promedio conservador está entre 5% y 8%."
        />
        <Field
          label="Patrimonio actual"
          value={fields.patrimonioActual ? `$${groupDigits(digitsOnly(fields.patrimonioActual))}` : ''}
          onChangeText={v => update('patrimonioActual', digitsOnly(v).slice(0, 13))}
          keyboardType="number-pad"
          placeholder="$0"
          hint="Inversiones, ahorros e inmuebles a valor de mercado."
          style={{ marginBottom: 0 }}
        />
      </Card>

      {necesario > 0 ? (
        <Card style={{ marginTop: SPACE.lg }}>
          <Txt variant="caption" muted>Patrimonio necesario</Txt>
          <Money value={necesario} variant="title" style={{ marginTop: 2, marginBottom: SPACE.md }} adjustsFontSizeToFit />
          <ProgressBar ratio={progreso} color={progreso >= 1 ? C.income : C.savings} height={8} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.sm }}>
            <Txt variant="caption" muted>{(progreso * 100).toFixed(1).replace('.', ',')}% alcanzado</Txt>
            <Txt variant="caption" muted>{progreso >= 1 ? 'Meta cumplida' : `Faltan ${formatCOP(falta)}`}</Txt>
          </View>
        </Card>
      ) : null}

      {fondo > 0 ? (
        <Card style={{ marginTop: SPACE.lg }}>
          <Txt variant="caption" muted>Fondo de emergencia sugerido</Txt>
          <Money value={fondo} variant="heading" style={{ marginTop: 2 }} />
          <Txt variant="caption" faint style={{ marginTop: 4 }}>Tres meses de tus gastos esenciales planeados.</Txt>
        </Card>
      ) : null}
    </>
  );
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

export default function AnalysisScreen() {
  const [view, setView] = useState('mes');
  return (
    <Screen>
      <Txt variant="title" accessibilityRole="header" style={{ marginBottom: SPACE.lg }}>Análisis</Txt>
      <Segmented
        value={view}
        onChange={setView}
        options={[{ key: 'mes', label: 'Mes' }, { key: 'anio', label: 'Año' }, { key: 'meta', label: 'Meta' }]}
        style={{ marginBottom: SPACE.lg }}
      />
      {view === 'mes' ? <MonthView /> : view === 'anio' ? <YearView /> : <GoalView />}
    </Screen>
  );
}
