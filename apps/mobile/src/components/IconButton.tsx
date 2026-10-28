import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from './Icon';
import { colors, radius, sizes } from './tokens';

type IconButtonProps = {
  icon: LucideIcon;
  // Required: the icon alone has no accessible name.
  label: string;
  onPress: () => void;
  disabled?: boolean;
  // For tool modes: announced as selected and shown with border and background, not colour alone.
  selected?: boolean;
};

// 48 × 48 hit area (components/04-icon-buttons.png).
export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  selected = false,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        selected ? styles.selected : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Icon
        icon={icon}
        size="feature"
        color={disabled ? colors.disabledText : selected ? colors.accent : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: sizes.minTouchTarget,
    minHeight: sizes.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  selected: {
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  disabled: {
    borderColor: colors.disabledSurface,
    backgroundColor: colors.disabledSurface,
  },
  pressed: {
    backgroundColor: colors.elevated,
  },
});
