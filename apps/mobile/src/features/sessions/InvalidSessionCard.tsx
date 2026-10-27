import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { colors, radius, spacing, typography } from '../../components/tokens';
import {
  INVALID_ROW_MESSAGE,
  INVALID_ROW_TITLE,
  type InvalidRowText,
} from './invalidRowPresentation';

type InvalidSessionCardProps = {
  text: InvalidRowText;
  onRetry: () => void;
};

// Marked by an icon and text, not colour alone (§5.3). The text part is one accessible group;
// the button stays separately focusable.
export function InvalidSessionCard({ text, onRetry }: InvalidSessionCardProps) {
  const label = [
    INVALID_ROW_TITLE,
    text.idAccessibilityLabel,
    ...text.reasons,
    INVALID_ROW_MESSAGE,
  ].join('. ');
  return (
    <View style={styles.card}>
      <View accessible accessibilityLabel={label} style={styles.textGroup}>
        <Icon icon={TriangleAlert} size="action" color={colors.warning} />
        <Text style={styles.title}>{INVALID_ROW_TITLE}</Text>
        <Text style={styles.secondary}>{text.idText}</Text>
        {text.reasons.map((reason) => (
          <Text key={reason} style={styles.body}>
            {reason}
          </Text>
        ))}
        <Text style={styles.body}>{INVALID_ROW_MESSAGE}</Text>
      </View>
      <Button label="Try reading again" onPress={onRetry} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  textGroup: {
    gap: spacing.fine,
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
  secondary: {
    ...typography.label,
    color: colors.secondary,
  },
  body: {
    ...typography.body,
    color: colors.secondary,
  },
});
