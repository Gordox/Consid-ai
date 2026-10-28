import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, radius, sizes, spacing, typography } from './tokens';

type StepperProps = {
  label: string;
  value: number;
  // Shown instead of the bare number, e.g. "9.0 mm".
  valueText?: string;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

// Whole steps only, so values stay inside the limits without typing (and no keyboard opens).
export function Stepper({
  label,
  value,
  valueText,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
}: StepperProps) {
  const text = valueText ?? String(value);
  const canDecrease = !disabled && value - step >= min - 1e-9;
  const canIncrease = !disabled && value + step <= max + 1e-9;
  const round = (next: number) => Math.round(next * 10) / 10;

  return (
    <View
      accessible
      accessibilityActions={[
        { name: 'increment', label: `Increase ${label}` },
        { name: 'decrement', label: `Decrease ${label}` },
      ]}
      accessibilityLabel={label}
      accessibilityRole="adjustable"
      accessibilityValue={{ text }}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment' && canIncrease)
          onChange(round(value + step));
        if (event.nativeEvent.actionName === 'decrement' && canDecrease)
          onChange(round(value - step));
      }}
      style={styles.row}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Pressable
          accessibilityElementsHidden
          disabled={!canDecrease}
          hitSlop={spacing.fine}
          importantForAccessibility="no-hide-descendants"
          onPress={() => onChange(round(value - step))}
          style={[styles.button, !canDecrease && styles.disabled]}
        >
          <Icon icon={Minus} size="action" color={canDecrease ? colors.text : colors.disabled} />
        </Pressable>
        <Text style={styles.value}>{text}</Text>
        <Pressable
          accessibilityElementsHidden
          disabled={!canIncrease}
          hitSlop={spacing.fine}
          importantForAccessibility="no-hide-descendants"
          onPress={() => onChange(round(value + step))}
          style={[styles.button, !canIncrease && styles.disabled]}
        >
          <Icon icon={Plus} size="action" color={canIncrease ? colors.text : colors.disabled} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  label: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  button: {
    width: sizes.minTouchTarget,
    height: sizes.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  disabled: {
    borderColor: colors.border,
  },
  value: {
    ...typography.section,
    color: colors.text,
    minWidth: 64,
    textAlign: 'center',
  },
});
