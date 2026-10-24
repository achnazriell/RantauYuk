import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Field,
  IconButton,
  ProgressBar,
  Screen,
  SectionTitle,
  confirmAction,
  showError,
  useTheme,
} from '@/components/rantau-kit';
import {
  getSickMode,
  type SickModeSettings,
} from '@/services/app-blocker.service';
import {
  addHabit,
  deleteHabit,
  getHabitLogs,
  getHabitStreak,
  getHabits,
  markHabitCompleted,
  type Habit,
} from '@/services/habit.service';
import { initServiceTables } from '@/services/local-database.service';

const SUGGESTIONS = [
  'Minum 8 gelas air',
  'Tidur sebelum jam 11',
  'Masak sendiri',
  'Telepon keluarga',
  'Baca 10 halaman',
];

export default function HabitsScreen() {
  const t = useTheme();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [streaks, setStreaks] = useState<Record<number, number>>({});
  const [sick, setSick] = useState<SickModeSettings | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      await initServiceTables();
      const list = await getHabits();
      const logs = await getHabitLogs();

      const nextStreaks: Record<number, number> = {};
      for (const habit of list) {
        nextStreaks[habit.id] = await getHabitStreak(habit.id);
      }

      setHabits(list);
      setDone(
        new Set(logs.filter((log) => log.completed === 1).map((log) => log.habit_id)),
      );
      setStreaks(nextStreaks);
      setSick(await getSickMode());
    } catch (error) {
      showError(error, 'Gagal memuat kebiasaan');
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

  const add = async (name: string) => {
    const clean = name.trim();
    if (!clean || busy) return;

    setBusy(true);
    try {
      await addHabit(clean);
      setTitle('');
      await load();
    } catch (error) {
      showError(error, 'Kebiasaan tidak bisa ditambahkan');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (habit: Habit) => {
    const next = !done.has(habit.id);

    // Perbarui tampilan lebih dulu agar terasa cepat.
    setDone((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(habit.id);
      else copy.delete(habit.id);
      return copy;
    });

    try {
      await markHabitCompleted(habit.id, new Date(), next);
      const streak = await getHabitStreak(habit.id);
      setStreaks((prev) => ({ ...prev, [habit.id]: streak }));
    } catch (error) {
      showError(error, 'Gagal menyimpan');
      await load();
    }
  };

  const remove = (habit: Habit) =>
    confirmAction(
      'Hapus kebiasaan?',
      `"${habit.title}" beserta riwayatnya akan dihapus.`,
      'Hapus',
      async () => {
        try {
          await deleteHabit(habit.id);
          await load();
        } catch (error) {
          showError(error, 'Gagal menghapus');
        }
      },
    );

  const doneCount = habits.filter((habit) => done.has(habit.id)).length;
  const existing = new Set(habits.map((habit) => habit.title.toLowerCase()));
  const suggestions = SUGGESTIONS.filter(
    (text) => !existing.has(text.toLowerCase()),
  );

  return (
    <Screen
      icon="leaf-outline"
      title="Habit tracker"
      subtitle="Kelola kebiasaan harianmu."
      refreshing={refreshing}
      onRefresh={refresh}>
      {sick?.enabled ? (
        <Banner tone="warn">
          Mode sakit aktif. Tidak apa-apa kalau ada kebiasaan yang terlewat,
          utamakan istirahat.
        </Banner>
      ) : null}

      {habits.length > 0 ? (
        <Card>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>
            {doneCount} dari {habits.length} kebiasaan selesai hari ini
          </Text>
          <ProgressBar value={doneCount} max={habits.length} />
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Tambah kebiasaan</SectionTitle>
        <Field
          value={title}
          onChangeText={setTitle}
          placeholder="Contoh: Jalan kaki 15 menit"
          returnKeyType="done"
          maxLength={60}
          onSubmitEditing={() => add(title)}
        />
        <Button
          label="Tambah"
          icon="add"
          loading={busy}
          disabled={!title.trim()}
          onPress={() => add(title)}
        />
        {suggestions.length > 0 ? (
          <>
            <Text style={{ color: t.muted, fontSize: 13 }}>Atau pilih cepat</Text>
            <ChipRow>
              {suggestions.map((text) => (
                <Chip key={text} label={text} onPress={() => add(text)} />
              ))}
            </ChipRow>
          </>
        ) : null}
      </Card>

      {habits.length === 0 ? (
        <EmptyState
          icon="leaf-outline"
          title="Belum ada kebiasaan"
          hint="Mulai dari satu kebiasaan kecil yang realistis untuk dijaga setiap hari."
        />
      ) : (
        habits.map((habit) => {
          const isDone = done.has(habit.id);
          const streak = streaks[habit.id] ?? 0;

          return (
            <Card
              key={habit.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                accessibilityLabel={habit.title}
                onPress={() => toggle(habit)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 44,
                }}>
                <Ionicons
                  name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                  size={30}
                  color={isDone ? t.primary : t.muted}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: isDone ? t.muted : t.text,
                      fontSize: 16,
                      fontWeight: '600',
                      textDecorationLine: isDone ? 'line-through' : 'none',
                    }}>
                    {habit.title}
                  </Text>
                  {streak > 0 ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 2,
                      }}>
                      <Ionicons name="flame-outline" size={14} color={t.amber} />
                      <Text style={{ color: t.muted, fontSize: 13 }}>
                        {streak} hari beruntun
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
              <IconButton
                icon="trash-outline"
                label={`Hapus ${habit.title}`}
                onPress={() => remove(habit)}
              />
            </Card>
          );
        })
      )}
    </Screen>
  );
}