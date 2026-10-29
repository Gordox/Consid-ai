import ChevronDown from 'lucide-react-native/icons/chevron-down';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import Lock from 'lucide-react-native/icons/lock';
import { type Ref, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  type HostInstance,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './Button';
import { ChoiceRow } from './ChoiceRow';
import { Icon } from './Icon';
import { colors, radius, sizes, spacing, typography } from './tokens';
import { useReducedMotion } from './useReducedMotion';

type Option<T extends string> = { readonly value: T; readonly label: string };

type SelectSheetProps<T extends string> = {
  label: string;
  placeholder: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  locked: boolean;
  triggerRef?: Ref<HostInstance>;
  onLayout?: (event: LayoutChangeEvent) => void;
};

// A field whose value is chosen in a bottom sheet of radio rows (components/07-select-sheet.png).
// The choice is committed only by Done; Cancel, the backdrop and Android Back keep the previous
// value. One selector per field: the sheet is the only control for this value.
export function SelectSheet<T extends string>({
  label,
  placeholder,
  options,
  value,
  onChange,
  error,
  locked,
  triggerRef,
  onLayout,
}: SelectSheetProps<T>) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const [draft, setDraft] = useState<T | null>(value);
  const titleRef = useRef<TextInstance>(null);
  const selected = options.find((option) => option.value === value) ?? null;
  const borderColor = locked
    ? colors.border
    : error !== undefined
      ? colors.error
      : colors.inputBorder;

  function show(): void {
    setDraft(value);
    setOpen(true);
  }

  function done(): void {
    setOpen(false);
    if (draft !== null && draft !== value) {
      onChange(draft);
    }
  }

  return (
    <View onLayout={onLayout} style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {locked ? <Icon icon={Lock} size="inline" color={colors.muted} /> : null}
      </View>
      <Pressable
        ref={triggerRef}
        accessibilityHint={error}
        accessibilityLabel={`${label}, ${selected?.label ?? 'not chosen'}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked, expanded: open }}
        disabled={locked}
        onPress={show}
        style={[
          styles.trigger,
          { borderColor },
          error !== undefined ? styles.emphasisedBorder : null,
          locked ? styles.lockedTrigger : null,
        ]}
      >
        <Text
          style={[
            styles.value,
            selected === null ? styles.placeholder : null,
            locked ? styles.lockedValue : null,
          ]}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Icon icon={ChevronDown} size="action" color={locked ? colors.muted : colors.text} />
      </Pressable>
      {error === undefined ? null : (
        <View style={styles.errorRow}>
          <Icon icon={CircleAlert} size="inline" color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Modal
        animationType={reducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setOpen(false)}
        onShow={() => {
          if (titleRef.current !== null) {
            AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
          }
        }}
        statusBarTranslucent
        transparent
        visible={open}
      >
        <View style={styles.scrim}>
          <Pressable
            accessibilityLabel="Cancel"
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <SafeAreaView accessibilityViewIsModal edges={['bottom']} style={styles.sheet}>
            <Text ref={titleRef} accessibilityRole="header" style={styles.sheetTitle}>
              {label}
            </Text>
            <ScrollView
              accessibilityLabel={label}
              accessibilityRole="radiogroup"
              contentContainerStyle={styles.options}
            >
              {options.map((option) => (
                <ChoiceRow
                  key={option.value}
                  label={option.label}
                  locked={false}
                  onSelect={() => setDraft(option.value)}
                  selected={draft === option.value}
                />
              ))}
            </ScrollView>
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button label="Cancel" onPress={() => setOpen(false)} variant="secondary" />
              </View>
              <View style={styles.action}>
                <Button disabled={draft === null} label="Done" onPress={done} />
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.label,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.fine,
  },
  label: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1,
  },
  trigger: {
    minHeight: sizes.inputMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingHorizontal: spacing.field,
    paddingVertical: spacing.small,
    borderRadius: radius.control,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  emphasisedBorder: {
    borderWidth: 2,
  },
  lockedTrigger: {
    backgroundColor: colors.disabledSurface,
  },
  value: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  placeholder: {
    color: colors.muted,
  },
  lockedValue: {
    color: colors.secondary,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.fine,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    flexShrink: 1,
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    maxHeight: '90%',
    gap: spacing.field,
    paddingHorizontal: spacing.inset,
    paddingTop: spacing.group,
    paddingBottom: spacing.field,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.elevated,
  },
  sheetTitle: {
    ...typography.section,
    color: colors.text,
  },
  options: {
    gap: spacing.label,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  action: {
    flexGrow: 1,
    flexBasis: 120,
  },
});
