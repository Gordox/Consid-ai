import { StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from './StatusBadge';
import { colors, radius, spacing, typography } from './tokens';

type ScoreSummaryProps = {
  // e.g. "Session subtotal", "Round 3".
  eyebrow: string;
  points: number;
  // A total only when every shot has a known value; otherwise a subtotal.
  complete: boolean;
  // Scores on an unverified target are always labelled as demo.
  demo: boolean;
  // Explains the count, e.g. "4 of 5 shots accounted for".
  detail: string;
};

// components/14-score-summary.png. Score basis (demo or verified), total or subtotal, and the
// accounting are separate statements; the number is never shown without them.
export function ScoreSummary({ eyebrow, points, complete, demo, detail }: ScoreSummaryProps) {
  const kind = complete ? 'total' : 'subtotal';
  const label = [
    eyebrow,
    `${points} ${points === 1 ? 'point' : 'points'}, ${kind}`,
    demo ? 'Demo score' : null,
    detail,
  ]
    .filter((part) => part !== null)
    .join('. ');
  return (
    <View accessible accessibilityLabel={label} style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        {demo ? <StatusBadge label="Demo score" tone="warning" /> : null}
      </View>
      <View style={styles.scoreRow}>
        <Text style={styles.score}>{points}</Text>
        <Text style={styles.unit}>{complete ? 'points' : 'points subtotal'}</Text>
      </View>
      <Text style={styles.detail}>{detail}</Text>
    </View>
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
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.label,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    flexShrink: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: spacing.label,
  },
  score: {
    ...typography.score,
    color: colors.text,
  },
  unit: {
    ...typography.body,
    color: colors.secondary,
  },
  detail: {
    ...typography.body,
    color: colors.secondary,
  },
});
