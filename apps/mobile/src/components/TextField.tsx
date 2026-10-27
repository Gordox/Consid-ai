import CircleAlert from 'lucide-react-native/icons/circle-alert';
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
  // Locked fields keep their values but cannot be edited (save in progress or finished).
  locked: boolean;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  inputRef?: Ref<TextInputInstance>;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function TextField({
  label,
  value,
  onChangeText,
  error,
  locked,
  keyboardType = 'default',
  returnKeyType,
  onSubmitEditing,
  inputRef,
  onLayout,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = locked
    ? colors.disabled
    : error !== undefined
      ? colors.error
      : focused
        ? colors.focus
        : colors.inputBorder;

  return (
    <View onLayout={onLayout} style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        accessibilityHint={error}
        accessibilityState={{ disabled: locked }}
        editable={!locked}
        keyboardAppearance="dark"
        keyboardType={keyboardType}
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onSubmitEditing={onSubmitEditing}
        placeholderTextColor={colors.disabled}
        returnKeyType={returnKeyType}
        selectionColor={colors.accent}
        style={[
          styles.input,
          { borderColor, color: locked ? colors.secondary : colors.text },
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
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.label,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  input: {
    ...typography.body,
    minHeight: sizes.minTouchTarget,
    borderRadius: radius.control,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.small,
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
    ...typography.supporting,
    color: colors.error,
    flexShrink: 1,
  },
});
