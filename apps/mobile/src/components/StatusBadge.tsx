import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from './tokens';

export type BadgeTone = 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

const TONE = {
  accent: { color: colors.accent, backgroundColor: colors.accentSurface },
  success: { color: colors.success, backgroundColor: colors.successSurface },
  warning: { color: colors.warning, backgroundColor: colors.warningSurface },
  error: { color: colors.error, backgroundColor: colors.errorSurface },
  info: { color: colors.info, backgroundColor: colors.infoSurface },
  neutral: { color: colors.secondary, backgroundColor: colors.elevated },
} as const;

// Text describes the state; the badge is never a button (components/10-status-badges.png).
// Screen readers read the text as part of the surrounding group.
export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <View style={[styles.badge, { backgroundColor: TONE[tone].backgroundColor }]}>
      <Text style={[styles.label, { color: TONE[tone].color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.small,
    paddingHorizontal: spacing.label,
    paddingVertical: spacing.fine,
  },
  label: {
    ...typography.label,
  },
});
