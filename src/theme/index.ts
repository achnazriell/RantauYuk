import type { TextStyle } from 'react-native';

/**
 * Rantau Yuk design tokens.
 *
 * Palet: hijau pinus (rumah / aman), kunyit (perhatian / prioritas),
 * dan netral kehijauan yang dingin, supaya tidak terasa seperti
 * "biru default + putih".
 */
export const colors = {
  bg: '#F2F6F4',
  surface: '#FFFFFF',
  surfaceMuted: '#E8EFEC',
  border: '#DCE5E2',
  borderStrong: '#C3D0CC',

  ink: '#10221F',
  textMuted: '#566966',
  textFaint: '#7F918D',

  primary: '#0E6B5C',
  primaryDark: '#0A453D',
  primaryTint: '#DFF0EB',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: 'rgba(255,255,255,0.72)',

  accent: '#E8A317',
  accentTint: '#FAEFD2',
  accentInk: '#6E4A00',

  success: '#1D8348',
  successTint: '#DEF2E6',
  danger: '#C0392B',
  dangerTint: '#FAE5E1',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

export const font = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.ink,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: colors.ink,
  },
  heading: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: colors.ink,
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.ink,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: colors.textMuted,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.ink,
  },
  micro: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.textMuted,
  },
} satisfies Record<string, TextStyle>;

export type Tone = 'primary' | 'accent' | 'success' | 'danger' | 'neutral';

export const tones: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: colors.primaryTint, fg: colors.primary },
  accent: { bg: colors.accentTint, fg: colors.accentInk },
  success: { bg: colors.successTint, fg: colors.success },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  neutral: { bg: colors.surfaceMuted, fg: colors.textMuted },
};
