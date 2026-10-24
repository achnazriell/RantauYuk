import { Platform } from 'react-native';
if (Platform.OS === 'android') {
  // konfigurasi notification channel
}

type NotificationModule = typeof import('expo-notifications');

let handlerConfigured = false;

async function getNotifications(): Promise<NotificationModule> {
  try {
    const mod = await import('expo-notifications');

    // Tanpa handler, notifikasi tidak muncul saat aplikasi sedang dibuka.
    if (!handlerConfigured) {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      handlerConfigured = true;
    }

    return mod;
  } catch (error) {
    console.error('Modul notifikasi tidak tersedia:', error);
    throw new Error(
      'Modul notifikasi tidak tersedia di lingkungan ini. ' +
      'Periksa versi Expo dan gunakan development build jika diperlukan.'
    );
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotifications();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return false;
  }

  if (process.env.EXPO_OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifikasi Rantau Yuk',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return true;
}

export async function sendLocalNotification(
  title: string,
  body: string,
): Promise<string> {
  const Notifications = await getNotifications();
  const allowed = await requestNotificationPermission();

  if (!allowed) {
    throw new Error('Izin notifikasi belum diberikan.');
  }

  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

export async function scheduleNotification(
  title: string,
  body: string,
  date: Date,
): Promise<string> {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('Tanggal notifikasi tidak valid.');
  }

  if (date.getTime() <= Date.now()) {
    throw new Error('Waktu notifikasi harus di masa depan.');
  }

  const Notifications = await getNotifications();
  const allowed = await requestNotificationPermission();

  if (!allowed) {
    throw new Error('Izin notifikasi belum diberikan.');
  }

  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

export async function cancelNotification(
  notificationId: string,
): Promise<void> {
  const Notifications = await getNotifications();
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllNotifications(): Promise<void> {
  const Notifications = await getNotifications();
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications() {
  const Notifications = await getNotifications();
  return Notifications.getAllScheduledNotificationsAsync();
}