import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// En Expo Go las push notifications fueron removidas desde SDK 53
const isExpoGo = Constants.appOwnership === 'expo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const notificationService = {
  async requestPermissions() {
    if (isExpoGo || !Device.isDevice) return false;
    try {
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
      console.warn('Notificaciones no disponibles:', e?.message);
      return false;
    }
  },

  async schedulePaymentReminder(payment) {
    if (isExpoGo) return null;
    try {
      const now = new Date();
      let paymentDate = new Date(now.getFullYear(), now.getMonth(), payment.day_of_month);
      if (paymentDate <= now) paymentDate.setMonth(paymentDate.getMonth() + 1);
      const notifyDate = new Date(paymentDate);
      notifyDate.setDate(notifyDate.getDate() - (payment.notify_days_before ?? 3));
      if (notifyDate <= now) return null;
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💳 Pago próximo',
          body: `${payment.name} — $${Number(payment.amount).toLocaleString('es-CO')} se cobra el día ${payment.day_of_month}`,
          data: { paymentId: payment.id },
          channelId: 'pagos',
        },
        trigger: { date: notifyDate },
      });
      return id;
    } catch (e) {
      console.warn('Error programando notificación:', e?.message);
      return null;
    }
  },

  async cancelAllPaymentNotifications() {
    if (isExpoGo) return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (e) {
      console.warn('Error cancelando notificaciones:', e?.message);
    }
  },

  async rescheduleAll(payments) {
    if (isExpoGo) return;
    await this.cancelAllPaymentNotifications();
    for (const p of (payments || []).filter(p => p.is_active)) {
      await this.schedulePaymentReminder(p);
    }
  },
};
