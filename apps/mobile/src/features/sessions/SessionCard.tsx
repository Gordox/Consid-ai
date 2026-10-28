import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { colors, radius, spacing, typography } from '../../components/tokens';
import type { SessionCardText } from './formatSession';

type SessionCardProps = {
  text: SessionCardText;
  // Status, confirmed rounds and points, e.g. "In progress · 2 rounds · 47 points".
  progress: string;
  onPress: () => void;
};

// Opens the session. Read as one button by screen readers, so the lines are not announced
// again one by one.
export function SessionCard({ text, progress, onPress }: SessionCardProps) {
  return (
    <Pressable
      accessibilityHint="Opens the session"
      accessibilityLabel={`${text.accessibilityLabel}. ${progress}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>{text.title}</Text>
        <Text style={styles.secondary}>{text.createdAt}</Text>
        <Text style={styles.detail}>{text.typeAndCalibre}</Text>
        <Text style={styles.detail}>{text.distanceAndShots}</Text>
        <Text style={styles.detail}>{text.plannedRounds}</Text>
        <Text style={styles.progress}>{progress}</Text>
      </View>
      <Icon icon={ChevronRight} size="action" color={colors.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.elevated,
  },
  text: {
    flex: 1,
    gap: spacing.fine,
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
  progress: {
    ...typography.label,
    color: colors.accent,
    marginTop: spacing.fine,
  },
});
