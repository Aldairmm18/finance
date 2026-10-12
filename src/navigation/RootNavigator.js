import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Txt, TAB_BAR_HEIGHT } from '../components/ui';
import { useTransactionSheet } from '../components/TransactionSheet';
import { RADIUS } from '../theme/tokens';

import HomeScreen from '../screens/HomeScreen';
import MovementsScreen from '../screens/MovementsScreen';
import PlanScreen from '../screens/PlanScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RecurringPaymentsScreen from '../screens/RecurringPaymentsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TABS = {
  Inicio:      { label: 'Inicio',      icon: 'home' },
  Movimientos: { label: 'Movimientos', icon: 'list' },
  Plan:        { label: 'Plan',        icon: 'wallet' },
  Analisis:    { label: 'Análisis',    icon: 'bar-chart' },
};

function TabBar({ state, navigation }) {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();
  const { openNew } = useTransactionSheet();

  const renderTab = (route, index) => {
    const meta = TABS[route.name];
    const focused = state.index === index;
    const color = focused ? C.brand : C.textFaint;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
      >
        <Ionicons name={focused ? meta.icon : `${meta.icon}-outline`} size={22} color={color} />
        <Txt variant="caption" color={color} style={{ fontSize: 11, fontWeight: focused ? '600' : '400' }}>{meta.label}</Txt>
      </Pressable>
    );
  };

  const tabs = state.routes.map(renderTab);
  return (
    <View style={{
      flexDirection: 'row',
      height: TAB_BAR_HEIGHT + insets.bottom,
      paddingBottom: insets.bottom,
      backgroundColor: C.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    }}>
      {tabs.slice(0, 2)}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable
          onPress={() => openNew('gasto')}
          accessibilityRole="button"
          accessibilityLabel="Registrar movimiento"
          style={({ pressed }) => ({
            width: 48, height: 48, borderRadius: RADIUS.md + 2,
            backgroundColor: C.brand,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="add" size={28} color={C.onBrand} />
        </Pressable>
      </View>
      {tabs.slice(2)}
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, lazy: true }}>
      <Tab.Screen name="Inicio" component={HomeScreen} />
      <Tab.Screen name="Movimientos" component={MovementsScreen} />
      <Tab.Screen name="Plan" component={PlanScreen} />
      <Tab.Screen name="Analisis" component={AnalysisScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { colors: C } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.text,
        headerTitleStyle: { fontWeight: '600' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: C.bg },
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Ajustes" component={SettingsScreen} />
      <Stack.Screen name="Pagos" component={RecurringPaymentsScreen} options={{ title: 'Pagos fijos' }} />
    </Stack.Navigator>
  );
}
