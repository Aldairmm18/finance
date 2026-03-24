import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Alert, Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const notificationService = {
  async requestPermissions() {
    if (!Device.isDevice) return false;
    try {
      // Android channel (debe crearse antes de pedir permisos en Android 13+)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('pagos', {
          name: 'Pagos recurrentes',
          importance: Notifications.AndroidImportance.HIGH,
          sound: true,
        });
      }
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') return true;
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      Alert.alert('Notificaciones', 'No se pudieron solicitar los permisos de notificación: ' + (e?.message || e));
      return false;
    }
  },

  async schedulePaymentReminder(payment) {
    try {
      // Calcular próxima fecha de pago
      const now = new Date();
      let paymentDate = new Date(now.getFullYear(), now.getMonth(), payment.day_of_month);
      if (paymentDate <= now) {
        paymentDate.setMonth(paymentDate.getMonth() + 1);
      }

      const notifyDate = new Date(paymentDate);
      notifyDate.setDate(notifyDate.getDate() - (payment.notify_days_before ?? 3));

      if (notifyDate <= now) return null; // Ya pasó

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💳 Pago próximo',
          body: `${payment.name} — $${Number(payment.amount).toLocaleString('es-CO')} se cobra el día ${payment.day_of_month}`,
          data: { paymentId: payment.id },
          channelId: 'pagos',
        },
        trigger: {
          date: notifyDate,
        },
      });
      return id;
    } catch (e) {
      Alert.alert('Error de notificación', 'No se pudo programar el recordatorio: ' + (e?.message || e));
      return null;
    }
  },

  async cancelAllPaymentNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (e) {
      console.warn('Error cancelando notificaciones:', e?.message);
    }
  },

  async rescheduleAll(payments) {
    await this.cancelAllPaymentNotifications();
    for (const p of (payments || []).filter(p => p.is_active)) {
      await this.schedulePaymentReminder(p);
    }
  },
};
