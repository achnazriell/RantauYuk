import { Children, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  RefreshControlProps,
  StyleProp,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, radius, spacing, tones } from '@/theme';
import type { Tone } from '@/theme';

export type IconName = keyof typeof Ionicons.glyphMap;

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

type ScreenProps = {
  children: ReactNode;
  /** Layar di dalam tab cukup 'top'. Layar di luar tab: ['top', 'bottom']. */
  edges?: Edge[];
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Area tetap di bawah layar (mis. tombol simpan). */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  edges = ['top'],
  refreshControl,
  footer,
  contentStyle,
}: ScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.screenContent, contentStyle]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** true = router.back(), atau berikan handler sendiri. */
  back?: boolean | (() => void);
  right?: ReactNode;
};

export function ScreenHeader({
  title,
  subtitle,
  back,
  right,
}: ScreenHeaderProps) {
  const handleBack = () => {
    if (typeof back === 'function') {
      back();
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tabs');
    }
  };

  return (
    <View style={styles.header}>
      {back ? (
        <View style={styles.headerBar}>
          <IconButton
            icon="chevron-back"
            label="Kembali"
            onPress={handleBack}
          />
          {right}
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={font.display} accessibilityRole="header">
            {title}
          </Text>

          {subtitle ? (
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          ) : null}
        </View>

        {!back && right ? right : null}
      </View>
    </View>
  );
}

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={font.title}>{title}</Text>

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type CardProps = {
  children: ReactNode;
  tone?: 'default' | 'accent';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  tone = 'default',
  padded = true,
  style,
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        tone === 'accent' && styles.cardAccent,
        padded && styles.cardPadded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Kumpulan baris dalam satu kartu, dipisah garis tipis. */
export function ListGroup({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.group}>
      {items.map((child, index) => (
        <View
          key={index}
          style={index > 0 ? styles.groupDivider : undefined}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Icons & badges                                                              */
/* -------------------------------------------------------------------------- */

type IconBadgeProps = {
  icon: IconName;
  tone?: Tone;
  size?: number;
};

export function IconBadge({
  icon,
  tone = 'primary',
  size = 40,
}: IconBadgeProps) {
  const palette = tones[tone];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons
        name={icon}
        size={Math.round(size * 0.52)}
        color={palette.fg}
      />
    </View>
  );
}

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

export function IconButton({ icon, label, onPress }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.ink} />
    </Pressable>
  );
}

type BadgeProps = {
  label: string;
  tone?: Tone;
  icon?: IconName;
};

export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const palette = tones[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      {icon ? (
        <Ionicons name={icon} size={13} color={palette.fg} />
      ) : null}
      <Text style={[styles.badgeText, { color: palette.fg }]}>
        {label}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

const buttonPalette = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
  secondary: {
    bg: colors.primaryTint,
    fg: colors.primary,
    border: colors.primaryTint,
  },
  outline: { bg: colors.surface, fg: colors.ink, border: colors.borderStrong },
  danger: {
    bg: colors.dangerTint,
    fg: colors.danger,
    border: colors.dangerTint,
  },
} as const;

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  compact = false,
  style,
}: ButtonProps) {
  const palette = buttonPalette[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        inactive && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : icon ? (
        <Ionicons
          name={icon}
          size={compact ? 16 : 19}
          color={palette.fg}
        />
      ) : null}

      <Text
        style={[
          styles.buttonText,
          compact && styles.buttonTextCompact,
          { color: palette.fg },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: IconName;
};

export function Chip({ label, active, onPress, icon }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={active ? colors.onPrimary : colors.textMuted}
        />
      ) : null}

      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

type SegmentedProps<T extends string> = {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'md' | 'sm';
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: SegmentedProps<T>) {
  const small = size === 'sm';

  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              small && styles.segmentSmall,
              active && styles.segmentActive,
            ]}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={small ? 14 : 17}
                color={active ? colors.primary : colors.textMuted}
              />
            ) : null}

            <Text
              numberOfLines={1}
              style={[
                styles.segmentText,
                small && styles.segmentTextSmall,
                active && styles.segmentTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type ChoiceRowProps = {
  icon: IconName;
  title: string;
  description?: string;
  active: boolean;
  onPress: () => void;
};

/** Pilihan tunggal berbentuk baris (radio). */
export function ChoiceRow({
  icon,
  title,
  description,
  active,
  onPress,
}: ChoiceRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.choice,
        active && styles.choiceActive,
        pressed && styles.pressed,
      ]}
    >
      <IconBadge icon={icon} tone={active ? 'primary' : 'neutral'} size={38} />

      <View style={styles.flex}>
        <Text style={font.bodyStrong}>{title}</Text>

        {description ? (
          <Text style={font.caption}>{description}</Text>
        ) : null}
      </View>

      <Ionicons
        name={active ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={active ? colors.primary : colors.borderStrong}
      />
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Forms                                                                       */
/* -------------------------------------------------------------------------- */

type FieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  prefix?: string;
  icon?: IconName;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Field({
  label,
  hint,
  error,
  prefix,
  icon,
  containerStyle,
  style,
  multiline,
  onFocus,
  onBlur,
  ...rest
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <View
        style={[
          styles.inputWrap,
          multiline && styles.inputWrapMultiline,
          focused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={18} color={colors.textFaint} />
        ) : null}

        {prefix ? <Text style={styles.inputPrefix}>{prefix}</Text> : null}

        <TextInput
          {...rest}
          multiline={multiline}
          accessibilityLabel={label}
          placeholderTextColor={colors.textFaint}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            style,
          ]}
        />
      </View>

      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                                */
/* -------------------------------------------------------------------------- */

type ListRowProps = {
  icon?: IconName;
  tone?: Tone;
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
};

export function ListRow({
  icon,
  tone = 'primary',
  title,
  subtitle,
  value,
  valueColor,
  right,
  onPress,
  disabled,
}: ListRowProps) {
  const content = (
    <>
      {icon ? <IconBadge icon={icon} tone={tone} size={38} /> : null}

      <View style={styles.flex}>
        <Text style={font.bodyStrong} numberOfLines={1}>
          {title}
        </Text>

        {subtitle ? (
          <Text style={font.caption} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text
          style={[
            styles.rowValue,
            valueColor ? { color: valueColor } : null,
          ]}
        >
          {value}
        </Text>
      ) : null}

      {right}

      {onPress && !right ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textFaint}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

type StatTileProps = {
  icon: IconName;
  tone?: Tone;
  label: string;
  value: string;
  valueColor?: string;
};

export function StatTile({
  icon,
  tone = 'primary',
  label,
  value,
  valueColor,
}: StatTileProps) {
  return (
    <View style={styles.stat}>
      <IconBadge icon={icon} tone={tone} size={34} />

      <Text
        style={[styles.statValue, valueColor ? { color: valueColor } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>

      <Text style={font.micro}>{label}</Text>
    </View>
  );
}

type ProgressBarProps = {
  /** 0 sampai 1 */
  value: number;
  onDark?: boolean;
};

export function ProgressBar({ value, onDark = false }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <View
      style={[styles.track, onDark && styles.trackOnDark]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={[
          styles.fill,
          onDark && styles.fillOnDark,
          { width: `${Math.round(clamped * 100)}%` },
        ]}
      />
    </View>
  );
}

type EmptyStateProps = {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <IconBadge icon={icon} tone="neutral" size={52} />

      <Text style={[font.heading, styles.emptyTitle]}>{title}</Text>

      {description ? (
        <Text style={[font.caption, styles.emptyText]}>{description}</Text>
      ) : null}

      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                      */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  flex: { flex: 1 },

  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screenContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
    gap: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },

  header: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  headerSubtitle: {
    ...font.caption,
    fontSize: 14,
    lineHeight: 20,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardAccent: {
    backgroundColor: colors.accentTint,
    borderColor: colors.accentTint,
  },
  cardPadded: {
    padding: spacing.lg,
    gap: spacing.md,
  },

  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  groupDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },

  button: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  buttonCompact: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  buttonTextCompact: {
    fontSize: 14,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentSmall: {
    minHeight: 34,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  segmentTextSmall: {
    fontSize: 13,
  },
  segmentTextActive: {
    color: colors.primary,
  },

  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },

  field: {
    gap: 6,
  },
  fieldLabel: {
    ...font.label,
  },
  inputWrap: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputWrapMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputPrefix: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 10,
  },
  inputMultiline: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  fieldHint: {
    ...font.micro,
  },
  fieldError: {
    ...font.micro,
    color: colors.danger,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 60,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },

  stat: {
    flex: 1,
    gap: 6,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statValue: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.ink,
    marginTop: 4,
  },

  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  trackOnDark: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  fillOnDark: {
    backgroundColor: colors.accent,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 4,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});
