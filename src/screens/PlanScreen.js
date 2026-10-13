import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, TextInput, LayoutAnimation, Platform, UIManager, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  Screen, Txt, Money, Card, Divider, MonthSwitcher, SectionTitle, Sheet, ListRow, IconBadge,
} from '../components/ui';
import { loadDataMes, saveDataMes } from '../utils/storage';
import { PERIODICIDADES, toMonthly, computePlan } from '../utils/calculations';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoryColor, categoryIcon, categoryLabel } from '../utils/categories';
import { getCurrentMes, mesLabel } from '../utils/dateUtils';
import { SPACE, RADIUS, NUM } from '../theme/tokens';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ITEM_LABELS = {
  arriendo: 'Arriendo', administracion: 'Administración', luz: 'Luz', agua: 'Agua', gas: 'Gas',
  telefono: 'Teléfono', internet: 'Internet', tv: 'TV', otro: 'Otro', otros: 'Otros',
  mercado: 'Mercado', comidasFuera: 'Comidas por fuera',
  gasolina: 'Gasolina', taxiUber: 'Taxi / Uber', transportePublico: 'Transporte público', metro: 'Metro',
  mantenimientoAuto: 'Mantenimiento auto', seguroAuto: 'Seguro auto',
  medicamentos: 'Medicamentos', consultas: 'Consultas médicas', examenes: 'Exámenes', optica: 'Óptica',
  creditoHipotecario: 'Crédito hipotecario', creditoAuto: 'Crédito auto', tarjetaCredito: 'Tarjeta de crédito',
  viajes: 'Viajes', restaurantes: 'Restaurantes', diversion: 'Diversión', fiesta: 'Fiesta',
  appleMusic: 'Apple Music', ia: 'IA / suscripciones de IA',
  colegios: 'Colegios', seguroMedico: 'Seguro médico', otrosSeguros: 'Otros seguros',
  suscripciones: 'Suscripciones', gimnasio: 'Gimnasio', impuestos: 'Impuestos', entretenimiento: 'Entretenimiento',
};

const BASE_INCOME_KEYS = ['salario', 'bonos', 'comisiones', 'dividendos', 'otros'];
const INCOME_LABELS = Object.fromEntries(INCOME_CATEGORIES.map(c => [c.key, c.label]));

const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '');
const groupDigits = (d) => d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const periodLabel = (p) => PERIODICIDADES.find(x => x.value === p)?.label || 'Mensual';

// ─── Fila editable ───────────────────────────────────────────────────────────

/**
 * Fila de un monto del plan. Recibe su ubicación (section/cat/itemKey) y
 * manejadores estables, para que memo() evite re-renderizar las demás filas.
 */
const BudgetItem = memo(function BudgetItem({ section, cat, itemKey, label, item, onChange, onOpenPeriod, showEssential }) {
  const { colors: C } = useTheme();
  const change = (field, value) => onChange(section, cat, itemKey, field, value);
  // Un "0" guardado se muestra como campo vacío (placeholder), no como valor.
  const digits = digitsOnly(item.monto).replace(/^0+/, '');
  const monthly = toMonthly(item.monto, item.periodicidad);
  const nonMonthly = item.periodicidad && item.periodicidad !== 'mensual';

  return (
    <View style={{ paddingVertical: SPACE.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
        <Txt style={{ flex: 1 }} numberOfLines={1}>{label}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.sunken, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, width: 140 }}>
          <Txt muted>$</Txt>
          <TextInput
            value={digits ? groupDigits(digits) : ''}
            onChangeText={v => change('monto', digitsOnly(v).slice(0, 12))}
            placeholder="0"
            placeholderTextColor={C.textFaint}
            keyboardType="number-pad"
            accessibilityLabel={`Monto de ${label}`}
            style={[{ flex: 1, minHeight: 40, fontSize: 16, color: C.text, textAlign: 'right' }, NUM]}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: 6 }}>
        <Pressable onPress={() => onOpenPeriod(section, cat, itemKey, item.periodicidad)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Periodicidad: ${periodLabel(item.periodicidad)}`}>
          <Txt variant="caption" color={C.brand}>{periodLabel(item.periodicidad)}</Txt>
        </Pressable>
        {showEssential ? (
          <Pressable
            onPress={() => change('esencial', !item.esencial)}
            hitSlop={8}
            accessibilityRole="switch"
            accessibilityState={{ checked: !!item.esencial }}
            accessibilityLabel="Gasto esencial"
          >
            <Txt variant="caption" color={item.esencial ? C.text : C.textFaint}>
              {item.esencial ? 'Esencial' : 'No esencial'}
            </Txt>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        {nonMonthly && monthly > 0 ? (
          <Txt variant="caption" muted style={NUM}>≈ <Money value={monthly} variant="caption" color={C.textMuted} />/mes</Txt>
        ) : null}
      </View>
    </View>
  );
});

// ─── Grupo plegable ──────────────────────────────────────────────────────────

function Group({ icon, iconColor, title, total, open, onToggle, children }) {
  const { colors: C } = useTheme();
  return (
    <Card padded={false} style={{ marginBottom: SPACE.sm }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        {({ pressed }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, opacity: pressed ? 0.6 : 1 }}>
            <IconBadge icon={icon} color={iconColor} />
            <Txt style={{ flex: 1, fontWeight: '500' }}>{title}</Txt>
            <Money value={total} color={total > 0 ? C.text : C.textFaint} />
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.textFaint} />
          </View>
        )}
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.sm }}>
          <Divider />
          {children}
        </View>
      ) : null}
    </Card>
  );
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const { colors: C, mode } = useTheme();
  const navigation = useNavigation();
  const [mes, setMes] = useState(getCurrentMes);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState({ ingresos: true });
  const [periodTarget, setPeriodTarget] = useState(null); // { section, cat, itemKey, current }
  const [saveState, setSaveState] = useState('idle');     // idle | saving | saved

  const dataRef = useRef(null);   // copia síncrona de `data` para editar sin efectos en el updater
  const dirtyRef = useRef(null);  // { mes, data } pendiente de guardar
  const timerRef = useRef(null);

  const flush = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const pending = dirtyRef.current;
    if (!pending) return;
    dirtyRef.current = null;
    setSaveState('saving');
    saveDataMes(pending.mes, pending.data).finally(() => setSaveState('saved'));
  }, []);

  // Recargar al enfocar o cambiar de mes; guardar lo pendiente al salir.
  useFocusEffect(useCallback(() => {
    let alive = true;
    dataRef.current = null;
    setData(null);
    loadDataMes(mes).then(d => {
      if (!alive) return;
      dataRef.current = d;
      setData(d);
    });
    return () => { alive = false; flush(); };
  }, [mes, flush]));

  useEffect(() => () => flush(), [flush]);

  /** Cambia un campo de ingresos, gastos o ahorro y agenda el guardado. */
  const setField = useCallback((section, cat, itemKey, field, value) => {
    const prev = dataRef.current;
    if (!prev) return;
    let next;
    if (section === 'ingresos') {
      next = { ...prev, ingresos: { ...prev.ingresos, [itemKey]: { ...(prev.ingresos[itemKey] || { periodicidad: 'mensual' }), [field]: value } } };
    } else if (section === 'gastos') {
      next = { ...prev, gastos: { ...prev.gastos, [cat]: { ...prev.gastos[cat], [itemKey]: { ...prev.gastos[cat]?.[itemKey], [field]: value } } } };
    } else {
      next = { ...prev, ahorro: { ...prev.ahorro, [field]: value } };
    }
    dataRef.current = next;
    dirtyRef.current = { mes, data: next };
    setData(next);
    setSaveState('idle');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 700);
  }, [mes, flush]);

  const openPeriod = useCallback((section, cat, itemKey, current) => {
    setPeriodTarget({ section, cat, itemKey, current });
  }, []);

  const toggle = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeOut', 'opacity'));
    setOpen(o => ({ ...o, [key]: !o[key] }));
  };

  const changeMonth = (next) => { flush(); setMes(next); };

  const plan = useMemo(() => computePlan(data), [data]);

  const incomeKeys = useMemo(() => {
    if (!data) return BASE_INCOME_KEYS;
    // Se muestran también fuentes antiguas que tengan monto, para no esconder datos.
    const extra = Object.keys(data.ingresos || {}).filter(k => !BASE_INCOME_KEYS.includes(k) && digitsOnly(data.ingresos[k]?.monto));
    return [...BASE_INCOME_KEYS, ...extra];
  }, [data]);

  const expenseGroups = useMemo(() => {
    if (!data) return [];
    const known = EXPENSE_CATEGORIES.filter(c => data.gastos?.[c.key]).map(c => c.key);
    const knownSet = new Set(known);
    const extra = Object.keys(data.gastos || {}).filter(k => !knownSet.has(k));
    return [...known, ...extra];
  }, [data]);

  const free = plan.ingresos - plan.gastos - plan.ahorro;
  const currentMes = getCurrentMes();

  return (
    <Screen>
      <Txt variant="title" accessibilityRole="header" style={{ marginBottom: SPACE.sm }}>Plan</Txt>
      <MonthSwitcher mes={mes} onChange={changeMonth} />
      <Txt variant="caption" muted center style={{ marginBottom: SPACE.lg }}>
        {mes === currentMes ? 'Mes actual' : mes < currentMes ? 'Mes pasado' : 'Mes futuro'}
        {saveState === 'saving' ? ' · Guardando…' : saveState === 'saved' ? ' · Guardado' : ''}
      </Txt>

      {!data ? <ActivityIndicator color={C.textMuted} style={{ marginTop: SPACE.xxl }} /> : (
        <>
          <Card style={{ marginBottom: SPACE.xl }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="caption" muted>Ingresos</Txt>
                <Money value={plan.ingresos} variant="heading" color={C.income} adjustsFontSizeToFit />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="caption" muted>Gastos</Txt>
                <Money value={plan.gastos} variant="heading" color={C.expense} adjustsFontSizeToFit />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="caption" muted>Ahorro</Txt>
                <Money value={plan.ahorro} variant="heading" color={C.savings} adjustsFontSizeToFit />
              </View>
            </View>
            <View style={{ marginTop: SPACE.md }}><Divider /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.md }}>
              <Txt muted>{free < 0 ? 'Falta para cubrir el plan' : 'Libre después del plan'}</Txt>
              <Money value={Math.abs(free)} color={free < 0 ? C.expense : C.text} style={{ fontWeight: '600' }} />
            </View>
          </Card>

          <Group
            icon="cash-outline" iconColor={C.income} title="Ingresos" total={plan.ingresos}
            open={!!open.ingresos} onToggle={() => toggle('ingresos')}
          >
            {incomeKeys.map((key, i) => {
              const item = data.ingresos?.[key] || { monto: '', periodicidad: 'mensual' };
              return (
                <View key={key}>
                  {i > 0 ? <Divider /> : null}
                  <BudgetItem
                    section="ingresos"
                    itemKey={key}
                    label={INCOME_LABELS[key] || categoryLabel(key)}
                    item={item}
                    onChange={setField}
                    onOpenPeriod={openPeriod}
                  />
                </View>
              );
            })}
          </Group>

          <SectionTitle title="Gastos" />
          {expenseGroups.map(catKey => {
            const items = data.gastos[catKey] || {};
            return (
              <Group
                key={catKey}
                icon={categoryIcon(catKey)}
                iconColor={categoryColor(catKey, mode)}
                title={categoryLabel(catKey)}
                total={plan.byCategory[catKey] || 0}
                open={!!open[catKey]}
                onToggle={() => toggle(catKey)}
              >
                {Object.entries(items).map(([itemKey, item], i) => (
                  <View key={itemKey}>
                    {i > 0 ? <Divider /> : null}
                    <BudgetItem
                      section="gastos"
                      cat={catKey}
                      itemKey={itemKey}
                      label={ITEM_LABELS[itemKey] || itemKey}
                      item={item}
                      showEssential={catKey !== 'creditos'}
                      onChange={setField}
                      onOpenPeriod={openPeriod}
                    />
                  </View>
                ))}
              </Group>
            );
          })}

          <SectionTitle title="Ahorro" />
          <Group
            icon="wallet-outline" iconColor={C.savings} title="Meta de ahorro" total={plan.ahorro}
            open={!!open.ahorro} onToggle={() => toggle('ahorro')}
          >
            <BudgetItem
              section="ahorro"
              itemKey="ahorro"
              label="Ahorro del mes"
              item={data.ahorro}
              onChange={setField}
              onOpenPeriod={openPeriod}
            />
          </Group>

          <Card padded={false} style={{ marginTop: SPACE.xl, paddingHorizontal: SPACE.lg }}>
            <ListRow icon="repeat-outline" title="Pagos fijos" subtitle="Recordatorios de cobros mensuales" onPress={() => navigation.navigate('Pagos')} />
          </Card>

          <Txt variant="caption" faint center style={{ marginTop: SPACE.lg }}>
            Los cambios de {mesLabel(mes).toLowerCase()} se guardan solos.
          </Txt>
        </>
      )}

      <Sheet visible={!!periodTarget} onClose={() => setPeriodTarget(null)} title="Cada cuánto se paga">
        {PERIODICIDADES.map((p, i) => (
          <View key={p.value}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={p.label}
              onPress={() => {
                if (periodTarget) setField(periodTarget.section, periodTarget.cat, periodTarget.itemKey, 'periodicidad', p.value);
                setPeriodTarget(null);
              }}
              right={periodTarget?.current === p.value || (!periodTarget?.current && p.value === 'mensual')
                ? <Ionicons name="checkmark" size={18} color={C.brand} /> : <View />}
            />
          </View>
        ))}
      </Sheet>
    </Screen>
  );
}
