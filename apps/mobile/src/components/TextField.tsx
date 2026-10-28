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
  useWindowDimensions,
  View,
} from 'react-native';

import { Icon } from './Icon';
import { colors, radius, sizes, spacing, typography } from './tokens';

export type TextFieldProps = {
  label: string;
  // Shown as a muted "Optional" after the label, the same way in every form.
  optional?: boolean;
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
  placeholder?: string;
};

export function FieldLabel({
  label,
  optional = false,
  locked,
}: {
  label: string;
  optional?: boolean;
  locked: boolean;
}) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> · Optional</Text> : null}
      </Text>
      {locked ? <Icon icon={Lock} size="inline" color={colors.muted} /> : null}
    </View>
  );
}

function FieldInput(props: TextFieldProps) {
  const {
    label,
    optional = false,
    value,
    onChangeText,
    error,
    hint,
    locked,
    keyboardType = 'default',
    returnKeyType,
    onSubmitEditing,
    inputRef,
    placeholder,
  } = props;
  const [focused, setFocused] = useState(false);
  const borderColor = locked
    ? colors.border
    : error !== undefined
      ? colors.error
      : focused
        ? colors.focus
        : colors.inputBorder;
  const name = `${label}${optional ? ', optional' : ''}`;
  return (
    <TextInput
      ref={inputRef}
      accessibilityHint={error ?? hint}
      accessibilityLabel={locked ? `${name}, locked` : name}
      accessibilityState={{ disabled: locked }}
      editable={!locked}
      keyboardAppearance="dark"
      keyboardType={keyboardType}
      onBlur={() => setFocused(false)}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onSubmitEditing={onSubmitEditing}
      placeholder={placeholder}
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
  );
}

export function FieldMessage({ error, hint }: { error?: string; hint?: string }) {
  if (error !== undefined) {
    return (
      <View style={styles.errorRow}>
        <Icon icon={CircleAlert} size="inline" color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  return hint === undefined ? null : <Text style={styles.hint}>{hint}</Text>;
}

// Persistent label above the input; empty, filled, focus, invalid and locked states
// (components/05-text-fields.png). The error follows the input in reading order.
export function TextField(props: TextFieldProps) {
  return (
    <View onLayout={props.onLayout} style={styles.field}>
      <FieldLabel label={props.label} locked={props.locked} optional={props.optional} />
      <FieldInput {...props} />
      <FieldMessage error={props.error} hint={props.hint} />
    </View>
  );
}

// Below this width, or above this text scale, two fields do not fit side by side.
const PAIR_MIN_WIDTH = 340;
const PAIR_MAX_FONT_SCALE = 1.3;

// Two short fields side by side. Labels, inputs and messages each get their own row, so the
// inputs line up even when one label wraps to two lines; at large text or on narrow screens the
// fields are stacked instead. Nothing is clipped.
export function FieldPair({
  first,
  second,
  onLayout,
}: {
  first: TextFieldProps;
  second: TextFieldProps;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  if (width < PAIR_MIN_WIDTH || fontScale > PAIR_MAX_FONT_SCALE) {
    return (
      <View onLayout={onLayout} style={styles.stacked}>
        <TextField {...first} />
        <TextField {...second} />
      </View>
    );
  }
  return (
    <View onLayout={onLayout} style={styles.field}>
      <View style={styles.pairRow}>
        <View style={styles.pairCell}>
          <FieldLabel label={first.label} locked={first.locked} optional={first.optional} />
        </View>
        <View style={styles.pairCell}>
          <FieldLabel label={second.label} locked={second.locked} optional={second.optional} />
        </View>
      </View>
      <View style={styles.pairRow}>
        <View style={styles.pairCell}>
          <FieldInput {...first} />
        </View>
        <View style={styles.pairCell}>
          <FieldInput {...second} />
        </View>
      </View>
      {first.error === undefined &&
      second.error === undefined &&
      first.hint === undefined &&
      second.hint === undefined ? null : (
        <View style={styles.pairRow}>
          <View style={styles.messageCell}>
            <FieldMessage error={first.error} hint={first.hint} />
          </View>
          <View style={styles.messageCell}>
            <FieldMessage error={second.error} hint={second.hint} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.label,
  },
  stacked: {
    gap: spacing.field,
  },
  pairRow: {
    flexDirection: 'row',
    // Each row is as tall as its taller cell, so the next row starts level in both columns.
    alignItems: 'stretch',
    gap: spacing.small,
  },
  pairCell: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  messageCell: {
    flex: 1,
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
  optional: {
    ...typography.label,
    fontWeight: '400',
    color: colors.muted,
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
