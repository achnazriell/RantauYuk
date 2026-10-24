import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  Screen,
  SectionTitle,
  showError,
  useTheme,
} from '@/components/rantau-kit';
import {
  getSickMode,
  setSickMode,
  type SickModeSettings,
} from '@/services/app-blocker.service';
import {
  getLocalDatabase,
  initServiceTables,
} from '@/services/local-database.service';
import { scheduleNotification } from '@/services/notifications.service';

const REASONS = [
  'Demam',
  'Flu atau batuk',
  'Maag atau perut',
  'Sakit kepala',
  'Kelelahan',
  'Lainnya',
];

const TIPS = [
  'Minum air putih dan makan teratur, walau porsinya sedikit.',
  'Tidur dan istirahat lebih banyak. Tunda olahraga berat.',
  'Kabari teman kost atau keluarga supaya ada yang bisa membantu.',
  'Catat kapan gejala mulai dan obat apa yang kamu minum.',
];

function sinceText(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';

  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'kurang dari 1 jam';

  const days = Math.floor(hours / 24);
  return days > 0 ? `${days} hari ${hours % 24} jam` : `${hours} jam`;
}

export default function SickModeScreen() {
  const t = useTheme();
  const [sick, setSick] = useState<SickModeSettings>({
    enabled: false,
    reason: '',
    activatedAt: null,
  });
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [reminderSet, setReminderSet] = useState(false);

  const load = useCallback(async () => {
    try {
      await initServiceTables();
      const db = await getLocalDatabase();
      setSick(await getSickMode(db));
    } catch (error) {
      showError(error, 'Gagal memuat Mode sakit');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const change = async (enabled: boolean) => {
    setBusy(true);
    try {
      await initServiceTables();
      const db = await getLocalDatabase();
      setSick(await setSickMode(db, enabled, reason));
      setReminderSet(false);
    } catch (error) {
      showError(error, 'Mode sakit tidak bisa diubah');
    } finally {
      setBusy(false);
    }
  };

  const remindMe = async () => {
    try {
      await scheduleNotification(
        'Bagaimana kondisimu?',
        'Waktunya cek kondisi. Kalau sudah membaik, matikan Mode sakit.',
        new Date(Date.now() + 4 * 3_600_000),
      );
      setReminderSet(true);
      Alert.alert('Pengingat dipasang', 'Kamu akan diingatkan 4 jam lagi.');
    } catch (error) {
      showError(error, 'Pengingat tidak bisa dipasang');
    }
  };

  return (
    <Screen
      icon="bed-outline"
      title="Mode sakit"
      subtitle="Atur aktivitas selama masa pemulihan.">
      {sick.enabled ? (
        <>
          <View
            style={{
              backgroundColor: t.warnSoft,
              borderRadius: 20,
              padding: 20,
              gap: 6,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="bed-outline" size={22} color={t.warn} />
              <Text style={{ color: t.warn, fontSize: 14, fontWeight: '600' }}>
                Mode sakit aktif
              </Text>
            </View>
            <Text style={{ color: t.text, fontSize: 26, fontWeight: '700' }}>
              {sick.reason || 'Lainnya'}
            </Text>
            {sinceText(sick.activatedAt) ? (
              <Text style={{ color: t.warn, fontSize: 14 }}>
                Sudah {sinceText(sick.activatedAt)}
              </Text>
            ) : null}
          </View>

          <Card>
            <SectionTitle>Selama pemulihan</SectionTitle>
            {TIPS.map((tip) => (
              <View key={tip} style={{ flexDirection: 'row', gap: 10 }}>
                <Ionicons name="checkmark" size={18} color={t.primary} />
                <Text style={{ flex: 1, color: t.text, fontSize: 15, lineHeight: 21 }}>
                  {tip}
                </Text>
              </View>
            ))}
          </Card>

          <Banner tone="warn">
            Segera ke puskesmas, klinik, atau dokter jika demam lebih dari 3
            hari, sesak napas, nyeri hebat, atau kondisimu terus memburuk.
          </Banner>

          <Button
            label={reminderSet ? 'Pengingat dipasang (4 jam)' : 'Ingatkan saya 4 jam lagi'}
            icon="alarm-outline"
            variant="soft"
            disabled={reminderSet}
            onPress={remindMe}
          />
          <Button
            label="Aku sudah sehat"
            icon="happy-outline"
            loading={busy}
            onPress={() => change(false)}
          />
        </>
      ) : (
        <>
          <Card>
            <SectionTitle>Apa yang kamu rasakan?</SectionTitle>
            <ChipRow>
              {REASONS.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  selected={reason === item}
                  onPress={() => setReason(item)}
                />
              ))}
            </ChipRow>
            <Button
              label="Aktifkan Mode sakit"
              icon="bed-outline"
              loading={busy}
              onPress={() => change(true)}
            />
          </Card>

          <Banner>
            Saat aktif, layar Kebiasaan dan Workout menampilkan pengingat untuk
            istirahat. Mode ini tidak memblokir aplikasi lain di ponselmu.
          </Banner>
        </>
      )}
    </Screen>
  );
}