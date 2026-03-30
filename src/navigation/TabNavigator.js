import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

const Tab = createBottomTabNavigator();

const ICONS = {
  Dashboard:          'grid-outline',
  Presupuesto:        'wallet-outline',
  ResumenMes:         'bar-chart-outline',
  FlujoMensual:       'swap-vertical-outline',
  Gastos:             'receipt-outline',
  Config:             'settings-outline',
};

// Pantallas con ícono de MaterialCommunityIcons
const MCI_ICONS = {
  Recurrentes: 'bell-ring',
};

export default function TabNavigator() {
  const { colors: C } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        lazy: false,
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: C.teal,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: 11 },
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          if (MCI_ICONS[route.name]) {
            return <MaterialCommunityIcons name={MCI_ICONS[route.name]} size={size} color={color} />;
          }
          return <Ionicons name={ICONS[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard"    component={DashboardScreen}          options={{ tabBarLabel: 'Dashboard'  }} />
      <Tab.Screen name="Presupuesto"  component={PresupuestoScreen}        options={{ tabBarLabel: 'Presupuesto'}} />
      <Tab.Screen name="ResumenMes"   component={ResumenMesScreen}         options={{ tabBarLabel: 'Resumen'    }} />
      <Tab.Screen name="FlujoMensual" component={FlujoMensualScreen}       options={{ tabBarLabel: 'Flujo'      }} />
      <Tab.Screen name="Gastos"       component={GastosScreen}             options={{ tabBarLabel: 'Gastos'     }} />
      <Tab.Screen name="Recurrentes"  component={RecurringPaymentsScreen}  options={{ tabBarLabel: 'Pagos'      }} />
      <Tab.Screen name="Config"       component={ConfigScreen}             options={{ tabBarLabel: 'Config'     }} />
    </Tab.Navigator>
  );
}
