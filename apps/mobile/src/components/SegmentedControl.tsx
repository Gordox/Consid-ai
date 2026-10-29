import Check from 'lucide-react-native/icons/check';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, radius, sizes, spacing, typography } from './tokens';

type Segment<T extends string> = { readonly value: T; readonly label: string };

type SegmentedControlProps<T extends string> = {
  label: string;
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
};

// Local view filter (components/08-segments.png): selection is a check, text and background,
// announced as a checked radio. Segments wrap at large text sizes instead of clipping.
export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.group}>
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityLabel={segment.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(segment.value)}
            style={[styles.segment, selected ? styles.selected : null]}
          >
            {selected ? <Icon icon={Check} size="inline" color={colors.onAccent} /> : null}
            <Text style={[styles.label, selected ? styles.selectedLabel : null]}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.fine,
    padding: spacing.fine,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  segment: {
    flexGrow: 1,
    flexBasis: 80,
    minHeight: sizes.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.fine,
    paddingHorizontal: spacing.small,
    borderRadius: radius.small,
  },
  selected: {
    backgroundColor: colors.accent,
  },
  label: {
    ...typography.label,
    color: colors.secondary,
    textAlign: 'center',
    flexShrink: 1,
  },
  selectedLabel: {
    color: colors.onAccent,
  },
});
