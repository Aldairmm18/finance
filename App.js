import React, { useEffect, useMemo } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { TransactionSheetProvider } from './src/components/TransactionSheet';
import RootNavigator from './src/navigation/RootNavigator';
import AuthScreen from './src/screens/AuthScreen';
import { notificationService } from './src/services/notificationService';
import { recurringPaymentService } from './src/services/recurringPaymentService';

function Root() {
  const { mode, colors: C } = useTheme();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const granted = await notificationService.requestPermissions();
        if (granted) {
          const payments = await recurringPaymentService.getAll(user.id);
          await notificationService.rescheduleAll(payments);
        }
      } catch (e) {
        console.warn('Error inicializando notificaciones:', e?.message);
      }
    })();
  }, [user]);

  const navTheme = useMemo(() => {
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: C.brand, background: C.bg, card: C.card, text: C.text, border: C.border },
    };
  }, [mode, C]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {user ? (
        <NavigationContainer theme={navTheme}>
          <TransactionSheetProvider>
            <RootNavigator />
          </TransactionSheetProvider>
        </NavigationContainer>
      ) : (
        <AuthScreen />
      )}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
