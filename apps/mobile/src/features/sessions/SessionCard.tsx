import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../components/tokens';
import type { SessionCardText } from './formatSession';

// Not pressable and no chevron (F5). Read as one group by screen readers, so the individual
// lines are not announced again.
export function SessionCard({ text }: { text: SessionCardText }) {
  return (
    <View accessible accessibilityLabel={text.accessibilityLabel} style={styles.card}>
      <Text style={styles.title}>{text.title}</Text>
      <Text style={styles.secondary}>{text.createdAt}</Text>
      <Text style={styles.detail}>{text.typeAndCalibre}</Text>
      <Text style={styles.detail}>{text.distanceAndShots}</Text>
      <Text style={styles.detail}>{text.plannedRounds}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.fine,
    padding: spacing.field,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  title: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.fine,
  },
  secondary: {
    ...typography.label,
    color: colors.secondary,
  },
  detail: {
    ...typography.body,
    color: colors.text,
  },
});
