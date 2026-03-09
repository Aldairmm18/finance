import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart } from 'react-native-chart-kit';
import { loadData } from '../utils/storage';
import { formatCOP, computeTotals } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';

const screenWidth = Dimensions.get('window').width;

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
  const { colors: C } = useTheme();
  return (
    <View style={[
      { backgroundColor: C.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
      half && { flex: 1 },
    ]}>
      <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: 'bold', color: valueColor || C.text }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{sub}</Text> : null}
    </View>
  );
}

function ChartCard({ title, children }) {
  const { colors: C } = useTheme();
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12 }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 12, textAlign: 'center' }}>{title}</Text>
      {children}
    </View>
  );
}

function NoData() {
  const { colors: C } = useTheme();
  return (
    <Text style={{ color: C.textMuted, textAlign: 'center', paddingVertical: 24, fontStyle: 'italic' }}>
      Ingresa datos en Presupuesto para ver la gráfica
    </Text>
  );
}

export default function DashboardScreen() {
  const [totals, setTotals] = useState(null);
  const { colors: C } = useTheme();

  useFocusEffect(
    React.useCallback(() => {
      loadData().then(d => setTotals(computeTotals(d)));
    }, [])
  );

  const s = useMemo(() => makeStyles(C), [C]);

  if (!totals) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.textMuted }}>Cargando...</Text>
      </View>
    );
  }

  const chartCfg = {
    backgroundColor: C.card,
    backgroundGradientFrom: C.card,
    backgroundGradientTo: C.card,
    color: (opacity = 1) => `rgba(128, 128, 128, ${opacity})`,
  };

  const flujoCajaColor = totals.flujoCaja >= 0 ? C.teal : C.pink;
  const flujoAhorroColor = totals.flujoCajaConAhorro >= 0 ? C.teal : C.pink;

  const gastosChartData = Object.entries(GASTOS_META)
    .map(([k, m]) => ({
      name: m.label,
      population: Math.round(totals.gastosByCategory[k] || 0),
      color: m.color,
      legendFontColor: C.text,
      legendFontSize: 11,
    }))
    .filter(d => d.population > 0);

  const ingresosChartData = Object.entries(INGRESOS_META)
    .map(([k, m]) => ({
      name: m.label,
      population: Math.round(totals.ingresosBySource[k] || 0),
      color: m.color,
      legendFontColor: C.text,
      legendFontSize: 11,
    }))
    .filter(d => d.population > 0);

  const tipoGastoData = [
    { name: 'Esenciales', population: Math.round(totals.esencialesMonthly), color: C.teal, legendFontColor: C.text, legendFontSize: 11 },
    { name: 'No Esenciales', population: Math.round(totals.noEsencialesMonthly), color: C.pink, legendFontColor: C.text, legendFontSize: 11 },
    { name: 'Créditos', population: Math.round(totals.creditosMonthly), color: C.purple, legendFontColor: C.text, legendFontSize: 11 },
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
          valueColor={C.teal}
          half
        />
        <StatCard
          label="Gastos Mensuales"
          value={formatCOP(totals.totalGastosMonthly)}
          sub={formatCOP(totals.totalGastosAnual) + '/año'}
          valueColor={C.pink}
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

      <View style={{ backgroundColor: C.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12 }}>
        <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Fondo de Emergencia (3 meses esenciales)</Text>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: C.purple }}>{formatCOP(totals.fondoEmergencia)}</Text>
        <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          Basado en {formatCOP(totals.esencialesMonthly)}/mes en gastos esenciales
        </Text>
      </View>

      <ChartCard title="¿En qué estás gastando?">
        {gastosChartData.length > 0 ? (
          <PieChart
            data={gastosChartData}
            width={chartWidth}
            height={200}
            chartConfig={chartCfg}
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
            chartConfig={chartCfg}
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
            chartConfig={chartCfg}
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

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingTop: 52, paddingBottom: 32 },
    title: { fontSize: 28, fontWeight: 'bold', color: C.text, marginBottom: 20 },
    row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  });
}
