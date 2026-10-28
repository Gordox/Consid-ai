import CircleAlert from 'lucide-react-native/icons/circle-alert';
import Lock from 'lucide-react-native/icons/lock';
import { type Ref, useState } from 'react';
import {
  type KeyboardTypeOptions,
  type LayoutChangeEvent,
  type ReturnKeyTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';

import { Icon } from './Icon';
import { colors, radius, sizes, spacing, typography } from './tokens';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  // Help text below the field, e.g. what the value is used for.
  hint?: string;
  // Locked fields keep their values but cannot be edited (save in progress or finished).
  locked: boolean;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  inputRef?: Ref<TextInputInstance>;
  onLayout?: (event: LayoutChangeEvent) => void;
};

// Persistent label above the input; empty, filled, focus, invalid and locked states
// (components/05-text-fields.png). The error follows the input in reading order.
export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  locked,
  keyboardType = 'default',
  returnKeyType,
  onSubmitEditing,
  inputRef,
  onLayout,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = locked
    ? colors.border
    : error !== undefined
      ? colors.error
      : focused
        ? colors.focus
        : colors.inputBorder;

  return (
    <View onLayout={onLayout} style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {locked ? <Icon icon={Lock} size="inline" color={colors.muted} /> : null}
      </View>
      <TextInput
        ref={inputRef}
        accessibilityHint={error ?? hint}
        accessibilityLabel={locked ? `${label}, locked` : label}
        accessibilityState={{ disabled: locked }}
        editable={!locked}
        keyboardAppearance="dark"
        keyboardType={keyboardType}
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onSubmitEditing={onSubmitEditing}
        placeholderTextColor={colors.muted}
        returnKeyType={returnKeyType}
        selectionColor={colors.accent}
        style={[
          styles.input,
          {
            borderColor,
            color: locked ? colors.secondary : colors.text,
            backgroundColor: locked ? colors.disabledSurface : colors.surface,
          },
          focused || error !== undefined ? styles.emphasisedBorder : null,
        ]}
        submitBehavior={onSubmitEditing === undefined ? 'blurAndSubmit' : 'submit'}
        value={value}
      />
      {error === undefined ? null : (
        <View style={styles.errorRow}>
          <Icon icon={CircleAlert} size="inline" color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {hint === undefined || error !== undefined ? null : <Text style={styles.hint}>{hint}</Text>}
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
  input: {
    ...typography.body,
    minHeight: sizes.inputMinHeight,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.field,
    paddingVertical: spacing.small,
  },
  emphasisedBorder: {
    borderWidth: 2,
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
  hint: {
    ...typography.caption,
    color: colors.secondary,
  },
});
