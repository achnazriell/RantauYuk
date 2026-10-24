import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import { exportBackup } from '@/services/backup.service';
import { setSickMode } from '@/services/app-blocker.service';
import { requestNotificationPermission } from '@/services/notifications.service';

import {
  Badge,
  Button,
  EmptyState,
  ListGroup,
  ListRow,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/components/ui';
import { colors, font, radius, spacing } from '@/theme';

type Profile = {
  name: string;
  occupation_status: string;
  income_type: string;
  monthly_budget: number;
  payday_date: number;
  food_preference: string;
  religion_mode: string;
  city_location: string | null;
  strict_mode_enabled: number;
};

function rupiah(value: number): string {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function foodLabel(value: string): string {
  if (value === 'hemat') return 'Hemat';
  if (value === 'sehat') return 'Sehat';

  return 'Hemat dan sehat';
}

export default function ProfileScreen() {
  const db = useSQLiteContext();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);

    try {
      const row = await db.getFirstAsync<Profile>(
        `
        SELECT
          name,
          occupation_status,
          income_type,
          monthly_budget,
          payday_date,
          food_preference,
          religion_mode,
          city_location,
          strict_mode_enabled
        FROM user_preferences
        WHERE id = 1
        `
      );

      if (row) {
        setProfile(row);
        setStrictMode(row.strict_mode_enabled === 1);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('Gagal memuat profil:', error);
      Alert.alert(
        'Gagal memuat profil',
        'Data profil tidak dapat dibaca dari database. Pastikan database sudah diinisialisasi.'
      );
    } finally {
      setLoadingProfile(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  async function toggleStrictMode(value: boolean) {
    const previousValue = strictMode;
    setStrictMode(value);

    try {
      const result = await db.runAsync(
        `
        UPDATE user_preferences
        SET strict_mode_enabled = ?
        WHERE id = 1
        `,
        value ? 1 : 0
      );

      if (result.changes === 0) {
        throw new Error('Data profil tidak ditemukan.');
      }

      setProfile((current) =>
        current
          ? { ...current, strict_mode_enabled: value ? 1 : 0 }
          : current
      );
    } catch (error) {
      console.error('Gagal memperbarui Strict Mode:', error);
      setStrictMode(previousValue);

      Alert.alert(
        'Gagal',
        'Strict Mode gagal diperbarui. Periksa apakah data profil tersedia.'
      );
    }
  }

  async function handleBackup() {
    if (saving) return;

    try {
      setSaving(true);

      const uri = await exportBackup(db);

      Alert.alert(
        'Backup selesai',
        `File backup berhasil dibuat.\n\nLokasi file:\n${uri}`
      );
    } catch (error) {
      console.error('Backup gagal:', error);

      Alert.alert(
        'Backup gagal',
        error instanceof Error
          ? error.message
          : 'Tidak berhasil membuat backup data. Periksa tabel database dan coba lagi.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleNotification() {
    if (notificationLoading) return;

    try {
      setNotificationLoading(true);

      const allowed = await requestNotificationPermission();

      if (allowed) {
        Alert.alert(
          'Izin notifikasi aktif',
          'Izin notifikasi sudah diberikan. Reminder tetap harus dijadwalkan oleh fitur terkait.'
        );
      } else {
        Alert.alert(
          'Izin belum diberikan',
          'Izin notifikasi belum diberikan. Periksa pengaturan notifikasi aplikasi pada perangkat.'
        );
      }
    } catch (error) {
      console.error('Gagal meminta izin notifikasi:', error);

      Alert.alert(
        'Notifikasi tidak tersedia',
        error instanceof Error
          ? error.message
          : 'Tidak dapat mengakses notifikasi. Periksa konfigurasi Expo dan gunakan development build jika diperlukan.'
      );
    } finally {
      setNotificationLoading(false);
    }
  }

  function handleSickMode() {
    Alert.alert(
      'Mode sakit',
      'Mode ini mempause aktivitas berat dan menggunakan batas hiburan. Aktifkan?',
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Aktifkan',
          onPress: async () => {
            try {
              await setSickMode(db, true, 'Lainnya');

              Alert.alert(
                'Mode sakit aktif',
                'Mode sakit berhasil diaktifkan.'
              );
            } catch (error) {
              console.error('Gagal mengaktifkan Mode Sakit:', error);

              Alert.alert(
                'Gagal',
                'Mode sakit tidak berhasil diaktifkan. Periksa service dan tabel database terkait.'
              );
            }
          },
        },
      ]
    );
  }

  if (loadingProfile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <ScreenHeader title="Profil" />

        <EmptyState
          icon="person-outline"
          title="Data profil belum tersedia"
          description="Pastikan proses onboarding sudah menyimpan profil dengan id = 1."
          action={
            <Button
              label="Muat ulang profil"
              icon="refresh"
              variant="secondary"
              onPress={() => void loadProfile()}
            />
          }
        />
      </Screen>
    );
  }

  const isIslam = profile.religion_mode === 'islam';
  const isStudent = profile.occupation_status === 'kuliah';

  return (
    <Screen>
      <ScreenHeader
        title="Profil"
        subtitle="Atur identitas, preferensi, dan perilaku aplikasi."
      />

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile.name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.profileText}>
          <Text style={font.title} numberOfLines={1}>
            {profile.name}
          </Text>

          <View style={styles.badges}>
            <Badge
              label={isStudent ? 'Mahasiswa' : 'Pekerja'}
              icon={isStudent ? 'school-outline' : 'briefcase-outline'}
              tone="primary"
            />

            <Badge
              label={profile.city_location || 'Lokasi belum diatur'}
              icon="location-outline"
            />
          </View>
        </View>
      </View>

      <SectionHeader title="Keuangan" />

      <ListGroup>
        <ListRow
          icon="wallet-outline"
          title="Budget bulanan"
          value={rupiah(profile.monthly_budget)}
        />

        <ListRow
          icon="calendar-outline"
          title="Tanggal cair"
          value={`Tanggal ${profile.payday_date}`}
        />

        <ListRow
          icon="cash-outline"
          title="Sumber dana"
          value={
            profile.income_type === 'uang_saku'
              ? 'Uang saku'
              : 'Gaji sendiri'
          }
        />
      </ListGroup>

      <SectionHeader title="Preferensi" />

      <ListGroup>
        <ListRow
          icon="nutrition-outline"
          tone="accent"
          title="Mode makanan"
          value={foodLabel(profile.food_preference)}
        />

        <ListRow
          icon={isIslam ? 'moon-outline' : 'leaf-outline'}
          title={isIslam ? 'Pelacak sholat' : 'Habit tracker'}
          subtitle={isIslam ? 'Mode Islam' : 'Mode umum'}
          onPress={() => router.push(isIslam ? '/prayer' : '/habits')}
        />
      </ListGroup>

      <SectionHeader title="Produktivitas" />

      <ListGroup>
        <ListRow
          icon="shield-checkmark-outline"
          title="Strict Mode"
          subtitle="Tandai tugas prioritas sebagai syarat enforcement"
          right={
            <Switch
              value={strictMode}
              onValueChange={toggleStrictMode}
              trackColor={{
                false: colors.borderStrong,
                true: colors.primary,
              }}
              thumbColor={colors.surface}
            />
          }
        />

        <ListRow
          icon="bed-outline"
          title="Kelola mode sakit"
          onPress={() => router.push('/sick-mode')}
        />

        <ListRow
          icon="medkit-outline"
          tone="danger"
          title="Aktifkan mode sakit"
          subtitle="Pause aktivitas berat selama pemulihan"
          onPress={handleSickMode}
        />
      </ListGroup>

      <SectionHeader title="Alat bantu" />

      <ListGroup>
        <ListRow
          icon="barbell-outline"
          title="Workout"
          onPress={() => router.push('/workout')}
        />

        <ListRow
          icon="location-outline"
          title="Cari tempat sekitar"
          onPress={() => router.push('/places')}
        />

        <ListRow
          icon="sparkles-outline"
          title="Rantau AI"
          onPress={() => router.push('/assistant')}
        />
      </ListGroup>

      <SectionHeader title="Data dan notifikasi" />

      <ListGroup>
        <ListRow
          icon="download-outline"
          title="Backup data"
          subtitle="Simpan data sebagai file JSON"
          disabled={saving}
          right={
            saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : undefined
          }
          onPress={handleBackup}
        />

        <ListRow
          icon="notifications-outline"
          title="Izin notifikasi"
          subtitle="Aktifkan agar pengingat bisa muncul"
          disabled={notificationLoading}
          right={
            notificationLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : undefined
          }
          onPress={handleNotification}
        />
      </ListGroup>

      <Text style={styles.note}>
        Backup dapat dibagikan lewat aplikasi di perangkatmu. Sinkronisasi
        Google Drive belum termasuk. Izin notifikasi tidak otomatis
        menjadwalkan pengingat; jika Expo Go tidak mendukung, gunakan
        development build.
      </Text>

      <View style={styles.footer}>
        <View style={styles.brandMark}>
          <Ionicons
            name="compass-outline"
            size={20}
            color={colors.onPrimary}
          />
        </View>

        <Text style={font.heading}>Rantau Yuk</Text>

        <Text style={font.caption}>
          Personal operating system untuk anak rantau.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
  },
  profileText: {
    flex: 1,
    gap: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  note: {
    ...font.micro,
    lineHeight: 17,
  },

  footer: {
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.lg,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: 4,
  },
});
