import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import {
  addGrocery,
  getGroceries,
  markGroceryPurchased,
  updateGroceryStatus,
  type Grocery,
} from '@/services/grocery.service';
import { formatRupiah } from '@/services/finance.service';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  IconBadge,
  Screen,
  ScreenHeader,
  SectionHeader,
  Segmented,
  StatTile,
} from '@/components/ui';
import { colors, font, spacing } from '@/theme';
import { digitsOnly, formatThousands } from '@/lib/format';

type StockFilter = 'semua' | 'ada' | 'habis' | 'perlu_dibeli';
type StockStatus = Grocery['stock_status'];

const statusOptions: { value: StockStatus; label: string }[] = [
  { value: 'ada', label: 'Ada' },
  { value: 'habis', label: 'Habis' },
  { value: 'perlu_dibeli', label: 'Belanja' },
];

export default function FoodScreen() {
  const db = useSQLiteContext();

  const [groceries, setGroceries] = useState<Grocery[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');

  const [filter, setFilter] = useState<StockFilter>('semua');

  const loadGroceries = useCallback(async () => {
    try {
      const rows = await getGroceries(db);
      setGroceries(rows);
    } catch (error) {
      console.error('Gagal memuat stok:', error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadGroceries();
    }, [loadGroceries])
  );

  const filteredGroceries = useMemo(() => {
    if (filter === 'semua') {
      return groceries;
    }

    return groceries.filter((item) => item.stock_status === filter);
  }, [groceries, filter]);

  const stockCount = useMemo(() => {
    return {
      ada: groceries.filter((item) => item.stock_status === 'ada').length,
      habis: groceries.filter((item) => item.stock_status === 'habis')
        .length,
      perlu: groceries.filter(
        (item) => item.stock_status === 'perlu_dibeli'
      ).length,
    };
  }, [groceries]);

  const shoppingEstimate = useMemo(() => {
    return groceries
      .filter((item) => item.stock_status === 'perlu_dibeli')
      .reduce(
        (total, item) => total + item.estimated_price * item.quantity,
        0
      );
  }, [groceries]);

  async function handleAdd() {
    const cleanName = itemName.trim();
    const numericPrice = Number(digitsOnly(price));
    const numericQuantity = Number(quantity.replace(',', '.')) || 1;

    if (!cleanName) {
      Alert.alert('Nama bahan', 'Masukkan nama bahan makanan.');
      return;
    }

    try {
      await addGrocery(db, {
        itemName: cleanName,
        estimatedPrice: numericPrice,
        quantity: numericQuantity,
        unit: unit.trim() || 'pcs',
      });

      setItemName('');
      setPrice('');
      setQuantity('1');
      setUnit('pcs');
      setShowForm(false);

      await loadGroceries();
    } catch (error) {
      console.error(error);

      Alert.alert('Gagal', 'Bahan makanan gagal ditambahkan.');
    }
  }

  async function handleBuy(item: Grocery) {
    try {
      await markGroceryPurchased(db, item);

      await loadGroceries();

      Alert.alert(
        'Belanja dicatat',
        `${item.item_name} ditandai sebagai sudah dibeli dan pengeluaran dicatat.`
      );
    } catch (error) {
      console.error(error);

      Alert.alert('Gagal', 'Belanja belum berhasil dicatat.');
    }
  }

  async function changeStatus(item: Grocery, status: StockStatus) {
    try {
      await updateGroceryStatus(db, item.id, status);

      await loadGroceries();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Makanan dan stok"
        subtitle="Kelola bahan makanan kost dan belanja tanpa mencatat pengeluaran dua kali."
      />

      <View style={styles.stats}>
        <StatTile
          icon="checkmark-circle-outline"
          tone="success"
          label="Ada"
          value={String(stockCount.ada)}
        />

        <StatTile
          icon="close-circle-outline"
          tone="danger"
          label="Habis"
          value={String(stockCount.habis)}
        />

        <StatTile
          icon="cart-outline"
          tone="accent"
          label="Perlu dibeli"
          value={String(stockCount.perlu)}
        />
      </View>

      <Card tone="accent" style={styles.estimate}>
        <IconBadge icon="cart-outline" tone="accent" size={44} />

        <View style={styles.flex}>
          <Text style={styles.estimateLabel}>Estimasi belanja</Text>

          <Text style={styles.estimateAmount}>
            {formatRupiah(shoppingEstimate)}
          </Text>

          <Text style={styles.estimateHint}>
            Total estimasi bahan yang perlu dibeli.
          </Text>
        </View>
      </Card>

      <Button
        label={showForm ? 'Tutup formulir' : 'Tambah bahan'}
        icon={showForm ? 'close' : 'add'}
        variant={showForm ? 'outline' : 'primary'}
        onPress={() => setShowForm((value) => !value)}
      />

      {showForm && (
        <Card style={{ gap: 16 }}>
          <Field
            label="Nama bahan"
            value={itemName}
            onChangeText={setItemName}
            placeholder="Contoh: Telur"
          />

          <Field
            label="Estimasi harga"
            prefix="Rp"
            value={formatThousands(price)}
            onChangeText={(text) => setPrice(digitsOnly(text))}
            placeholder="25.000"
            keyboardType="numeric"
          />

          <View style={styles.formRow}>
            <Field
              label="Jumlah"
              containerStyle={styles.flex}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
            />

            <Field
              label="Satuan"
              containerStyle={styles.flex}
              value={unit}
              onChangeText={setUnit}
              placeholder="pcs / kg / liter"
            />
          </View>

          <Button
            label="Simpan bahan"
            icon="checkmark"
            onPress={handleAdd}
          />
        </Card>
      )}

      <SectionHeader title="Stok kost" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={styles.filterScroll}
      >
        <Chip
          label="Semua"
          active={filter === 'semua'}
          onPress={() => setFilter('semua')}
        />

        <Chip
          label="Ada"
          active={filter === 'ada'}
          onPress={() => setFilter('ada')}
        />

        <Chip
          label="Habis"
          active={filter === 'habis'}
          onPress={() => setFilter('habis')}
        />

        <Chip
          label="Perlu dibeli"
          active={filter === 'perlu_dibeli'}
          onPress={() => setFilter('perlu_dibeli')}
        />
      </ScrollView>

      {filteredGroceries.length === 0 ? (
        <EmptyState
          icon="restaurant-outline"
          title="Belum ada bahan"
          description="Tambahkan stok makanan pertama kamu."
        />
      ) : (
        filteredGroceries.map((item) => (
          <Card key={item.id} style={styles.item}>
            <View style={styles.itemHead}>
              <View style={styles.flex}>
                <Text style={styles.itemName}>{item.item_name}</Text>

                <Text style={font.caption}>
                  {item.quantity} {item.unit || ''}, estimasi{' '}
                  {formatRupiah(item.estimated_price)}
                </Text>
              </View>

              {item.stock_status === 'perlu_dibeli' && (
                <Button
                  compact
                  label="Beli"
                  icon="checkmark"
                  variant="secondary"
                  onPress={() => handleBuy(item)}
                />
              )}

              {item.stock_status === 'ada' && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={colors.success}
                />
              )}
            </View>

            <Segmented<StockStatus>
              size="sm"
              value={item.stock_status}
              onChange={(status) => changeStatus(item, status)}
              options={statusOptions}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  estimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  estimateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentInk,
  },
  estimateAmount: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.ink,
  },
  estimateHint: {
    fontSize: 12,
    color: colors.accentInk,
  },

  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  filterScroll: {
    marginHorizontal: -spacing.xl,
  },
  filters: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },

  item: {
    gap: spacing.md,
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemName: {
    ...font.heading,
  },
});
