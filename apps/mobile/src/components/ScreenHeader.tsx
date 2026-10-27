import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import type { Ref } from 'react';
import { type HostInstance, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, sizes, spacing, typography } from './tokens';

type ScreenHeaderProps = {
  title: string;
  onBack: () => void;
  backRef?: Ref<HostInstance>;
};

// Replaces the platform back arrow so the app uses one icon family. Android back and the iOS
// back gesture are handled by the screen with usePreventRemove.
export function ScreenHeader({ title, onBack, backRef }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        ref={backRef}
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={spacing.label}
        onPress={onBack}
        style={styles.back}
      >
        <Icon icon={ChevronLeft} size="action" color={colors.text} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.small,
  },
  back: {
    minHeight: sizes.minTouchTarget,
    minWidth: sizes.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.fine,
  },
  backLabel: {
    ...typography.label,
    color: colors.text,
  },
  title: {
    ...typography.pageTitle,
    color: colors.text,
  },
});
