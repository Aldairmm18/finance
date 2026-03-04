import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import DashboardScreen from '../screens/DashboardScreen';
import PresupuestoScreen from '../screens/PresupuestoScreen';
import FlujoMensualScreen from '../screens/FlujoMensualScreen';
import TranquilidadScreen from '../screens/TranquilidadScreen';
import { COLORS } from '../utils/calculations';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: COLORS.teal,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 11 },
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Dashboard: 'grid-outline',
            Presupuesto: 'wallet-outline',
            FlujoMensual: 'calendar-outline',
            Tranquilidad: 'leaf-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Presupuesto" component={PresupuestoScreen} options={{ tabBarLabel: 'Presupuesto' }} />
      <Tab.Screen name="FlujoMensual" component={FlujoMensualScreen} options={{ tabBarLabel: 'Flujo' }} />
      <Tab.Screen name="Tranquilidad" component={TranquilidadScreen} options={{ tabBarLabel: 'Tranquilidad' }} />
    </Tab.Navigator>
  );
}
