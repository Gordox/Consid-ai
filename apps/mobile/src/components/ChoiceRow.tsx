import Check from 'lucide-react-native/icons/check';
import Circle from 'lucide-react-native/icons/circle';
import type { Ref } from 'react';
import { type HostInstance, Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from './Icon';
import { colors, radius, sizes, spacing, typography } from './tokens';

type ChoiceRowProps = {
  label: string;
  selected: boolean;
  onSelect: () => void;
  locked: boolean;
  rowRef?: Ref<HostInstance>;
};

// One option in a single-choice group. Selection is shown by shape (check, thicker border)
// and announced as a checked radio, not by colour alone.
export function ChoiceRow({ label, selected, onSelect, locked, rowRef }: ChoiceRowProps) {
  return (
    <Pressable
      ref={rowRef}
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: locked }}
      disabled={locked}
      onPress={onSelect}
      style={[
        styles.row,
        selected ? styles.selected : styles.unselected,
        locked ? styles.locked : null,
      ]}
    >
      <Icon
        icon={selected ? Check : Circle}
        size="action"
        color={selected ? colors.accent : colors.secondary}
      />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.label,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  selected: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  unselected: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  locked: {
    borderColor: colors.disabled,
  },
  label: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
  },
});
