import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, spacing, typography } from '../../components/tokens';
import type { SessionCardText } from './formatSession';
import type { SessionCardSummary } from './sessionProgressText';

type SessionCardProps = {
  text: SessionCardText;
  summary: SessionCardSummary;
  onPress: () => void;
};

// components/12-session-card.png. The whole card opens the session and is read as one button:
// name, date, state, rounds and score basis, without repeating the lines one by one.
export function SessionCard({ text, summary, onPress }: SessionCardProps) {
  return (
    <Pressable
      accessibilityHint="Opens the session"
      accessibilityLabel={`${text.accessibilityLabel}. ${summary.spoken}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <StatusBadge
          label={summary.statusLabel}
          tone={summary.status === 'finished' ? 'success' : 'accent'}
        />
        <Icon icon={ChevronRight} size="feature" color={colors.secondary} />
      </View>
      <Text style={styles.title}>{text.title}</Text>
      <Text style={styles.meta}>{text.createdAt}</Text>
      <View style={styles.bottom}>
        <View style={styles.details}>
          <Text style={styles.detail}>{text.typeAndCalibre}</Text>
          <Text style={styles.secondary}>{text.distanceAndShots}</Text>
          <Text style={styles.secondary}>{text.plannedRounds}</Text>
          <Text style={styles.secondary}>{summary.roundsLine}</Text>
          {summary.draftLine === null ? null : (
            <Text style={styles.draft}>{summary.draftLine}</Text>
          )}
        </View>
        {summary.verified === null ? null : (
          <Text style={styles.score}>{summary.verified.short}</Text>
        )}
        {summary.demo === null ? null : (
          <Text style={[styles.score, styles.demoScore]}>{summary.demo.short}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.label,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.elevated,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
  meta: {
    ...typography.body,
    color: colors.muted,
  },
  bottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.small,
    paddingTop: spacing.fine,
  },
  details: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 180,
    gap: spacing.fine,
  },
  detail: {
    ...typography.body,
    color: colors.text,
  },
  secondary: {
    ...typography.body,
    color: colors.secondary,
  },
  draft: {
    ...typography.label,
    color: colors.warning,
  },
  score: {
    ...typography.section,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  // Demo scores carry the warning colour and the word "demo" in the text itself.
  demoScore: {
    color: colors.warning,
  },
});
