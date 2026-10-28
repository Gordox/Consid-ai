import Check from 'lucide-react-native/icons/check';
import type { Ref } from 'react';
import { type HostInstance, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, radius, sizes, spacing, typography } from './tokens';

type ChoiceRowProps = {
  label: string;
  selected: boolean;
  onSelect: () => void;
  locked: boolean;
  rowRef?: Ref<HostInstance>;
};

// One option in a single-choice group (components/06-choice-list.png). Selection is shown by a
// filled radio with a check and a thicker border, and announced as a checked radio; an
// unselected row has an empty radio indicator.
export function ChoiceRow({ label, selected, onSelect, locked, rowRef }: ChoiceRowProps) {
  return (
    <Pressable
      ref={rowRef}
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: locked }}
      disabled={locked}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.selected : styles.unselected,
        locked ? styles.locked : null,
        pressed && !locked ? styles.pressed : null,
      ]}
    >
      <View style={[styles.radio, selected ? styles.radioSelected : null]}>
        {selected ? <Icon icon={Check} size="inline" color={colors.onAccent} /> : null}
      </View>
      <Text style={[styles.label, locked ? styles.lockedLabel : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.inputMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingHorizontal: spacing.field,
    paddingVertical: spacing.label,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  selected: {
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  unselected: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  locked: {
    borderColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.elevated,
  },
  radio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.inputBorder,
  },
  radioSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  label: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
  },
  lockedLabel: {
    color: colors.secondary,
  },
});
