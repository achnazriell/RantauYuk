import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '@/theme';
import { formatRupiah } from '@/lib/format';

type BalanceCardProps = {
  balance: number;
  safeDailyLimit: number;
  remainingDays: number;
  /** Jika diisi, muncul tautan "Lihat rincian". */
  onPressDetail?: () => void;
};

/**
 * Satu-satunya elemen berwarna pekat di aplikasi: saldo adalah hal pertama
 * yang ingin dilihat anak rantau, jadi kartu ini yang paling menonjol.
 */
export function BalanceCard({
  balance,
  safeDailyLimit,
  remainingDays,
  onPressDetail,
}: BalanceCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.label}>Saldo sekarang</Text>

        {onPressDetail ? (
          <Pressable
            onPress={onPressDetail}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Lihat rincian keuangan"
            style={styles.link}
          >
            <Text style={styles.linkText}>Lihat rincian</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.onPrimaryMuted}
            />
          </Pressable>
        ) : null}
      </View>

      <Text
        style={styles.amount}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatRupiah(balance)}
      </Text>

      <View style={styles.safe}>
        <View style={styles.safeIcon}>
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={colors.accent}
          />
        </View>

        <View style={styles.safeText}>
          <Text style={styles.safeLabel}>Batas aman hari ini</Text>
          <Text style={styles.safeValue}>
            {formatRupiah(safeDailyLimit)}
          </Text>
        </View>

        <View style={styles.days}>
          <Text style={styles.daysValue}>{remainingDays}</Text>
          <Text style={styles.daysLabel}>hari lagi</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimaryMuted,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onPrimaryMuted,
  },
  amount: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1,
    color: colors.onPrimary,
  },
  safe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  safeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,163,23,0.16)',
  },
  safeText: {
    flex: 1,
  },
  safeLabel: {
    fontSize: 12,
    color: colors.onPrimaryMuted,
  },
  safeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  days: {
    alignItems: 'flex-end',
  },
  daysValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent,
  },
  daysLabel: {
    fontSize: 11,
    color: colors.onPrimaryMuted,
  },
});
