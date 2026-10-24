import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Field,
  IconButton,
  Screen,
  SectionTitle,
  confirmAction,
  formatDayMonth,
  formatMinutes,
  showError,
  useTheme,
} from '@/components/rantau-kit';
import {
  getSickMode,
  type SickModeSettings,
} from '@/services/app-blocker.service';
import { initServiceTables } from '@/services/local-database.service';
import {
  addWorkout,
  deleteWorkout,
  getTotalWorkoutMinutes,
  getWorkoutLogs,
  type WorkoutLog,
} from '@/services/workout.service';

const PRESETS = [
  { title: 'Push-up', minutes: 10 },
  { title: 'Sit-up dan plank', minutes: 10 },
  { title: 'Squat dan lunges', minutes: 15 },
  { title: 'Jumping jack', minutes: 10 },
  { title: 'Skipping', minutes: 15 },
  { title: 'Peregangan atau yoga', minutes: 20 },
  { title: 'Lari pagi', minutes: 30 },
];

function startOfWeek(now = new Date()): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // Senin
  return date;
}

export default function WorkoutScreen() {
  const t = useTheme();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [total, setTotal] = useState(0);
  const [sick, setSick] = useState<SickModeSettings | null>(null);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('15');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      await initServiceTables();
      setLogs(await getWorkoutLogs(100));
      setTotal(await getTotalWorkoutMinutes());
      setSick(await getSickMode());
    } catch (error) {
      showError(error, 'Gagal memuat riwayat olahraga');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const week = useMemo(() => {
    const start = startOfWeek();
    const items = logs.filter((log) => new Date(log.completed_at) >= start);
    return {
      sessions: items.length,
      minutes: items.reduce((sum, log) => sum + log.duration_minutes, 0),
    };
  }, [logs]);

  const save = async () => {
    const duration = Number.parseInt(minutes, 10);

    if (!title.trim()) {
      Alert.alert(
        'Nama olahraga kosong',
        'Pilih salah satu gerakan di atas atau ketik sendiri.',
      );
      return;
    }
    if (!Number.isFinite(duration) || duration < 1) {
      Alert.alert('Durasi tidak valid', 'Isi durasi minimal 1 menit.');
      return;
    }

    setSaving(true);
    try {
      await addWorkout({ title, durationMinutes: duration, notes });
      setTitle('');
      setNotes('');
      await load();
    } catch (error) {
      showError(error, 'Olahraga tidak bisa dicatat');
    } finally {
      setSaving(false);
    }
  };

  const remove = (log: WorkoutLog) =>
    confirmAction(
      'Hapus catatan?',
      `Catatan "${log.title}" akan dihapus.`,
      'Hapus',
      async () => {
        try {
          await deleteWorkout(log.id);
          await load();
        } catch (error) {
          showError(error, 'Gagal menghapus');
        }
      },
    );

  return (
    <Screen
      icon="barbell-outline"
      title="Workout kost"
      subtitle="Kelola jadwal olahraga tanpa gym."
      refreshing={refreshing}
      onRefresh={refresh}>
      {sick?.enabled ? (
        <Banner tone="warn">
          Mode sakit aktif. Pilih peregangan ringan atau istirahat dulu sampai
          kondisimu membaik.
        </Banner>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.muted, fontSize: 13 }}>Minggu ini</Text>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: '700' }}>
            {formatMinutes(week.minutes)}
          </Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {week.sessions} sesi
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.muted, fontSize: 13 }}>Sepanjang waktu</Text>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: '700' }}>
            {formatMinutes(total)}
          </Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {logs.length} sesi tercatat
          </Text>
        </Card>
      </View>

      <Card>
        <SectionTitle>Catat olahraga</SectionTitle>
        <Text style={{ color: t.muted, fontSize: 13 }}>
          Pilih gerakan yang bisa dilakukan di kamar kost
        </Text>
        <ChipRow>
          {PRESETS.map((preset) => (
            <Chip
              key={preset.title}
              label={preset.title}
              selected={title === preset.title}
              onPress={() => {
                setTitle(preset.title);
                setMinutes(String(preset.minutes));
              }}
            />
          ))}
        </ChipRow>
        <Field
          label="Nama olahraga"
          value={title}
          onChangeText={setTitle}
          placeholder="Contoh: Push-up"
          maxLength={60}
        />
        <Field
          label="Durasi (menit)"
          value={minutes}
          onChangeText={(text) => setMinutes(text.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={4}
        />
        <Field
          label="Catatan (opsional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Contoh: 3 set x 15 repetisi"
          maxLength={200}
        />
        <Button
          label="Simpan"
          icon="checkmark"
          loading={saving}
          onPress={save}
        />
      </Card>

      <SectionTitle>Riwayat</SectionTitle>
      {logs.length === 0 ? (
        <EmptyState
          icon="barbell-outline"
          title="Belum ada catatan"
          hint="Catat olahraga pertamamu. Sesi 10 menit pun sudah dihitung."
        />
      ) : (
        logs.map((log) => (
          <Card
            key={log.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>
                {log.title}
              </Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>
                {formatMinutes(log.duration_minutes)}, {formatDayMonth(new Date(log.completed_at))}
              </Text>
              {log.notes ? (
                <Text style={{ color: t.muted, fontSize: 13 }}>{log.notes}</Text>
              ) : null}
            </View>
            <IconButton
              icon="trash-outline"
              label={`Hapus ${log.title}`}
              onPress={() => remove(log)}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}