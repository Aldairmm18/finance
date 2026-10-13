import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { nextMonthlyDate } from '../utils/dateUtils';
import { formatCOP } from '../utils/calculations';

// En Expo Go las push notifications fueron removidas desde SDK 53
const isExpoGo = Constants.appOwnership === 'expo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // SDK 53+: shouldShowAlert quedó obsoleto → Banner + List
    shouldShowBanner: true,
    shouldShowList: true,
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
      const daysBefore = payment.notify_days_before ?? 3;
      // Próximo cobro con el día ajustado al largo del mes (31 → 28/29/30).
      let paymentDate = nextMonthlyDate(payment.day_of_month, now);
      let notifyDate = new Date(paymentDate);
      notifyDate.setDate(notifyDate.getDate() - daysBefore);
      if (notifyDate <= now) {
        // El aviso de este ciclo ya pasó: programar el del siguiente cobro.
        paymentDate = nextMonthlyDate(payment.day_of_month, new Date(paymentDate.getTime() + 86400000));
        notifyDate = new Date(paymentDate);
        notifyDate.setDate(notifyDate.getDate() - daysBefore);
      }
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Pago próximo',
          body: `${payment.name}: ${formatCOP(payment.amount)} se cobra el día ${paymentDate.getDate()}`,
          data: { paymentId: payment.id },
        },
        trigger: {
          // SDK 53+: el trigger requiere `type`; channelId va aquí, no en content
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notifyDate,
          channelId: 'pagos',
        },
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
    // Cada recordatorio es independiente: se programan en paralelo.
    await Promise.all((payments || []).filter(p => p.is_active).map(p => this.schedulePaymentReminder(p)));
  },
};
