import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, radius, sizes, spacing, typography } from './tokens';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  // Work in progress: keeps the label (the caller words it, e.g. "Saving…"), shows a small
  // spinner next to it and rejects further presses.
  busy?: boolean;
  // Decorative leading icon; the label carries the meaning.
  icon?: LucideIcon;
  accessibilityHint?: string;
};

const LABEL_COLOR: Record<ButtonVariant, string> = {
  primary: colors.onAccent,
  secondary: colors.text,
  destructive: colors.error,
};

// Buttons from docs/design/images/components/03-buttons.png: default, pressed, focus, disabled
// and busy. Disabled uses explicit colours, never opacity on the whole control.
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  icon,
  accessibilityHint,
}: ButtonProps) {
  const [focused, setFocused] = useState(false);
  const inactive = disabled || busy;
  const labelColor = disabled ? colors.disabledText : LABEL_COLOR[variant];
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.disabled : styles[variant],
        pressed && !inactive ? PRESSED[variant] : null,
        focused ? styles.focused : null,
      ]}
    >
      <View style={styles.content}>
        {busy ? (
          <ActivityIndicator color={labelColor} size="small" />
        ) : icon === undefined ? null : (
          <Icon icon={icon} size="action" color={labelColor} />
        )}
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: sizes.primaryButtonHeight,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.field,
    paddingVertical: spacing.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.inputBorder,
  },
  destructive: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.error,
  },
  disabled: {
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledSurface,
  },
  focused: {
    borderWidth: 2,
    borderColor: colors.focus,
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.label,
  },
  label: {
    ...typography.button,
    textAlign: 'center',
    flexShrink: 1,
  },
});

const PRESSED = StyleSheet.create({
  primary: { backgroundColor: colors.accentPressed, borderColor: colors.accentPressed },
  secondary: { backgroundColor: colors.elevated },
  destructive: { backgroundColor: colors.elevated },
});
