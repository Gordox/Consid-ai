import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import type { Ref } from 'react';
import { type HostInstance, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, sizes, spacing, typography } from './tokens';

type ScreenHeaderProps = {
  title: string;
  // One line of context below the title, e.g. "Round 3 · Draft saved".
  subtitle?: string;
  onBack: () => void;
  backRef?: Ref<HostInstance>;
};

// Replaces the platform back arrow so the app uses one icon family. Android back and the iOS
// back gesture are handled by the screen with usePreventRemove.
export function ScreenHeader({ title, subtitle, onBack, backRef }: ScreenHeaderProps) {
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
        <Icon icon={ChevronLeft} size="feature" color={colors.secondary} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
      <View style={styles.titleGroup}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle === undefined ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
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
    ...typography.body,
    color: colors.secondary,
  },
  titleGroup: {
    gap: spacing.fine,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.secondary,
  },
});
