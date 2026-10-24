import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import {
  Button,
  Card,
  ChoiceRow,
  Field,
  Screen,
  Segmented,
} from '@/components/ui';
import { colors, font, spacing } from '@/theme';
import { digitsOnly, formatThousands } from '@/lib/format';

type OccupationStatus = 'kuliah' | 'kerja';
type IncomeType = 'uang_saku' | 'gaji_sendiri';
type FoodPreference = 'hemat' | 'sehat' | 'hemat_sehat';
type ReligionMode = 'islam' | 'general';

export default function OnboardingScreen() {
  const db = useSQLiteContext();

  const [name, setName] = useState('');
  const [occupationStatus, setOccupationStatus] =
    useState<OccupationStatus>('kuliah');
  const [incomeType, setIncomeType] = useState<IncomeType>('uang_saku');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [paydayDate, setPaydayDate] = useState('');
  const [foodPreference, setFoodPreference] =
    useState<FoodPreference>('hemat_sehat');
  const [religionMode, setReligionMode] =
    useState<ReligionMode>('islam');

  const handleSave = async () => {
    const budget = Number(digitsOnly(monthlyBudget));
    const payday = Number(paydayDate);

    if (!name.trim()) {
      Alert.alert('Data belum lengkap', 'Masukkan nama kamu.');
      return;
    }

    if (!budget || budget <= 0) {
      Alert.alert(
        'Budget tidak valid',
        'Masukkan budget bulanan yang benar.'
      );
      return;
    }

    if (!payday || payday < 1 || payday > 31) {
      Alert.alert(
        'Tanggal tidak valid',
        'Masukkan tanggal cair antara 1 sampai 31.'
      );
      return;
    }

    try {
      await db.runAsync(
        `
        INSERT INTO user_preferences (
          id,
          name,
          call_name,
          occupation_status,
          income_type,
          monthly_budget,
          payday_date,
          food_preference,
          religion_mode,
          strict_mode_enabled
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        1,
        name.trim(),
        name.trim(),
        occupationStatus,
        incomeType,
        budget,
        payday,
        foodPreference,
        religionMode,
        0
      );

      router.replace('/tabs');
    } catch (error) {
      console.error('Gagal menyimpan onboarding:', error);

      Alert.alert(
        'Gagal menyimpan',
        'Data belum berhasil disimpan ke database.'
      );
    }
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={<Button label="Simpan dan mulai" onPress={handleSave} />}
    >
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Ionicons
            name="compass-outline"
            size={30}
            color={colors.onPrimary}
          />
        </View>

        <Text style={font.display}>Rantau Yuk</Text>

        <Text style={styles.lead}>
          Kenalan dulu supaya aplikasi bisa menyesuaikan diri dengan
          hidupmu di perantauan.
        </Text>
      </View>

      <Card style={styles.group}>
        <Text style={font.heading}>Tentang kamu</Text>

        <Field
          label="Nama kamu"
          value={name}
          onChangeText={setName}
          placeholder="Contoh: Achmad"
          icon="person-outline"
          autoCapitalize="words"
        />

        <View style={styles.stack}>
          <Text style={font.label}>Kamu sekarang</Text>

          <Segmented<OccupationStatus>
            value={occupationStatus}
            onChange={setOccupationStatus}
            options={[
              { value: 'kuliah', label: 'Kuliah', icon: 'school-outline' },
              {
                value: 'kerja',
                label: 'Kerja',
                icon: 'briefcase-outline',
              },
            ]}
          />
        </View>
      </Card>

      <Card style={styles.group}>
        <Text style={font.heading}>Keuangan</Text>

        <View style={styles.stack}>
          <Text style={font.label}>Sumber dana utama</Text>

          <Segmented<IncomeType>
            value={incomeType}
            onChange={setIncomeType}
            options={[
              {
                value: 'uang_saku',
                label: 'Uang saku',
                icon: 'wallet-outline',
              },
              {
                value: 'gaji_sendiri',
                label: 'Gaji sendiri',
                icon: 'cash-outline',
              },
            ]}
          />
        </View>

        <Field
          label="Budget bulanan"
          prefix="Rp"
          value={formatThousands(monthlyBudget)}
          onChangeText={(text) => setMonthlyBudget(digitsOnly(text))}
          placeholder="1.500.000"
          keyboardType="numeric"
        />

        <Field
          label="Tanggal cair atau gajian"
          value={paydayDate}
          onChangeText={(text) => setPaydayDate(digitsOnly(text))}
          placeholder="Contoh: 1"
          keyboardType="numeric"
          maxLength={2}
          icon="calendar-outline"
          hint="Isi tanggal 1 sampai 31"
        />
      </Card>

      <Card style={styles.group}>
        <Text style={font.heading}>Preferensi makanan</Text>

        <ChoiceRow
          icon="pricetag-outline"
          title="Hemat"
          description="Utamakan harga yang murah"
          active={foodPreference === 'hemat'}
          onPress={() => setFoodPreference('hemat')}
        />

        <ChoiceRow
          icon="nutrition-outline"
          title="Sehat"
          description="Utamakan gizi yang seimbang"
          active={foodPreference === 'sehat'}
          onPress={() => setFoodPreference('sehat')}
        />

        <ChoiceRow
          icon="scale-outline"
          title="Hemat dan sehat"
          description="Seimbang antara harga dan gizi"
          active={foodPreference === 'hemat_sehat'}
          onPress={() => setFoodPreference('hemat_sehat')}
        />
      </Card>

      <Card style={styles.group}>
        <Text style={font.heading}>Mode aplikasi</Text>

        <ChoiceRow
          icon="moon-outline"
          title="Islam"
          description="Pelacak sholat dan pengingat ibadah"
          active={religionMode === 'islam'}
          onPress={() => setReligionMode('islam')}
        />

        <ChoiceRow
          icon="leaf-outline"
          title="Umum"
          description="Pelacak kebiasaan harian"
          active={religionMode === 'general'}
          onPress={() => setReligionMode('general')}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: spacing.sm,
  },
  lead: {
    ...font.body,
    color: colors.textMuted,
  },
  group: {
    gap: spacing.lg,
  },
  stack: {
    gap: spacing.sm,
  },
});
