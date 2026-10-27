import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, radius, sizes, spacing, typography } from './tokens';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  // Work in progress: keeps the variant's look but does not respond to presses.
  busy?: boolean;
  // Decorative leading icon; the label carries the meaning.
  icon?: LucideIcon;
};

const LABEL_COLOR: Record<ButtonVariant, string> = {
  primary: colors.onAccent,
  secondary: colors.text,
  destructive: colors.error,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  icon,
}: ButtonProps) {
  const inactive = disabled || busy;
  const labelColor = disabled ? colors.disabled : LABEL_COLOR[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.disabled : styles[variant],
        pressed && !inactive ? styles.pressed : null,
      ]}
    >
      <View style={styles.content}>
        {icon === undefined ? null : <Icon icon={icon} size="action" color={labelColor} />}
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      </View>
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
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  destructive: {
    backgroundColor: colors.elevated,
  },
  disabled: {
    backgroundColor: colors.elevated,
  },
  pressed: {
    opacity: 0.85,
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.label,
  },
  label: {
    ...typography.label,
    textAlign: 'center',
  },
});
