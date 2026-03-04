import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart } from 'react-native-chart-kit';
import { loadData } from '../utils/storage';
import { COLORS, formatCOP, computeTotals } from '../utils/calculations';

const screenWidth = Dimensions.get('window').width;

const CHART_CFG = {
  backgroundColor: COLORS.card,
  backgroundGradientFrom: COLORS.card,
  backgroundGradientTo: COLORS.card,
  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
};

const GASTOS_META = {
  hogar: { label: 'Hogar', color: '#818cf8' },
  comida: { label: 'Comida', color: '#2dd4bf' },
  transporte: { label: 'Transporte', color: '#f59e0b' },
  creditos: { label: 'Créditos', color: '#f472b6' },
  entretenimiento: { label: 'Entretenimiento', color: '#60a5fa' },
  familia: { label: 'Familia', color: '#34d399' },
};

const INGRESOS_META = {
  salario: { label: 'Salario', color: '#2dd4bf' },
  bonos: { label: 'Bonos', color: '#818cf8' },
  dividendos: { label: 'Dividendos', color: '#f472b6' },
  comisiones: { label: 'Comisiones', color: '#60a5fa' },
  otros: { label: 'Otros', color: '#94a3b8' },
};

function StatCard({ label, value, sub, valueColor, half }) {
  return (
    <View style={[s.card, half && s.halfCard]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color: valueColor || COLORS.text }]}>{value}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

function ChartCard({ title, children }) {
  return (
    <View style={s.card}>
      <Text style={s.chartTitle}>{title}</Text>
      {children}
    </View>
  );
}

function NoData() {
  return <Text style={s.noData}>Ingresa datos en Presupuesto para ver la gráfica</Text>;
}

export default function DashboardScreen() {
  const [totals, setTotals] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      loadData().then(d => setTotals(computeTotals(d)));
    }, [])
  );

  if (!totals) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: COLORS.textMuted }}>Cargando...</Text>
      </View>
    );
  }

  const flujoCajaColor = totals.flujoCaja >= 0 ? COLORS.teal : COLORS.pink;
  const flujoAhorroColor = totals.flujoCajaConAhorro >= 0 ? COLORS.teal : COLORS.pink;

  const gastosChartData = Object.entries(GASTOS_META)
    .map(([k, m]) => ({
      name: m.label,
      population: Math.round(totals.gastosByCategory[k] || 0),
      color: m.color,
      legendFontColor: COLORS.text,
      legendFontSize: 11,
    }))
    .filter(d => d.population > 0);

  const ingresosChartData = Object.entries(INGRESOS_META)
    .map(([k, m]) => ({
      name: m.label,
      population: Math.round(totals.ingresosBySource[k] || 0),
      color: m.color,
      legendFontColor: COLORS.text,
      legendFontSize: 11,
    }))
    .filter(d => d.population > 0);

  const tipoGastoData = [
    { name: 'Esenciales', population: Math.round(totals.esencialesMonthly), color: COLORS.teal, legendFontColor: COLORS.text, legendFontSize: 11 },
    { name: 'No Esenciales', population: Math.round(totals.noEsencialesMonthly), color: COLORS.pink, legendFontColor: COLORS.text, legendFontSize: 11 },
    { name: 'Créditos', population: Math.round(totals.creditosMonthly), color: COLORS.purple, legendFontColor: COLORS.text, legendFontSize: 11 },
  ].filter(d => d.population > 0);

  const chartWidth = screenWidth - 64;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Dashboard</Text>

      <View style={s.row}>
        <StatCard
          label="Ingresos Mensuales"
          value={formatCOP(totals.ingresosMonthly)}
          sub={formatCOP(totals.ingresosAnual) + '/año'}
          valueColor={COLORS.teal}
          half
        />
        <StatCard
          label="Gastos Mensuales"
          value={formatCOP(totals.totalGastosMonthly)}
          sub={formatCOP(totals.totalGastosAnual) + '/año'}
          valueColor={COLORS.pink}
          half
        />
      </View>

      <View style={s.row}>
        <StatCard
          label="Flujo de Caja"
          value={formatCOP(totals.flujoCaja)}
          sub={formatCOP(totals.flujoCajaAnual) + '/año'}
          valueColor={flujoCajaColor}
          half
        />
        <StatCard
          label="Flujo con Ahorro"
          value={formatCOP(totals.flujoCajaConAhorro)}
          sub={formatCOP(totals.flujoCajaConAhorroAnual) + '/año'}
          valueColor={flujoAhorroColor}
          half
        />
      </View>

      <View style={s.card}>
        <Text style={s.statLabel}>Fondo de Emergencia (3 meses esenciales)</Text>
        <Text style={[s.statValue, { color: COLORS.purple }]}>{formatCOP(totals.fondoEmergencia)}</Text>
        <Text style={s.statSub}>
          Basado en {formatCOP(totals.esencialesMonthly)}/mes en gastos esenciales
        </Text>
      </View>

      <ChartCard title="¿En qué estás gastando?">
        {gastosChartData.length > 0 ? (
          <PieChart
            data={gastosChartData}
            width={chartWidth}
            height={200}
            chartConfig={CHART_CFG}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute={false}
          />
        ) : <NoData />}
      </ChartCard>

      <ChartCard title="¿De dónde vienen tus ingresos?">
        {ingresosChartData.length > 0 ? (
          <PieChart
            data={ingresosChartData}
            width={chartWidth}
            height={200}
            chartConfig={CHART_CFG}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute={false}
          />
        ) : <NoData />}
      </ChartCard>

      <ChartCard title="Tipo de Gasto">
        {tipoGastoData.length > 0 ? (
          <PieChart
            data={tipoGastoData}
            width={chartWidth}
            height={200}
            chartConfig={CHART_CFG}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute={false}
          />
        ) : <NoData />}
      </ChartCard>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingTop: 52, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  halfCard: { flex: 1 },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  chartTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 12, textAlign: 'center' },
  noData: { color: COLORS.textMuted, textAlign: 'center', paddingVertical: 24, fontStyle: 'italic' },
});
