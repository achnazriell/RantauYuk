import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* ------------------------------------------------------------------ */
/* Tema                                                                */
/* ------------------------------------------------------------------ */

const light = {
  bg: '#F3F6F4',
  surface: '#FFFFFF',
  border: '#D9E2DD',
  text: '#13201A',
  muted: '#5B6B63',
  primary: '#1B7A5A',
  onPrimary: '#FFFFFF',
  primarySoft: '#DCEFE6',
  warn: '#8A5A00',
  warnSoft: '#FBEECB',
  danger: '#B23A2E',
  dangerSoft: '#F7E0DD',
  amber: '#C98A0B',
};

export type Theme = typeof light;

const dark: Theme = {
  bg: '#0E1411',
  surface: '#17201B',
  border: '#27342D',
  text: '#E6EFEA',
  muted: '#93A39A',
  primary: '#3FB68B',
  onPrimary: '#06231A',
  primarySoft: '#1C3A2E',
  warn: '#F0C15A',
  warnSoft: '#3A2E12',
  danger: '#F08A7E',
  dangerSoft: '#3C1D19',
  amber: '#E5A82B',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Terjadi kesalahan yang tidak diketahui.';
}

export function showError(error: unknown, title = 'Terjadi masalah'): void {
  Alert.alert(title, errorMessage(error));
}

export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
): void {
  Alert.alert(title, message, [
    { text: 'Batal', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Kunci tanggal lokal, format YYYY-MM-DD. */
export function toDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

export function formatDayMonth(date: Date): string {
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatMinutes(total: number): string {
  if (total < 60) return `${total} menit`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} j ${m} m` : `${h} jam`;
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Screen({
  title,
  subtitle,
  icon,
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const t = useTheme();

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.primarySoft,
        }}>
        <Ionicons name={icon} size={24} color={t.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          accessibilityRole="header"
          style={{ color: t.text, fontSize: 24, fontWeight: '700' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: t.muted, fontSize: 14, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              ) : undefined
            }>
            {header}
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, padding: 20, paddingBottom: 12, gap: 12 }}>
            {header}
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderColor: t.border,
          borderWidth: 1,
          borderRadius: 16,
          padding: 16,
          gap: 10,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* Kontrol                                                             */
/* ------------------------------------------------------------------ */

type Variant = 'primary' | 'soft' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const palette = {
    primary: { bg: t.primary, fg: t.onPrimary, border: t.primary },
    soft: { bg: t.primarySoft, fg: t.primary, border: t.primarySoft },
    ghost: { bg: 'transparent', fg: t.text, border: t.border },
    danger: { bg: t.dangerSoft, fg: t.danger, border: t.dangerSoft },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 48,
          borderRadius: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: palette.bg,
          borderWidth: 1,
          borderColor: palette.border,
          opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={palette.fg} />
      ) : null}
      <Text style={{ color: palette.fg, fontSize: 15, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}>
      <Ionicons name={icon} size={22} color={color ?? t.muted} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 20,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: selected ? t.primary : t.border,
        backgroundColor: selected ? t.primary : t.surface,
        opacity: pressed ? 0.8 : 1,
      })}>
      <Text
        style={{
          color: selected ? t.onPrimary : t.text,
          fontSize: 14,
          fontWeight: '500',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {children}
    </View>
  );
}

export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={t.muted}
        style={[
          {
            minHeight: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.bg,
            color: t.text,
            paddingHorizontal: 14,
            fontSize: 16,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Umpan balik                                                         */
/* ------------------------------------------------------------------ */

export function Banner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'error';
  children: string;
}) {
  const t = useTheme();
  const palette = {
    info: { bg: t.primarySoft, fg: t.primary, icon: 'information-circle-outline' },
    warn: { bg: t.warnSoft, fg: t.warn, icon: 'warning-outline' },
    error: { bg: t.dangerSoft, fg: t.danger, icon: 'alert-circle-outline' },
  }[tone] as { bg: string; fg: string; icon: IconName };

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        gap: 10,
        padding: 12,
        borderRadius: 12,
        backgroundColor: palette.bg,
      }}>
      <Ionicons name={palette.icon} size={20} color={palette.fg} />
      <Text style={{ flex: 1, color: palette.fg, fontSize: 14, lineHeight: 20 }}>
        {children}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: IconName;
  title: string;
  hint?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
      <Ionicons name={icon} size={36} color={t.muted} />
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>
        {title}
      </Text>
      {hint ? (
        <Text
          style={{
            color: t.muted,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
            maxWidth: 300,
          }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const t = useTheme();
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: value }}
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: t.primarySoft,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${ratio * 100}%`,
          height: '100%',
          backgroundColor: t.primary,
        }}
      />
    </View>
  );
}