import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  addTransaction,
  getFinanceSummary,
  getTransactions,
  type FinanceSummary,
  type Transaction,
  type TransactionType,
} from '@/services/finance.service';

import { BalanceCard } from '@/components/balance-card';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  ListGroup,
  ListRow,
  Screen,
  ScreenHeader,
  SectionHeader,
  Segmented,
  StatTile,
} from '@/components/ui';
import type { IconName } from '@/components/ui';
import { colors, font } from '@/theme';
import {
  digitsOnly,
  formatRupiah,
  formatThousands,
} from '@/lib/format';

type Category =
  | 'makan'
  | 'jajan'
  | 'transport'
  | 'kos'
  | 'belanja_bulanan'
  | 'lainnya';

const expenseCategories: Category[] = [
  'makan',
  'jajan',
  'transport',
  'kos',
  'belanja_bulanan',
  'lainnya',
];

const incomeCategories = ['uang_saku', 'gaji', 'lainnya'];

const categoryMeta: Record<string, { label: string; icon: IconName }> = {
  makan: { label: 'Makan', icon: 'restaurant-outline' },
  jajan: { label: 'Jajan', icon: 'cafe-outline' },
  transport: { label: 'Transport', icon: 'bus-outline' },
  kos: { label: 'Kos', icon: 'home-outline' },
  belanja_bulanan: { label: 'Belanja bulanan', icon: 'cart-outline' },
  uang_saku: { label: 'Uang saku', icon: 'wallet-outline' },
  gaji: { label: 'Gaji', icon: 'cash-outline' },
  lainnya: { label: 'Lainnya', icon: 'ellipsis-horizontal-circle-outline' },
};

function metaFor(category: string) {
  return categoryMeta[category] ?? categoryMeta.lainnya;
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-');

  return `${day}/${month}/${year}`;
}

export default function FinanceScreen() {
  const db = useSQLiteContext();

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState<Category>('makan');

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isFixedCost, setIsFixedCost] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadFinance = useCallback(async () => {
    try {
      const profile = await db.getFirstAsync<{
        payday_date: number;
      }>(
        `
        SELECT payday_date
        FROM user_preferences
        WHERE id = 1
        `
      );

      if (!profile) {
        return;
      }

      const [financeSummary, financeTransactions] = await Promise.all([
        getFinanceSummary(db, profile.payday_date),
        getTransactions(db),
      ]);

      setSummary(financeSummary);
      setTransactions(financeTransactions);
    } catch (error) {
      console.error('Gagal memuat keuangan:', error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadFinance();
    }, [loadFinance])
  );

  const handleSave = async () => {
    const numericAmount = Number(digitsOnly(amount));

    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Nominal tidak valid', 'Masukkan nominal transaksi.');
      return;
    }

    try {
      await addTransaction(db, {
        type,
        category,
        amount: numericAmount,
        isFixedCost,
        note,
      });

      setAmount('');
      setNote('');
      setIsFixedCost(false);
      setShowForm(false);

      await loadFinance();

      Alert.alert('Berhasil', 'Transaksi berhasil disimpan.');
    } catch (error) {
      console.error('Gagal menyimpan transaksi:', error);

      Alert.alert('Gagal', 'Transaksi tidak berhasil disimpan.');
    }
  };

  const changeType = (next: TransactionType) => {
    setType(next);
    setCategory(next === 'expense' ? 'makan' : 'lainnya');
  };

  const categories: string[] =
    type === 'expense' ? expenseCategories : incomeCategories;

  return (
    <Screen>
      <ScreenHeader
        title="Keuangan"
        subtitle="Pantau uangmu sebelum uang yang mengatur harimu."
      />

      {summary && (
        <>
          <BalanceCard
            balance={summary.balance}
            safeDailyLimit={summary.safeDailyLimit}
            remainingDays={summary.remainingDays}
          />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatTile
              icon="arrow-down-circle-outline"
              tone="success"
              label="Pemasukan"
              value={formatRupiah(summary.income)}
              valueColor={colors.success}
            />

            <StatTile
              icon="arrow-up-circle-outline"
              tone="danger"
              label="Pengeluaran"
              value={formatRupiah(summary.expense)}
              valueColor={colors.danger}
            />
          </View>
        </>
      )}

      <Button
        label={showForm ? 'Tutup formulir' : 'Tambah transaksi'}
        icon={showForm ? 'close' : 'add'}
        variant={showForm ? 'outline' : 'primary'}
        onPress={() => setShowForm((value) => !value)}
      />

      {showForm && (
        <Card style={{ gap: 16 }}>
          <Segmented<TransactionType>
            value={type}
            onChange={changeType}
            options={[
              {
                value: 'expense',
                label: 'Pengeluaran',
                icon: 'arrow-up-circle-outline',
              },
              {
                value: 'income',
                label: 'Pemasukan',
                icon: 'arrow-down-circle-outline',
              },
            ]}
          />

          <Field
            label="Nominal"
            prefix="Rp"
            value={formatThousands(amount)}
            onChangeText={(text) => setAmount(digitsOnly(text))}
            keyboardType="numeric"
            placeholder="25.000"
          />

          <View style={{ gap: 8 }}>
            <Chips
              label="Kategori"
              items={categories}
              selected={category}
              onSelect={(item) => setCategory(item as Category)}
            />
          </View>

          <Field
            label="Catatan"
            value={note}
            onChangeText={setNote}
            placeholder="Opsional"
            multiline
          />

          {type === 'expense' && (
            <ListGroup>
              <ListRow
                icon="lock-closed-outline"
                tone="neutral"
                title="Biaya tetap"
                subtitle="Contoh: kos, wifi, listrik"
                right={
                  <Switch
                    value={isFixedCost}
                    onValueChange={setIsFixedCost}
                    trackColor={{
                      false: colors.borderStrong,
                      true: colors.primary,
                    }}
                    thumbColor={colors.surface}
                  />
                }
              />
            </ListGroup>
          )}

          <Button
            label="Simpan transaksi"
            icon="checkmark"
            onPress={handleSave}
          />
        </Card>
      )}

      <SectionHeader title="Riwayat transaksi" />

      {transactions.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="Belum ada transaksi"
          description="Catat pemasukan atau pengeluaran pertamamu."
        />
      ) : (
        <ListGroup>
          {transactions.map((transaction) => {
            const isIncome = transaction.type === 'income';
            const meta = metaFor(transaction.category);

            return (
              <ListRow
                key={transaction.id}
                icon={meta.icon}
                tone={isIncome ? 'success' : 'neutral'}
                title={meta.label}
                subtitle={
                  formatDate(transaction.date) +
                  (transaction.note ? `\n${transaction.note}` : '')
                }
                value={`${isIncome ? '+' : '-'}${formatRupiah(
                  transaction.amount
                )}`}
                valueColor={isIncome ? colors.success : colors.danger}
              />
            );
          })}
        </ListGroup>
      )}
    </Screen>
  );
}

function Chips({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: string[];
  selected: string;
  onSelect: (item: string) => void;
}) {
  return (
    <>
      <Text style={font.label}>{label}</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((item) => (
          <Chip
            key={item}
            label={metaFor(item).label}
            icon={metaFor(item).icon}
            active={selected === item}
            onPress={() => onSelect(item)}
          />
        ))}
      </View>
    </>
  );
}
