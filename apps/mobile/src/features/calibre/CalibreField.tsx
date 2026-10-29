import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Search from 'lucide-react-native/icons/search';
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
  TextInput,
  type TextInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { ChoiceRow } from '../../components/ChoiceRow';
import { Icon } from '../../components/Icon';
import { StatusBadge } from '../../components/StatusBadge';
import { FieldLabel, FieldMessage } from '../../components/TextField';
import { colors, radius, sizes, spacing, typography } from '../../components/tokens';
import { useReducedMotion } from '../../components/useReducedMotion';
import { isNamedCalibre, searchCalibres } from '../../domain/calibre/calibres';
import { parseLabel } from '../../domain/session/parseText';
import { CALIBRE_LABEL_MAX_CODE_POINTS } from '../../domain/session/sessionLimits';

type CalibreFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  locked: boolean;
  triggerRef?: Ref<HostInstance>;
  onLayout?: (event: LayoutChangeEvent) => void;
};

// Calibre as a searchable list of named calibres plus Custom (components/07-select-sheet.png).
// The value stays plain text: a saved value that is not in the list is shown as it is, marked
// Custom, and never converted. The choice is committed only by Done.
export function CalibreField({
  value,
  onChange,
  error,
  locked,
  triggerRef,
  onLayout,
}: CalibreFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(value);
  const [custom, setCustom] = useState('');
  const titleRef = useRef<TextInstance>(null);
  const reducedMotion = useReducedMotion();
  const trimmed = value.trim();
  const isCustom = trimmed !== '' && !isNamedCalibre(trimmed);
  const results = searchCalibres(query);
  const customCheck =
    custom.trim() === '' ? null : parseLabel(custom, CALIBRE_LABEL_MAX_CODE_POINTS);
  const customError =
    customCheck !== null && !customCheck.ok && customCheck.error === 'tooLong'
      ? `Use ${CALIBRE_LABEL_MAX_CODE_POINTS} characters or fewer.`
      : undefined;
  const draftIsCustom = draft.trim() !== '' && !isNamedCalibre(draft);

  function show(): void {
    setQuery('');
    setDraft(value);
    setCustom(isCustom ? value : '');
    setOpen(true);
  }

  function done(): void {
    setOpen(false);
    if (draft !== value) onChange(draft);
  }

  return (
    <View onLayout={onLayout} style={styles.field}>
      <FieldLabel label="Calibre" locked={locked} />
      <Pressable
        ref={triggerRef}
        accessibilityHint={error}
        accessibilityLabel={`Calibre, ${trimmed === '' ? 'not chosen' : `${trimmed}${isCustom ? ', custom' : ''}`}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked, expanded: open }}
        disabled={locked}
        onPress={show}
        style={[
          styles.trigger,
          {
            borderColor: locked
              ? colors.border
              : error !== undefined
                ? colors.error
                : colors.inputBorder,
          },
          error !== undefined ? styles.emphasised : null,
          locked ? styles.locked : null,
        ]}
      >
        <Text style={[styles.value, trimmed === '' ? styles.placeholder : null]}>
          {trimmed === '' ? 'Choose a calibre' : trimmed}
        </Text>
        {isCustom ? <StatusBadge label="Custom" tone="neutral" /> : null}
        <Icon icon={ChevronDown} size="action" color={locked ? colors.muted : colors.text} />
      </Pressable>
      <FieldMessage
        error={error}
        hint="A label only: it does not set the hole diameter or change scoring."
      />

      <Modal
        animationType={reducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setOpen(false)}
        onShow={() => {
          if (titleRef.current !== null)
            AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
        }}
        statusBarTranslucent
        transparent
        visible={open}
      >
        <View style={styles.scrim}>
          <SafeAreaView accessibilityViewIsModal edges={['top', 'bottom']} style={styles.sheet}>
            <Text ref={titleRef} accessibilityRole="header" style={styles.sheetTitle}>
              Calibre
            </Text>
            <View style={styles.search}>
              <Icon icon={Search} size="action" color={colors.muted} />
              <TextInput
                accessibilityLabel="Search calibres"
                autoCorrect={false}
                keyboardAppearance="dark"
                onChangeText={setQuery}
                placeholder="Search, e.g. 9x19 or 22 LR"
                placeholderTextColor={colors.muted}
                selectionColor={colors.accent}
                style={styles.searchInput}
                value={query}
              />
            </View>
            <ScrollView
              accessibilityLabel="Calibres"
              accessibilityRole="radiogroup"
              contentContainerStyle={styles.options}
              keyboardShouldPersistTaps="handled"
            >
              {results.map((calibre) => (
                <View key={calibre.name} style={styles.option}>
                  <ChoiceRow
                    label={calibre.name}
                    locked={false}
                    onSelect={() => setDraft(calibre.name)}
                    selected={draft === calibre.name}
                  />
                  {calibre.aliases.length === 0 ? null : (
                    <Text style={styles.aliases}>Also known as {calibre.aliases.join(', ')}</Text>
                  )}
                </View>
              ))}
              {results.length === 0 ? (
                <Text style={styles.secondary}>No listed calibre matches. Use Custom below.</Text>
              ) : null}
              <View style={styles.customBox}>
                <Text style={styles.customTitle}>Custom</Text>
                <Text style={styles.secondary}>
                  For a calibre that is not listed. It is saved exactly as you write it.
                </Text>
                <TextInput
                  accessibilityLabel="Custom calibre"
                  keyboardAppearance="dark"
                  onChangeText={(text) => {
                    setCustom(text);
                    setDraft(text);
                  }}
                  onFocus={() => setDraft(custom)}
                  placeholder="Enter a calibre"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.accent}
                  style={[
                    styles.customInput,
                    draftIsCustom ? styles.customSelected : null,
                    customError !== undefined ? styles.customError : null,
                  ]}
                  value={custom}
                />
                <FieldMessage error={customError} />
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button label="Cancel" onPress={() => setOpen(false)} variant="secondary" />
              </View>
              <View style={styles.action}>
                <Button
                  disabled={draft.trim() === '' || (draftIsCustom && customError !== undefined)}
                  label="Done"
                  onPress={done}
                />
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
  emphasised: {
    borderWidth: 2,
  },
  locked: {
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
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    maxHeight: '92%',
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
  search: {
    minHeight: sizes.inputMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.label,
    paddingHorizontal: spacing.field,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    color: colors.text,
  },
  options: {
    gap: spacing.label,
  },
  option: {
    gap: spacing.fine,
  },
  aliases: {
    ...typography.caption,
    color: colors.muted,
    paddingHorizontal: spacing.field,
  },
  secondary: {
    ...typography.body,
    color: colors.secondary,
  },
  customBox: {
    gap: spacing.label,
    paddingTop: spacing.small,
  },
  customTitle: {
    ...typography.label,
    color: colors.text,
  },
  customInput: {
    ...typography.body,
    minHeight: sizes.inputMinHeight,
    paddingHorizontal: spacing.field,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  customSelected: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  customError: {
    borderWidth: 2,
    borderColor: colors.error,
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
