
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
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

const TEXT_COLOR = '#1F2937';
const MUTED_TEXT_COLOR = '#64748B';

type CategoryOption = {
  value: string;
  label: string;
  icon: IconName;
};

const categories: CategoryOption[] = [
  { value: 'belajar', label: 'Belajar', icon: 'book-outline' },
  { value: 'olahraga', label: 'Olahraga', icon: 'barbell-outline' },
  { value: 'kebersihan', label: 'Kebersihan', icon: 'brush-outline' },
  { value: 'keuangan', label: 'Keuangan', icon: 'wallet-outline' },
  { value: 'rutinitas', label: 'Rutinitas', icon: 'repeat-outline' },
];

const dayShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const hours = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, '0')
);

const minutes = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, '0')
);

function recurrenceLabel(value: string) {
  if (value === 'daily') return 'Harian';
  if (value === 'weekly') return 'Mingguan';
  if (value === 'monthly') return 'Bulanan';
  return value;
}

function categoryLabel(value: string) {
  if (!value.trim()) return 'Tanpa kategori';

  return categories.find((item) => item.value === value)?.label ?? value;
}

function formatTime(hour: string, minute: string) {
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

export default function ScheduleScreen() {
  const db = useSQLiteContext();

  const [schedules, setSchedules] = useState<ScheduleWithStatus[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('rutinitas');
  const [customCategory, setCustomCategory] = useState('');
  const [categoryMode, setCategoryMode] = useState<
    'preset' | 'custom' | 'none'
  >('preset');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [recurrence, setRecurrence] = useState<Recurrence>('daily');
  const [repeatValue, setRepeatValue] = useState('');

  const [targetTime, setTargetTime] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState('08');
  const [selectedMinute, setSelectedMinute] = useState('00');

  const [priority, setPriority] = useState(false);

  const loadSchedules = useCallback(async () => {
    try {
      const data = await getSchedulesForToday(db);
      setSchedules(data);
    } catch (error) {
      console.error('Gagal memuat jadwal:', error);
      Alert.alert('Gagal memuat jadwal', 'Data aktivitas tidak dapat dimuat.');
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void loadSchedules();
    }, [loadSchedules])
  );

  const resetForm = () => {
    setTitle('');
    setCategory('rutinitas');
    setCustomCategory('');
    setCategoryMode('preset');
    setRecurrence('daily');
    setRepeatValue('');
    setTargetTime('');
    setSelectedHour('08');
    setSelectedMinute('00');
    setPriority(false);
  };

  const openTimePicker = () => {
    if (targetTime) {
      const [hour, minute] = targetTime.split(':');
      setSelectedHour(hour ?? '08');
      setSelectedMinute(minute ?? '00');
    } else {
      const now = new Date();
      const currentHour = now.getHours();
      const roundedMinute = Math.ceil(now.getMinutes() / 5) * 5;

      if (roundedMinute >= 60) {
        setSelectedHour(String((currentHour + 1) % 24).padStart(2, '0'));
        setSelectedMinute('00');
      } else {
        setSelectedHour(String(currentHour).padStart(2, '0'));
        setSelectedMinute(String(roundedMinute).padStart(2, '0'));
      }
    }

    setShowTimePicker(true);
  };

  const confirmTime = () => {
    setTargetTime(formatTime(selectedHour, selectedMinute));
    setShowTimePicker(false);
  };

  const handleCreate = async () => {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      Alert.alert('Judul belum diisi', 'Masukkan nama aktivitas.');
      return;
    }

    if (categoryMode === 'custom' && !customCategory.trim()) {
      Alert.alert(
        'Kategori belum diisi',
        'Masukkan nama kategori atau pilih Tanpa kategori.'
      );
      return;
    }

    if (recurrence === 'weekly' && repeatValue === '') {
      Alert.alert('Hari belum dipilih', 'Pilih hari pengulangan.');
      return;
    }

    if (recurrence === 'monthly' && repeatValue === '') {
      Alert.alert('Tanggal belum dipilih', 'Pilih tanggal pengulangan.');
      return;
    }

    const repeatDay = Number(repeatValue);

    if (
      recurrence === 'weekly' &&
      (!Number.isInteger(repeatDay) || repeatDay < 0 || repeatDay > 6)
    ) {
      Alert.alert('Hari tidak valid', 'Pilih hari dari daftar.');
      return;
    }

    if (
      recurrence === 'monthly' &&
      (!Number.isInteger(repeatDay) || repeatDay < 1 || repeatDay > 31)
    ) {
      Alert.alert('Tanggal tidak valid', 'Pilih tanggal 1 sampai 31.');
      return;
    }

    const finalCategory =
      categoryMode === 'none'
        ? ''
        : categoryMode === 'custom'
          ? customCategory.trim()
          : category;

    try {
      setSaving(true);

      await createSchedule(db, {
        title: cleanTitle,
        category: finalCategory,
        recurrence,
        repeatValue: recurrence === 'daily' ? null : repeatValue,
        targetTime: targetTime || null,
        isPriority: priority,
      });

      resetForm();
      setShowForm(false);

      await loadSchedules();

      Alert.alert('Berhasil', 'Aktivitas berhasil ditambahkan.');
    } catch (error) {
      console.error('Gagal membuat jadwal:', error);
      Alert.alert(
        'Gagal menyimpan',
        'Aktivitas tidak berhasil disimpan. Periksa layanan dan struktur tabel jadwal.'
      );
    } finally {
      setSaving(false);
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
      console.error('Gagal mengubah status aktivitas:', error);
      Alert.alert('Gagal', 'Status aktivitas belum berhasil diubah.');
    }
  };

  const done = schedules.filter(
    (item) => item.is_completed === 1
  ).length;

  const selectedCategoryLabel =
    categoryMode === 'none'
      ? 'Tanpa kategori'
      : categoryMode === 'custom'
        ? customCategory.trim() || 'Kategori sendiri'
        : categoryLabel(category);

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
          <View style={{ gap: 8 }}>
            <ProgressBar value={done / schedules.length} />
            <Text style={font.caption}>
              {done} dari {schedules.length} aktivitas selesai
            </Text>
          </View>
        ) : (
          <Text style={font.caption}>
            Aktivitas yang dijadwalkan akan muncul di sini.
          </Text>
        )}
      </Card>

      <Button
        label={showForm ? 'Tutup formulir' : 'Tambah aktivitas'}
        icon={showForm ? 'close' : 'add'}
        variant={showForm ? 'outline' : 'primary'}
        onPress={() => setShowForm((value) => !value)}
      />

      {showForm ? (
        <Card style={{ gap: 16 }}>
          <Field
            label="Nama aktivitas"
            value={title}
            onChangeText={setTitle}
            placeholder="Contoh: Belajar React Native"
          />

          <View style={{ gap: 8 }}>
            <Text style={font.label}>Kategori (opsional)</Text>

            <Pressable
              onPress={() => setShowCategoryPicker(true)}
              style={({ pressed }) => [
                styles.selectButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Pilih kategori, saat ini ${selectedCategoryLabel}`}
            >
              <View style={styles.selectContent}>
                <Ionicons
                  name={
                    categoryMode === 'none'
                      ? 'remove-circle-outline'
                      : categoryMode === 'custom'
                        ? 'create-outline'
                        : categories.find((item) => item.value === category)
                            ?.icon ?? 'list-outline'
                  }
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.selectText}>
                  {selectedCategoryLabel}
                </Text>
              </View>

              <Ionicons
                name="chevron-down"
                size={18}
                color={MUTED_TEXT_COLOR}
              />
            </Pressable>

            {categoryMode === 'custom' ? (
              <Field
                label="Nama kategori sendiri"
                value={customCategory}
                onChangeText={setCustomCategory}
                placeholder="Contoh: Pengembangan diri"
                icon="create-outline"
              />
            ) : null}

            <Text style={font.micro}>
              Kamu bisa memilih kategori yang tersedia, membuat kategori
              sendiri, atau tidak memakai kategori.
            </Text>
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

          {recurrence === 'weekly' ? (
            <View style={{ gap: 8 }}>
              <Text style={font.label}>Ulang setiap hari</Text>

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
          ) : null}

          {recurrence === 'monthly' ? (
            <View style={{ gap: 8 }}>
              <Text style={font.label}>Tanggal setiap bulan</Text>

              <View style={styles.dateGrid}>
                {Array.from({ length: 31 }, (_, index) => {
                  const day = String(index + 1);

                  return (
                    <Pressable
                      key={day}
                      onPress={() => setRepeatValue(day)}
                      style={[
                        styles.dayButton,
                        repeatValue === day && styles.dayButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          repeatValue === day && styles.dayButtonTextActive,
                        ]}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={font.micro}>
                Jika bulan tidak memiliki tanggal tersebut, perilakunya
                mengikuti implementasi jadwal di layanan aplikasi.
              </Text>
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text style={font.label}>Jam aktivitas (opsional)</Text>

            <Pressable
              onPress={openTimePicker}
              style={({ pressed }) => [
                styles.selectButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Pilih jam aktivitas"
            >
              <View style={styles.selectContent}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.selectText}>
                  {targetTime || 'Tidak ditentukan'}
                </Text>
              </View>

              <Ionicons
                name="chevron-down"
                size={18}
                color={MUTED_TEXT_COLOR}
              />
            </Pressable>

            {targetTime ? (
              <Pressable
                onPress={() => setTargetTime('')}
                style={styles.clearTimeButton}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={MUTED_TEXT_COLOR}
                />
                <Text style={font.caption}>Hapus jam</Text>
              </Pressable>
            ) : null}

            <Text style={font.micro}>
              Pilih jam dan menit dari pemilih waktu. Format waktu dibuat
              otomatis.
            </Text>
          </View>

          <ListGroup>
            <ListRow
              icon="star-outline"
              tone="accent"
              title="Jadikan prioritas"
              subtitle="Tandai aktivitas yang paling penting."
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
            label={saving ? 'Menyimpan...' : 'Simpan aktivitas'}
            icon="checkmark"
            disabled={saving}
            onPress={handleCreate}
          />
        </Card>
      ) : null}

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

      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowCategoryPicker(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih kategori</Text>

              <Pressable
                onPress={() => setShowCategoryPicker(false)}
                accessibilityLabel="Tutup pemilih kategori"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={TEXT_COLOR}
                />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={false}
            >
              {categories.map((item) => {
                const active =
                  categoryMode === 'preset' && category === item.value;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() => {
                      setCategory(item.value);
                      setCategoryMode('preset');
                      setShowCategoryPicker(false);
                    }}
                    style={[
                      styles.categoryOption,
                      active && styles.categoryOptionActive,
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={21}
                      color={active ? colors.primary : TEXT_COLOR}
                    />

                    <Text style={styles.categoryOptionText}>
                      {item.label}
                    </Text>

                    {active ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}

              <Pressable
                onPress={() => {
                  setCategoryMode('custom');
                  setCategory('');
                  setShowCategoryPicker(false);
                }}
                style={[
                  styles.categoryOption,
                  categoryMode === 'custom' &&
                    styles.categoryOptionActive,
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={21}
                  color={
                    categoryMode === 'custom'
                      ? colors.primary
                      : TEXT_COLOR
                  }
                />

                <Text style={styles.categoryOptionText}>
                  Lainnya — buat sendiri
                </Text>

                {categoryMode === 'custom' ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.primary}
                  />
                ) : null}
              </Pressable>

              <Pressable
                onPress={() => {
                  setCategoryMode('none');
                  setCategory('');
                  setCustomCategory('');
                  setShowCategoryPicker(false);
                }}
                style={[
                  styles.categoryOption,
                  categoryMode === 'none' &&
                    styles.categoryOptionActive,
                ]}
              >
                <Ionicons
                  name="remove-circle-outline"
                  size={21}
                  color={
                    categoryMode === 'none'
                      ? colors.primary
                      : TEXT_COLOR
                  }
                />

                <Text style={styles.categoryOptionText}>
                  Tanpa kategori
                </Text>

                {categoryMode === 'none' ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.primary}
                  />
                ) : null}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih jam aktivitas</Text>

              <Pressable
                onPress={() => setShowTimePicker(false)}
                accessibilityLabel="Tutup pemilih waktu"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={TEXT_COLOR}
                />
              </Pressable>
            </View>

            <View style={styles.timePreview}>
              <Ionicons
                name="time-outline"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.timePreviewText}>
                {formatTime(selectedHour, selectedMinute)}
              </Text>
            </View>

            <View style={styles.timeColumns}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnTitle}>JAM</Text>

                <ScrollView
                  style={styles.timeScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.timeOptions}>
                    {hours.map((hour) => (
                      <Pressable
                        key={hour}
                        onPress={() => setSelectedHour(hour)}
                        style={[
                          styles.timeOption,
                          selectedHour === hour && styles.timeOptionActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.timeOptionText,
                            selectedHour === hour &&
                              styles.timeOptionTextActive,
                          ]}
                        >
                          {hour}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnTitle}>MENIT</Text>

                <ScrollView
                  style={styles.timeScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.timeOptions}>
                    {minutes.map((minute) => (
                      <Pressable
                        key={minute}
                        onPress={() => setSelectedMinute(minute)}
                        style={[
                          styles.timeOption,
                          selectedMinute === minute &&
                            styles.timeOptionActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.timeOptionText,
                            selectedMinute === minute &&
                              styles.timeOptionTextActive,
                          ]}
                        >
                          {minute}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowTimePicker(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </Pressable>

              <Pressable
                onPress={confirmTime}
                style={styles.confirmButton}
              >
                <Ionicons
                  name="checkmark"
                  size={19}
                  color={colors.onPrimary}
                />
                <Text style={styles.confirmButtonText}>
                  Pakai jam ini
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
          <Ionicons
            name="checkmark"
            size={16}
            color={colors.onPrimary}
          />
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
          <Text style={font.micro}>
            {categoryLabel(schedule.category)}
          </Text>

          <View style={styles.metaItem}>
            <Ionicons
              name="repeat-outline"
              size={13}
              color={MUTED_TEXT_COLOR}
            />
            <Text style={font.micro}>
              {recurrenceLabel(schedule.recurrence)}
            </Text>
          </View>

          {schedule.target_time ? (
            <View style={styles.metaItem}>
              <Ionicons
                name="time-outline"
                size={13}
                color={MUTED_TEXT_COLOR}
              />
              <Text style={font.micro}>{schedule.target_time}</Text>
            </View>
          ) : null}

          {schedule.is_priority === 1 ? (
            <View style={styles.metaItem}>
              <Ionicons
                name="star"
                size={13}
                color={colors.accent}
              />
              <Text style={font.micro}>Prioritas</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  todayDate: {
    ...font.title,
    color: TEXT_COLOR,
  },

  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  selectButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surface,
  },

  selectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  selectText: {
    ...font.bodyStrong,
    color: TEXT_COLOR,
    flexShrink: 1,
  },

  pressed: {
    opacity: 0.75,
  },

  clearTimeButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },

  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  dayButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  dayButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  dayButtonText: {
    color: TEXT_COLOR,
    fontSize: 14,
    fontWeight: '500',
  },

  dayButtonTextActive: {
    color: colors.onPrimary,
    fontWeight: '700',
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
    color: TEXT_COLOR,
  },

  taskTitleDone: {
    color: MUTED_TEXT_COLOR,
    textDecorationLine: 'line-through',
  },

  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: 4,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 16,
    maxHeight: '85%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  modalTitle: {
    ...font.title,
    color: TEXT_COLOR,
    flex: 1,
  },

  categoryOption: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  categoryOptionActive: {
    backgroundColor: colors.surfaceMuted,
  },

  categoryOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_COLOR,
    flex: 1,
  },

  timePreview: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },

  timePreviewText: {
    fontSize: 38,
    fontWeight: '700',
    color: TEXT_COLOR,
    fontVariant: ['tabular-nums'],
  },

  timeColumns: {
    flexDirection: 'row',
    gap: 12,
  },

  timeColumn: {
    flex: 1,
    gap: 8,
  },

  timeColumnTitle: {
    ...font.caption,
    color: MUTED_TEXT_COLOR,
    textAlign: 'center',
    fontWeight: '700',
  },

  timeScroll: {
    height: 190,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },

  timeOptions: {
    padding: 8,
    gap: 6,
  },

  timeOption: {
    minHeight: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timeOptionActive: {
    backgroundColor: colors.primary,
  },

  timeOptionText: {
    color: TEXT_COLOR,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },

  timeOptionTextActive: {
    color: colors.onPrimary,
    fontWeight: '700',
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },

  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    ...font.bodyStrong,
    color: TEXT_COLOR,
  },

  confirmButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  confirmButtonText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});
