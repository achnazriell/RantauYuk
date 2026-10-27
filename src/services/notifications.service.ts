import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

type NotificationModule = typeof import('expo-notifications');

export type ScheduledNotification = Awaited<
  ReturnType<
    NotificationModule['getAllScheduledNotificationsAsync']
  >
>;

export interface NotificationPermissionResult {
  granted: boolean;
  status: string;
  canAskAgain: boolean;
}

let notificationModule: NotificationModule | null = null;
let handlerConfigured = false;
let androidChannelConfigured = false;

/**
 * Memuat modul notifikasi secara dinamis.
 * Pemanggilan dinamis membantu menangani lingkungan yang
 * tidak menyediakan modul notifikasi.
 */
async function getNotifications(): Promise<NotificationModule> {
  try {
    // Import statis: gunakan modul Expo yang terpasang di aplikasi.
    const mod = Notifications;

    // Pada runtime yang mendukungnya, atur tampilan foreground.
    // Jangan membuat seluruh service gagal hanya karena handler
    // tidak tersedia. SDK 58 menampilkan notifikasi foreground
    // secara default.
    const setHandler = (
      mod as Partial<NotificationModule>
    ).setNotificationHandler;

    if (
      !handlerConfigured &&
      typeof setHandler === 'function'
    ) {
      setHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      handlerConfigured = true;
    }

    // Pastikan API penjadwalan tersedia.
    if (
      typeof mod.scheduleNotificationAsync !== 'function'
    ) {
      throw new Error(
        'API penjadwalan notifikasi tidak tersedia. ' +
          'Periksa kecocokan versi Expo Go dan expo-notifications.',
      );
    }

    return mod;
  } catch (error) {
    console.error('Gagal memuat modul notifikasi:', error);

    throw error instanceof Error
      ? error
      : new Error('Modul notifikasi gagal dimuat.');
  }
}

/**
 * Menyiapkan notification channel Android.
 */
async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelConfigured) {
    return;
  }

  const Notifications =
    notificationModule ?? (await getNotifications());

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notifikasi Rantau Yuk',
    description: 'Pengingat dan notifikasi dari Rantau Yuk',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563EB',
    sound: 'default',
  });

  androidChannelConfigured = true;
}

/**
 * Memeriksa status izin notifikasi tanpa meminta izin baru.
 */
export async function getNotificationPermissionStatus():
  Promise<NotificationPermissionResult> {
  const Notifications = await getNotifications();
  const permission = await Notifications.getPermissionsAsync();

  return {
    granted: permission.granted,
    status: permission.status,
    canAskAgain: permission.canAskAgain,
  };
}

/**
 * Meminta izin notifikasi jika belum diberikan.
 */
export async function requestNotificationPermission():
  Promise<boolean> {
  const Notifications = await getNotifications();

  let permission = await Notifications.getPermissionsAsync();

  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!permission.granted) {
    return false;
  }

  await configureAndroidChannel();

  return true;
}

/**
 * Mengirim notifikasi langsung.
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<string> {
  const Notifications = await getNotifications();

  const allowed = await requestNotificationPermission();

  if (!allowed) {
    throw new Error(
      'Izin notifikasi belum diberikan. Aktifkan izin melalui pengaturan aplikasi.',
    );
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: null,
  });
}

/**
 * Menjadwalkan notifikasi pada tanggal dan waktu tertentu.
 */
export async function scheduleNotification(
  title: string,
  body: string,
  date: Date,
  data?: Record<string, unknown>,
): Promise<string> {
  if (
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {
    throw new Error('Tanggal notifikasi tidak valid.');
  }

  if (date.getTime() <= Date.now()) {
    throw new Error(
      'Waktu notifikasi harus berada di masa depan.',
    );
  }

  const Notifications = await getNotifications();
  const allowed = await requestNotificationPermission();

  if (!allowed) {
    throw new Error('Izin notifikasi belum diberikan.');
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

/**
 * Menjadwalkan notifikasi berdasarkan jeda waktu dalam detik.
 * Berguna untuk pengingat dan pengujian.
 */
export async function scheduleNotificationAfter(
  title: string,
  body: string,
  seconds: number,
  data?: Record<string, unknown>,
): Promise<string> {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(
      'Jeda notifikasi harus berupa angka positif.',
    );
  }

  const Notifications = await getNotifications();
  const allowed = await requestNotificationPermission();

  if (!allowed) {
    throw new Error('Izin notifikasi belum diberikan.');
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: {
      type:
        Notifications.SchedulableTriggerInputTypes
          .TIME_INTERVAL,
      seconds,
    },
  });
}

/**
 * Fungsi praktis untuk menguji notifikasi 5 detik kemudian.
 */
export async function testNotification(): Promise<string> {
  return scheduleNotificationAfter(
    'Tes RantauYuk 🔔',
    'Jika pesan ini muncul, notifikasi lokal berhasil dijadwalkan.',
    5,
    {
      type: 'notification_test',
      source: 'RantauYuk',
    },
  );
}

/**
 * Membatalkan satu notifikasi terjadwal.
 */
export async function cancelNotification(
  notificationId: string,
): Promise<void> {
  if (!notificationId.trim()) {
    throw new Error('ID notifikasi tidak boleh kosong.');
  }

  const Notifications = await getNotifications();

  await Notifications.cancelScheduledNotificationAsync(
    notificationId,
  );
}

/**
 * Membatalkan semua notifikasi yang masih terjadwal.
 */
export async function cancelAllNotifications(): Promise<void> {
  const Notifications = await getNotifications();

  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Mengambil seluruh notifikasi yang masih terjadwal.
 */
export async function getScheduledNotifications():
  Promise<ScheduledNotification> {
  const Notifications = await getNotifications();

  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Menghapus seluruh notifikasi yang sedang tampil di tray,
 * jika API tersebut didukung oleh versi Expo yang terpasang.
 */
export async function dismissAllNotifications(): Promise<void> {
  const Notifications = await getNotifications();

  await Notifications.dismissAllNotificationsAsync();
}
