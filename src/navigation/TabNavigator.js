import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

import DashboardScreen from '../screens/DashboardScreen';
import PresupuestoScreen from '../screens/PresupuestoScreen';
import ResumenMesScreen from '../screens/ResumenMesScreen';
import TranquilidadScreen from '../screens/TranquilidadScreen';
import ConfigScreen from '../screens/ConfigScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  Dashboard:   'grid-outline',
  Presupuesto: 'wallet-outline',
  ResumenMes:  'bar-chart-outline',
  Tranquilidad:'leaf-outline',
  Config:      'settings-outline',
};

export default function TabNavigator() {
  const { colors: C } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
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
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard"    component={DashboardScreen}   options={{ tabBarLabel: 'Dashboard'   }} />
      <Tab.Screen name="Presupuesto"  component={PresupuestoScreen} options={{ tabBarLabel: 'Presupuesto' }} />
      <Tab.Screen name="ResumenMes"   component={ResumenMesScreen}  options={{ tabBarLabel: 'Resumen'     }} />
      <Tab.Screen name="Tranquilidad" component={TranquilidadScreen}options={{ tabBarLabel: 'Tranquilidad'}} />
      <Tab.Screen name="Config"       component={ConfigScreen}      options={{ tabBarLabel: 'Config'      }} />
    </Tab.Navigator>
  );
}
