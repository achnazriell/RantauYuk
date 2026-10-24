import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Screen,
  SectionTitle,
  showError,
  toDateKey,
  useTheme,
} from '@/components/rantau-kit';
import {
  getSetting,
  initServiceTables,
  setSetting,
} from '@/services/local-database.service';
import { getCurrentCity } from '@/services/location.service';
import {
  cancelNotification,
  scheduleNotification,
} from '@/services/notifications.service';
import {
  getNextPrayer,
  getPrayerTimes,
  type PrayerTimes,
} from '@/services/prayer.service';

const PRAYERS = [
  { key: 'Fajr', label: 'Subuh' },
  { key: 'Dhuhr', label: 'Dzuhur' },
  { key: 'Asr', label: 'Ashar' },
  { key: 'Maghrib', label: 'Maghrib' },
  { key: 'Isha', label: 'Isya' },
] as const;

type PrayerKey = (typeof PRAYERS)[number]['key'];
type DayLog = Partial<Record<PrayerKey, boolean>>;
type WeekDay = { label: string; count: number; today: boolean };

const KEY_CITY = 'prayer_city';
const KEY_CACHE = 'prayer_cache';
const KEY_REMINDERS = 'prayer_reminders';
const KEY_NOTIF_IDS = 'prayer_notif_ids';
const DAY_INITIALS = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];

const logKey = (date: Date) => `prayer_log_${toDateKey(date)}`;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function timeToDate(time: string, base = new Date()): Date | null {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const date = new Date(base);
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

function countdownLabel(minutes: number): string {
  if (minutes < 1) return 'sebentar lagi';
  if (minutes < 60) return `${minutes} menit lagi`;
  return `${Math.floor(minutes / 60)} j ${minutes % 60} m lagi`;
}

async function loadWeek(): Promise<WeekDay[]> {
  const days: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const log = parseJson<DayLog>(await getSetting(logKey(date)), {});
    days.push({
      label: DAY_INITIALS[date.getDay()],
      count: Object.values(log).filter(Boolean).length,
      today: i === 0,
    });
  }
  return days;
}

async function clearReminders(): Promise<void> {
  const ids = parseJson<string[]>(await getSetting(KEY_NOTIF_IDS), []);
  if (ids.length === 0) return;

  for (const id of ids) {
    try {
      await cancelNotification(id);
    } catch {
      // Pengingat lama mungkin sudah tidak ada.
    }
  }
  await setSetting(KEY_NOTIF_IDS, '[]');
}

async function scheduleReminders(times: PrayerPlan): Promise<void> {
  const ids: string[] = [];
  const now = Date.now();

  try {
    for (const prayer of PRAYERS) {
      const raw = times.timings[prayer.key];
      const at = timeToDate(raw);
      if (!at || at.getTime() <= now) continue;

      ids.push(
        await scheduleNotification(
          `Waktu ${prayer.label}`,
          `Sudah masuk waktu ${prayer.label} (${raw.slice(0, 5)}).`,
          at,
        ),
      );
    }
  } finally {
    await setSetting(KEY_NOTIF_IDS, JSON.stringify(ids));
  }
}

type PrayerPlan = Pick<PrayerTimes, 'timings'>;

export default function PrayerScreen() {
  const t = useTheme();
  const lastFetch = useRef('');

  const [city, setCity] = useState('');
  const [times, setTimes] = useState<PrayerTimes | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [log, setLog] = useState<DayLog>({});
  const [week, setWeek] = useState<WeekDay[]>([]);
  const [remindersOn, setRemindersOn] = useState(false);
  const [now, setNow] = useState(new Date());

  // Perbarui hitung mundur setiap 30 detik.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchTimes = useCallback(async (cityName: string, force = false) => {
    const name = cityName.trim();
    if (!name) return;

    const stamp = `${toDateKey()}|${name.toLowerCase()}`;
    if (!force && lastFetch.current === stamp) return;

    setLoading(true);
    try {
      const result = await getPrayerTimes(name);
      lastFetch.current = stamp;
      setTimes(result);
      setOffline(false);
      await setSetting(KEY_CITY, name);
      await setSetting(KEY_CACHE, JSON.stringify({ day: toDateKey(), result }));
    } catch (error) {
      // Gunakan jadwal tersimpan hari ini bila sedang tidak ada sinyal.
      const cached = parseJson<{ day: string; result: PrayerTimes } | null>(
        await getSetting(KEY_CACHE),
        null,
      );

      if (
        cached &&
        cached.day === toDateKey() &&
        cached.result.city.toLowerCase() === name.toLowerCase()
      ) {
        setTimes(cached.result);
        setOffline(true);
      } else {
        showError(error, 'Jadwal salat gagal dimuat');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          await initServiceTables();
          const savedCity = (await getSetting(KEY_CITY)) ?? '';
          setCity((prev) => prev || savedCity);
          setRemindersOn((await getSetting(KEY_REMINDERS)) === '1');
          setLog(parseJson<DayLog>(await getSetting(logKey(new Date())), {}));
          setWeek(await loadWeek());

          if (active && savedCity) await fetchTimes(savedCity);
        } catch (error) {
          showError(error, 'Gagal memuat data salat');
        }
      })();

      return () => {
        active = false;
      };
    }, [fetchTimes]),
  );

  // Jadwalkan ulang pengingat setiap jadwal atau pengaturan berubah.
  useEffect(() => {
    if (!times) return;

    (async () => {
      try {
        await clearReminders();
        if (remindersOn) await scheduleReminders(times);
      } catch (error) {
        setRemindersOn(false);
        await setSetting(KEY_REMINDERS, '0');
        showError(error, 'Pengingat tidak bisa diaktifkan');
      }
    })();
  }, [times, remindersOn]);

  const changeReminders = async (value: boolean) => {
    setRemindersOn(value);
    try {
      await setSetting(KEY_REMINDERS, value ? '1' : '0');
    } catch (error) {
      showError(error);
    }
  };

  const fillFromLocation = async () => {
    setLocating(true);
    try {
      const found = await getCurrentCity();
      if (!found) {
        Alert.alert(
          'Kota tidak ditemukan',
          'Ketik nama kotamu secara manual lalu tekan Cari jadwal.',
        );
        return;
      }
      setCity(found);
      await fetchTimes(found, true);
    } catch (error) {
      showError(error, 'Lokasi tidak tersedia');
    } finally {
      setLocating(false);
    }
  };

  const togglePrayer = async (key: PrayerKey) => {
    const previous = log;
    const next: DayLog = { ...log, [key]: !log[key] };
    setLog(next);

    try {
      await setSetting(logKey(new Date()), JSON.stringify(next));
      setWeek(await loadWeek());
    } catch (error) {
      setLog(previous);
      showError(error, 'Gagal menyimpan catatan salat');
    }
  };

  // Salat berikutnya dan hitung mundurnya.
  let nextPrayer: { name: string; time: string; minutes: number } | null = null;
  if (times) {
    const next = getNextPrayer(times.timings, now);
    if (next) {
      const base = new Date(now);
      if (next.name.includes('besok')) base.setDate(base.getDate() + 1);
      const at = timeToDate(next.time, base);
      if (at) {
        nextPrayer = {
          name: next.name.replace(' (besok)', ''),
          time: next.time.slice(0, 5),
          minutes: Math.max(0, Math.round((at.getTime() - now.getTime()) / 60000)),
        };
      }
    }
  }

  const weekTotal = week.reduce((sum, day) => sum + day.count, 0);
  const doneToday = Object.values(log).filter(Boolean).length;

  return (
    <Screen
      icon="moon-outline"
      title="Pelacak sholat"
      subtitle="Jadwal dan catatan ibadah harian.">
      {nextPrayer ? (
        <View
          accessible
          accessibilityLabel={`Salat berikutnya ${nextPrayer.name} pukul ${nextPrayer.time}, ${countdownLabel(nextPrayer.minutes)}`}
          style={{
            backgroundColor: t.primary,
            borderRadius: 20,
            padding: 20,
            gap: 4,
          }}>
          <Text style={{ color: t.onPrimary, opacity: 0.85, fontSize: 14 }}>
            Salat berikutnya
          </Text>
          <Text style={{ color: t.onPrimary, fontSize: 34, fontWeight: '700' }}>
            {nextPrayer.name} {nextPrayer.time}
          </Text>
          <Text style={{ color: t.onPrimary, opacity: 0.85, fontSize: 15 }}>
            {countdownLabel(nextPrayer.minutes)}
          </Text>
        </View>
      ) : null}

      <Card>
        <SectionTitle>Lokasi</SectionTitle>
        <Field
          value={city}
          onChangeText={setCity}
          placeholder="Nama kota atau kabupaten"
          returnKeyType="search"
          autoCapitalize="words"
          onSubmitEditing={() => fetchTimes(city, true)}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            label="Cari jadwal"
            icon="search"
            loading={loading}
            disabled={!city.trim()}
            onPress={() => fetchTimes(city, true)}
            style={{ flex: 1 }}
          />
          <Button
            label="Lokasiku"
            icon="locate-outline"
            variant="soft"
            loading={locating}
            onPress={fillFromLocation}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      {offline ? (
        <Banner tone="warn">
          Tidak ada koneksi internet. Menampilkan jadwal yang tersimpan hari
          ini.
        </Banner>
      ) : null}

      {times ? (
        <Card>
          <SectionTitle>Jadwal hari ini</SectionTitle>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Kemenag RI untuk {times.city}, {times.date}. Ketuk untuk menandai
            sudah salat ({doneToday} dari 5).
          </Text>

          {PRAYERS.map((prayer) => {
            const checked = Boolean(log[prayer.key]);
            const isNext = nextPrayer?.name === prayer.label;

            return (
              <Pressable
                key={prayer.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`${prayer.label} pukul ${times.timings[prayer.key].slice(0, 5)}`}
                onPress={() => togglePrayer(prayer.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 52,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: isNext ? t.primarySoft : 'transparent',
                }}>
                <Ionicons
                  name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={28}
                  color={checked ? t.primary : t.muted}
                />
                <Text
                  style={{
                    flex: 1,
                    color: t.text,
                    fontSize: 16,
                    fontWeight: isNext ? '700' : '500',
                  }}>
                  {prayer.label}
                </Text>
                <Text style={{ color: t.text, fontSize: 16, fontVariant: ['tabular-nums'] }}>
                  {times.timings[prayer.key].slice(0, 5)}
                </Text>
              </Pressable>
            );
          })}

          <Text style={{ color: t.muted, fontSize: 13 }}>
            Matahari terbit {times.timings.Sunrise.slice(0, 5)}
          </Text>
        </Card>
      ) : (
        <EmptyState
          icon="moon-outline"
          title="Jadwal belum dimuat"
          hint="Ketik kotamu atau ketuk Lokasiku untuk melihat jadwal salat hari ini."
        />
      )}

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>
            Ingatkan saat waktu salat
          </Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Mengingatkan sisa waktu salat hari ini. Buka aplikasi sekali sehari
            agar jadwal besok ikut terpasang.
          </Text>
        </View>
        <Switch
          value={remindersOn}
          onValueChange={changeReminders}
          disabled={!times}
          trackColor={{ true: t.primary }}
          accessibilityLabel="Ingatkan saat waktu salat"
        />
      </Card>

      {week.length > 0 ? (
        <Card>
          <SectionTitle>7 hari terakhir</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {week.map((day, index) => (
              <View key={index} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <View style={{ height: 56, width: '100%', justifyContent: 'flex-end' }}>
                  <View
                    style={{
                      height: Math.max(4, (day.count / 5) * 56),
                      borderRadius: 4,
                      backgroundColor: t.primary,
                      opacity: day.count === 0 ? 0.2 : day.count === 5 ? 1 : 0.55,
                    }}
                  />
                </View>
                <Text
                  style={{
                    color: day.today ? t.text : t.muted,
                    fontSize: 12,
                    fontWeight: day.today ? '700' : '400',
                  }}>
                  {day.label}
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {weekTotal} dari 35 salat tercatat
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}