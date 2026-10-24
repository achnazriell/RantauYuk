import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";

import {
  getFinanceSummary,
  type FinanceSummary,
} from "@/services/finance.service";
import {
  getSchedulesForToday,
  type ScheduleWithStatus,
} from "@/services/schedule.service";
import { getGroceries } from "@/services/grocery.service";

import { BalanceCard } from "@/components/balance-card";
import {
  Button,
  Card,
  EmptyState,
  IconBadge,
  ListGroup,
  ListRow,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionHeader,
} from "@/components/ui";
import type { IconName } from "@/components/ui";
import { colors, font, radius, spacing } from "@/theme";
import { formatDateLong, formatRupiah } from "@/lib/format";

type UserProfile = {
  name: string;
  occupation_status: string;
  monthly_budget: number;
  payday_date: number;
  food_preference: string;
  religion_mode: string;
};

type ShoppingSummary = {
  count: number;
  estimate: number;
};

export default function HomeTab() {
  const db = useSQLiteContext();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [tasks, setTasks] = useState<ScheduleWithStatus[]>([]);
  const [shopping, setShopping] = useState<ShoppingSummary>({
    count: 0,
    estimate: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const user = await db.getFirstAsync<UserProfile>(
        `
        SELECT
          name,
          occupation_status,
          monthly_budget,
          payday_date,
          food_preference,
          religion_mode
        FROM user_preferences
        WHERE id = 1
        `,
      );

      if (!user) {
        setProfile(null);
        setFinance(null);
        setTasks([]);
        setShopping({ count: 0, estimate: 0 });
        return;
      }

      const financeSummary = await getFinanceSummary(db, user.payday_date);

      setProfile(user);
      setFinance(financeSummary);

      try {
        setTasks(await getSchedulesForToday(db));
      } catch (error) {
        console.error("Gagal memuat jadwal hari ini:", error);
      }

      try {
        const groceries = await getGroceries(db);
        const needed = groceries.filter(
          (item) => item.stock_status === "perlu_dibeli",
        );

        setShopping({
          count: needed.length,
          estimate: needed.reduce(
            (total, item) => total + item.estimated_price * item.quantity,
            0,
          ),
        });
      } catch (error) {
        console.error("Gagal memuat stok:", error);
      }
    } catch (error) {
      console.error("Gagal memuat dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <EmptyState
          icon="person-outline"
          title="Profil belum ditemukan"
          description="Selesaikan pengenalan awal agar beranda bisa ditampilkan."
        />
      </Screen>
    );
  }

  const done = tasks.filter((task) => task.is_completed === 1).length;
  const pending = tasks.filter((task) => task.is_completed !== 1);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <ScreenHeader
        title={`Halo, ${profile.name}`}
        subtitle={formatDateLong()}
        right={
          <Pressable
            onPress={() => router.push("/tabs/profile")}
            accessibilityRole="button"
            accessibilityLabel="Buka profil"
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {(profile.name || "?").charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        }
      />

      {finance && (
        <BalanceCard
          balance={finance.balance}
          safeDailyLimit={finance.safeDailyLimit}
          remainingDays={finance.remainingDays}
          onPressDetail={() => router.push("/tabs/finance")}
        />
      )}

      <View style={styles.actions}>
        <QuickAction
          icon="add-circle-outline"
          label="Catat uang"
          onPress={() => router.push("/tabs/finance")}
        />

        <QuickAction
          icon="calendar-outline"
          label="Tambah jadwal"
          onPress={() => router.push("/tabs/schedule")}
        />

        <QuickAction
          icon="camera-outline"
          label="Cek gizi"
          onPress={() => router.push("/nutrition")}
        />

        <QuickAction
          icon="location-outline"
          label="Cari tempat"
          onPress={() => router.push("/places")}
        />
      </View>

      <SectionHeader
        title="Hari ini"
        actionLabel="Lihat jadwal"
        onAction={() => router.push("/tabs/schedule")}
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Belum ada aktivitas hari ini"
          description="Susun jadwal belajar, olahraga, atau rutinitasmu."
          action={
            <Button
              label="Tambah aktivitas"
              icon="add"
              variant="secondary"
              onPress={() => router.push("/tabs/schedule")}
            />
          }
        />
      ) : (
        <Card>
          <View style={styles.progressHead}>
            <Text style={font.bodyStrong}>
              {done} dari {tasks.length} selesai
            </Text>

            <Text style={styles.progressPercent}>
              {Math.round((done / tasks.length) * 100)}%
            </Text>
          </View>

          <ProgressBar value={done / tasks.length} />

          {pending.length === 0 ? (
            <View style={styles.allDone}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={colors.success}
              />
              <Text style={font.bodyStrong}>
                Semua aktivitas hari ini selesai
              </Text>
            </View>
          ) : (
            <View style={styles.taskList}>
              {pending.slice(0, 3).map((task) => (
                <View key={task.id} style={styles.taskRow}>
                  <Ionicons
                    name="ellipse-outline"
                    size={20}
                    color={colors.borderStrong}
                  />

                  <Text style={styles.taskTitle} numberOfLines={1}>
                    {task.title}
                  </Text>

                  {task.is_priority === 1 ? (
                    <Ionicons name="star" size={15} color={colors.accent} />
                  ) : null}

                  {task.target_time ? (
                    <Text style={font.micro}>{task.target_time}</Text>
                  ) : null}
                </View>
              ))}

              {pending.length > 3 ? (
                <Text style={font.micro}>
                  +{pending.length - 3} aktivitas lainnya
                </Text>
              ) : null}
            </View>
          )}
        </Card>
      )}

      <SectionHeader title="Lainnya" />

      <ListGroup>
        <ListRow
          icon="basket-outline"
          tone="accent"
          title="Stok kos"
          subtitle={
            shopping.count > 0
              ? `${shopping.count} bahan perlu dibeli, estimasi ${formatRupiah(
                  shopping.estimate,
                )}`
              : "Belum ada bahan yang perlu dibeli"
          }
          onPress={() => router.push("/tabs/food")}
        />

        <ListRow
          icon="sparkles-outline"
          title="Rantau AI"
          subtitle="Tanya soal saldo, jadwal, dan stok"
          onPress={() => router.push("/assistant")}
        />
      </ListGroup>
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <IconBadge icon={icon} size={42} />
      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },

  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
  },
  pressed: {
    opacity: 0.8,
  },

  progressHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  allDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  taskList: {
    gap: spacing.md,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  taskTitle: {
    flex: 1,
    ...font.body,
  },
});
