import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import {
  createSchedule,
  getSchedulesForToday,
  setScheduleCompleted,
  type Recurrence,
  type ScheduleWithStatus,
} from '@/services/schedule.service';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  ListGroup,
  ListRow,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionHeader,
  Segmented,
} from '@/components/ui';
import type { IconName } from '@/components/ui';
import { colors, font, spacing } from '@/theme';
import { formatDateLong } from '@/lib/format';

const categories: { value: string; label: string; icon: IconName }[] = [
  { value: 'belajar', label: 'Belajar', icon: 'book-outline' },
  { value: 'olahraga', label: 'Olahraga', icon: 'barbell-outline' },
  { value: 'kebersihan', label: 'Kebersihan', icon: 'brush-outline' },
  { value: 'keuangan', label: 'Keuangan', icon: 'wallet-outline' },
  { value: 'rutinitas', label: 'Rutinitas', icon: 'repeat-outline' },
];

const dayShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function recurrenceLabel(value: string) {
  if (value === 'daily') return 'Harian';
  if (value === 'weekly') return 'Mingguan';

  return 'Bulanan';
}

function categoryLabel(value: string) {
  return (
    categories.find((item) => item.value === value)?.label ?? value
  );
}

export default function ScheduleScreen() {
  const db = useSQLiteContext();

  const [schedules, setSchedules] = useState<ScheduleWithStatus[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('rutinitas');
  const [recurrence, setRecurrence] = useState<Recurrence>('daily');

  const [repeatValue, setRepeatValue] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [priority, setPriority] = useState(false);

  const loadSchedules = useCallback(async () => {
    try {
      const data = await getSchedulesForToday(db);
      setSchedules(data);
    } catch (error) {
      console.error('Gagal memuat schedule:', error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadSchedules();
    }, [loadSchedules])
  );

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Judul belum diisi', 'Masukkan nama aktivitas.');
      return;
    }

    if (recurrence === 'weekly' && repeatValue === '') {
      Alert.alert('Hari belum dipilih', 'Pilih hari pengulangan.');
      return;
    }

    if (recurrence === 'monthly' && repeatValue === '') {
      Alert.alert('Tanggal belum diisi', 'Masukkan tanggal 1-31.');
      return;
    }

    if (recurrence === 'weekly') {
      const day = Number(repeatValue);

      if (day < 0 || day > 6) {
        Alert.alert('Hari tidak valid', 'Pilih hari dari daftar.');
        return;
      }
    }

    if (recurrence === 'monthly') {
      const day = Number(repeatValue);

      if (day < 1 || day > 31) {
        Alert.alert('Tanggal tidak valid', 'Gunakan tanggal 1 sampai 31.');
        return;
      }
    }

    if (targetTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(targetTime)) {
      Alert.alert(
        'Jam tidak valid',
        'Gunakan format HH:MM. Contoh 17:00.'
      );
      return;
    }

    try {
      await createSchedule(db, {
        title,
        category,
        recurrence,
        repeatValue: recurrence === 'daily' ? null : repeatValue,
        targetTime: targetTime || null,
        isPriority: priority,
      });

      setTitle('');
      setCategory('rutinitas');
      setRecurrence('daily');
      setRepeatValue('');
      setTargetTime('');
      setPriority(false);
      setShowForm(false);

      await loadSchedules();

      Alert.alert('Berhasil', 'Aktivitas berhasil ditambahkan.');
    } catch (error) {
      console.error('Gagal membuat schedule:', error);

      Alert.alert('Gagal', 'Aktivitas tidak berhasil disimpan.');
    }
  };

  const toggleCompleted = async (schedule: ScheduleWithStatus) => {
    try {
      await setScheduleCompleted(
        db,
        schedule.id,
        schedule.is_completed === 0
      );

      await loadSchedules();
    } catch (error) {
      console.error('Gagal mengubah status task:', error);
    }
  };

  const done = schedules.filter((item) => item.is_completed === 1).length;

  return (
    <Screen>
      <ScreenHeader
        title="Jadwal"
        subtitle="Atur aktivitas harian, mingguan, dan bulanan."
      />

      <Card>
        <Text style={font.caption}>Hari ini</Text>

        <Text style={styles.todayDate}>{formatDateLong()}</Text>

        {schedules.length > 0 ? (
          <>
            <ProgressBar value={done / schedules.length} />

            <Text style={font.caption}>
              {done} dari {schedules.length} aktivitas selesai
            </Text>
          </>
        ) : null}
      </Card>

      <Button
        label={showForm ? 'Tutup formulir' : 'Tambah aktivitas'}
        icon={showForm ? 'close' : 'add'}
        variant={showForm ? 'outline' : 'primary'}
        onPress={() => setShowForm((value) => !value)}
      />

      {showForm && (
        <Card style={{ gap: 16 }}>
          <Field
            label="Nama aktivitas"
            value={title}
            onChangeText={setTitle}
            placeholder="Contoh: Belajar 2 jam"
          />

          <View style={{ gap: 8 }}>
            <Text style={font.label}>Kategori</Text>

            <View style={styles.wrap}>
              {categories.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  icon={item.icon}
                  active={category === item.value}
                  onPress={() => setCategory(item.value)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={font.label}>Perulangan</Text>

            <Segmented<Recurrence>
              value={recurrence}
              onChange={(next) => {
                setRecurrence(next);
                setRepeatValue('');
              }}
              options={[
                { value: 'daily', label: 'Harian' },
                { value: 'weekly', label: 'Mingguan' },
                { value: 'monthly', label: 'Bulanan' },
              ]}
            />
          </View>

          {recurrence === 'weekly' && (
            <View style={{ gap: 8 }}>
              <Text style={font.label}>Hari</Text>

              <View style={styles.wrap}>
                {dayShort.map((name, index) => (
                  <Chip
                    key={name}
                    label={name}
                    active={repeatValue === String(index)}
                    onPress={() => setRepeatValue(String(index))}
                  />
                ))}
              </View>
            </View>
          )}

          {recurrence === 'monthly' && (
            <Field
              label="Tanggal"
              value={repeatValue}
              onChangeText={setRepeatValue}
              placeholder="1 - 31"
              keyboardType="numeric"
              maxLength={2}
              icon="calendar-outline"
            />
          )}

          <Field
            label="Jam (opsional)"
            value={targetTime}
            onChangeText={setTargetTime}
            placeholder="Contoh: 17:00"
            keyboardType="numbers-and-punctuation"
            icon="time-outline"
            hint="Format 24 jam, HH:MM"
          />

          <ListGroup>
            <ListRow
              icon="star-outline"
              tone="accent"
              title="Jadikan prioritas"
              subtitle="Bisa dipakai Strict Mode nantinya"
              right={
                <Switch
                  value={priority}
                  onValueChange={setPriority}
                  trackColor={{
                    false: colors.borderStrong,
                    true: colors.primary,
                  }}
                  thumbColor={colors.surface}
                />
              }
            />
          </ListGroup>

          <Button
            label="Simpan aktivitas"
            icon="checkmark"
            onPress={handleCreate}
          />
        </Card>
      )}

      <SectionHeader title="Aktivitas hari ini" />

      {schedules.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Belum ada aktivitas"
          description="Tambahkan jadwal pertamamu."
        />
      ) : (
        <ListGroup>
          {schedules.map((schedule) => (
            <TaskRow
              key={schedule.id}
              schedule={schedule}
              onToggle={() => toggleCompleted(schedule)}
            />
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}

function TaskRow({
  schedule,
  onToggle,
}: {
  schedule: ScheduleWithStatus;
  onToggle: () => void;
}) {
  const completed = schedule.is_completed === 1;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      accessibilityLabel={schedule.title}
      style={({ pressed }) => [
        styles.task,
        pressed && styles.taskPressed,
      ]}
    >
      <View style={[styles.checkbox, completed && styles.checkboxDone]}>
        {completed ? (
          <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
        ) : null}
      </View>

      <View style={styles.taskBody}>
        <Text
          style={[styles.taskTitle, completed && styles.taskTitleDone]}
          numberOfLines={2}
        >
          {schedule.title}
        </Text>

        <View style={styles.meta}>
          <Text style={font.micro}>{categoryLabel(schedule.category)}</Text>

          <View style={styles.metaItem}>
            <Ionicons name="repeat-outline" size={13} color={colors.textFaint} />
            <Text style={font.micro}>
              {recurrenceLabel(schedule.recurrence)}
            </Text>
          </View>

          {schedule.target_time ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={colors.textFaint} />
              <Text style={font.micro}>{schedule.target_time}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {schedule.is_priority === 1 ? (
        <Ionicons name="star" size={18} color={colors.accent} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  todayDate: {
    ...font.title,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  task: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  taskPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  taskBody: {
    flex: 1,
    gap: 4,
  },
  taskTitle: {
    ...font.bodyStrong,
  },
  taskTitleDone: {
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
