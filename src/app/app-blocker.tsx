
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import {
  getFocusSettings,
  getFocusSessionStatus,
  startFocusSession,
  stopFocusSession,
  type FocusSettings,
  type FocusSessionStatus,
} from '@/services/app-blocker.service';

import { Screen, ScreenHeader } from '@/components/ui';
import { colors, font, radius, spacing } from '@/theme';

const DURATIONS = [15, 25, 45, 60];

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function AppBlockerScreen() {
  const db = useSQLiteContext();

  const [settings, setSettings] = useState<FocusSettings | null>(null);
  const [status, setStatus] = useState<FocusSessionStatus>({
    active: false,
    remainingSeconds: 0,
  });
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [nextSettings, nextStatus] = await Promise.all([
        getFocusSettings(db),
        getFocusSessionStatus(db),
      ]);

      setSettings(nextSettings);
      setStatus(nextStatus);
      setSelectedDuration(nextSettings.durationMinutes);
    } catch (error) {
      console.error('Gagal memuat App Blocker:', error);
      Alert.alert(
        'Gagal memuat App Blocker',
        error instanceof Error
          ? error.message
          : 'Pengaturan sesi fokus tidak dapat dibaca.',
      );
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  useEffect(() => {
    if (!status.active) return;

    const timer = setInterval(async () => {
      try {
        const nextStatus = await getFocusSessionStatus(db);
        setStatus(nextStatus);

        if (!nextStatus.active) {
          const nextSettings = await getFocusSettings(db);
          setSettings(nextSettings);
        }
      } catch (error) {
        console.error('Gagal memperbarui waktu fokus:', error);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [db, status.active]);

  async function handleStart() {
    if (saving || status.active) return;

    setSaving(true);

    try {
      const nextSettings = await startFocusSession(
        selectedDuration,
        db,
      );
      const nextStatus = await getFocusSessionStatus(db);

      setSettings(nextSettings);
      setStatus(nextStatus);
    } catch (error) {
      console.error('Gagal memulai sesi fokus:', error);
      Alert.alert(
        'Sesi fokus gagal dimulai',
        error instanceof Error
          ? error.message
          : 'Periksa database, lalu coba lagi.',
      );
    } finally {
      setSaving(false);
    }
  }

  function handleStop() {
    Alert.alert(
      'Akhiri sesi fokus?',
      'Waktu fokus yang sedang berjalan akan dihentikan.',
      [
        { text: 'Lanjut fokus', style: 'cancel' },
        {
          text: 'Akhiri sesi',
          style: 'destructive',
          onPress: async () => {
            if (saving) return;

            setSaving(true);

            try {
              const nextSettings = await stopFocusSession(db);
              setSettings(nextSettings);
              setStatus({
                active: false,
                remainingSeconds: 0,
              });
            } catch (error) {
              console.error('Gagal menghentikan sesi fokus:', error);
              Alert.alert(
                'Gagal',
                error instanceof Error
                  ? error.message
                  : 'Sesi fokus tidak dapat dihentikan.',
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Memuat pengaturan fokus...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>

        <ScreenHeader
          title="App Blocker"
          subtitle="Atur sesi fokus untuk membantu menjaga produktivitas."
        />

        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons
              name={status.active ? 'timer' : 'shield-checkmark-outline'}
              size={28}
              color={colors.primary}
            />
          </View>

          <Text style={font.title}>
            {status.active ? 'Sesi fokus berjalan' : 'Siap untuk fokus?'}
          </Text>

          <Text style={styles.timer}>
            {status.active
              ? formatTime(status.remainingSeconds)
              : formatTime(selectedDuration * 60)}
          </Text>

          <Text style={styles.muted}>
            {status.active
              ? 'Waktu tersisa pada sesi fokus ini'
              : 'Pilih durasi, lalu mulai sesi fokus'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Durasi fokus</Text>

        <View style={styles.durationRow}>
          {DURATIONS.map((duration) => {
            const selected = selectedDuration === duration;

            return (
              <Pressable
                key={duration}
                accessibilityRole="button"
                accessibilityState={{
                  selected,
                  disabled: status.active || saving,
                }}
                disabled={status.active || saving}
                onPress={() => setSelectedDuration(duration)}
                style={[
                  styles.durationOption,
                  selected && styles.durationSelected,
                  (status.active || saving) && styles.disabled,
                ]}
              >
                <Text
                  style={[
                    styles.durationNumber,
                    selected && styles.durationTextSelected,
                  ]}
                >
                  {duration}
                </Text>
                <Text
                  style={[
                    styles.durationLabel,
                    selected && styles.durationTextSelected,
                  ]}
                >
                  menit
                </Text>
              </Pressable>
            );
          })}
        </View>

        {status.active ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={handleStop}
            style={[styles.actionButton, styles.stopButton]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="stop-circle-outline" size={21} color="#FFFFFF" />
                <Text style={styles.actionText}>Akhiri sesi fokus</Text>
              </>
            )}
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={handleStart}
            style={[styles.actionButton, saving && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="play-circle-outline" size={21} color={colors.onPrimary} />
                <Text style={styles.actionText}>Mulai sesi fokus</Text>
              </>
            )}
          </Pressable>
        )}

        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={colors.primary}
          />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Batasan fitur saat ini</Text>
            <Text style={styles.infoText}>
              Sesi fokus menyimpan durasi dan menghitung sisa waktu.
              Versi ini belum memblokir aplikasi lain di Android,
              belum memilih aplikasi yang diblokir, dan tidak
              menjamin sesi tetap berjalan jika proses aplikasi ditutup.
            </Text>
          </View>
        </View>

        <Text style={styles.footerNote}>
          {settings?.startedAt
            ? `Sesi terakhir dimulai: ${new Date(
                settings.startedAt,
              ).toLocaleString('id-ID')}`
            : 'Belum ada sesi fokus yang dimulai.'}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  backText: {
    color: colors.primary,
    fontWeight: '600',
  },
  statusCard: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  timer: {
    fontSize: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: colors.primary,
  },
  muted: {
    ...font.caption,
    color: colors.textFaint,
    textAlign: 'center',
  },
  sectionTitle: {
    ...font.title,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationOption: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  durationSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  durationLabel: {
    fontSize: 12,
    color: colors.textFaint,
  },
  durationTextSelected: {
    color: colors.onPrimary,
  },
  actionButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  stopButton: {
    backgroundColor: '#B42318',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  infoContent: {
    flex: 1,
    gap: spacing.sm,
  },
  infoTitle: {
    fontWeight: '700',
    color: colors.primary,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textFaint,
  },
  footerNote: {
    ...font.micro,
    color: colors.textFaint,
  },
});
