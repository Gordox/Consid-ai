import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, sizes, spacing, typography } from './tokens';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

// Primary action. Further variants are added in the substep that first needs them.
export function Button({ label, onPress, disabled = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.disabled : styles.enabled,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.label, disabled ? styles.disabledLabel : styles.enabledLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: sizes.primaryButtonHeight,
    borderRadius: radius.control,
    paddingHorizontal: spacing.field,
    paddingVertical: spacing.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enabled: {
    backgroundColor: colors.accent,
  },
  disabled: {
    backgroundColor: colors.elevated,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...typography.label,
    textAlign: 'center',
  },
  enabledLabel: {
    color: colors.onAccent,
  },
  disabledLabel: {
    color: colors.disabled,
  },
});
