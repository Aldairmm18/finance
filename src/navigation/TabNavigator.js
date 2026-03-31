import React from 'react';
import { View } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

import DashboardScreen from '../screens/DashboardScreen';
import PresupuestoScreen from '../screens/PresupuestoScreen';
import ResumenMesScreen from '../screens/ResumenMesScreen';
import FlujoMensualScreen from '../screens/FlujoMensualScreen';
import GastosScreen from '../screens/GastosScreen';
import ConfigScreen from '../screens/ConfigScreen';
import RecurringPaymentsScreen from '../screens/RecurringPaymentsScreen';

const Tab = createMaterialTopTabNavigator();

const ICONS = {
  Dashboard:   'grid-outline',
  Presupuesto: 'wallet-outline',
  ResumenMes:  'bar-chart-outline',
  FlujoMensual:'swap-vertical-outline',
  Gastos:      'receipt-outline',
  Config:      'settings-outline',
};

const MCI_ICONS = {
  Recurrentes: 'bell-ring',
};

const TAB_LABELS = {
  Dashboard:   'Dashboard',
  Presupuesto: 'Presupuesto',
  ResumenMes:  'Resumen',
  FlujoMensual:'Flujo',
  Gastos:      'Gastos',
  Recurrentes: 'Pagos',
  Config:      'Config',
};

export default function TabNavigator() {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      screenOptions={({ route }) => ({
        lazy: false,
        swipeEnabled: true,
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarIndicatorStyle: {
          backgroundColor: C.teal,
          height: 2,
          top: 0,          // indicador arriba de la tab bar (posición bottom)
          bottom: undefined,
        },
        tabBarActiveTintColor: C.teal,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2 },
        tabBarPressColor: C.teal + '20',
        tabBarScrollEnabled: true,    // permite scroll si hay muchas tabs
        tabBarItemStyle: { width: 'auto', minWidth: 60, paddingHorizontal: 6 },
        headerShown: false,
        tabBarIcon: ({ color }) => {
          if (MCI_ICONS[route.name]) {
            return <MaterialCommunityIcons name={MCI_ICONS[route.name]} size={20} color={color} />;
          }
          return <Ionicons name={ICONS[route.name]} size={20} color={color} />;
        },
        tabBarShowIcon: true,
        tabBarLabel: TAB_LABELS[route.name] || route.name,
      })}
    >
      <Tab.Screen name="Dashboard"    component={DashboardScreen} />
      <Tab.Screen name="Presupuesto"  component={PresupuestoScreen} />
      <Tab.Screen name="ResumenMes"   component={ResumenMesScreen} />
      <Tab.Screen name="FlujoMensual" component={FlujoMensualScreen} />
      <Tab.Screen name="Gastos"       component={GastosScreen} />
      <Tab.Screen name="Recurrentes"  component={RecurringPaymentsScreen} />
      <Tab.Screen name="Config"       component={ConfigScreen} />
    </Tab.Navigator>
  );
}
