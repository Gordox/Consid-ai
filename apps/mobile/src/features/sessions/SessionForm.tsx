import CircleAlert from 'lucide-react-native/icons/circle-alert';
import Lock from 'lucide-react-native/icons/lock';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import { useRouter, usePreventRemove } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  type HostInstance,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  type TextInputInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { ChoiceRow } from '../../components/ChoiceRow';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { colors, spacing, typography } from '../../components/tokens';
import { FIREARM_TYPES } from '../../domain/session/firearmType';
import type { SessionField } from '../../domain/session/session';
import { saveSession } from '../../persistence/sessionRepository';
import { deviceTimeZone, newSessionId, nowUtcIso } from '../../services/deviceContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import { fieldErrorMessage } from './fieldErrorMessages';
import { FIREARM_TYPE_LABELS } from './firearmTypeLabels';
import { createSessionFormController, type SessionFormView } from './sessionFormController';
import { isEditable } from './sessionFormState';

// Visual order, used to focus the first invalid field after Create session.
const FIELD_ORDER: readonly SessionField[] = [
  'firearmName',
  'firearmType',
  'calibreLabel',
  'distanceMetres',
  'plannedShotsPerRound',
  'plannedRounds',
];

type TextFieldName = Exclude<SessionField, 'firearmType'>;

type PendingDialog = { kind: 'discard' | 'uncertain'; repeat: () => void };

// Status banners from docs/design/ui-ux.md §6–7 and the step 5 plan (T1–T3, P1, P2, Ö2).
function StatusBanner({ view }: { view: SessionFormView }) {
  const { form } = view;
  if (form.phase === 'saveFailed') {
    return (
      <Banner
        tone="error"
        title="Couldn't save session"
        body="Your details are kept and locked. Retry uses the same session details to avoid creating a duplicate."
      >
        <View style={styles.lockedRow}>
          <Icon icon={Lock} size="inline" color={colors.secondary} />
          <Text style={styles.lockedText}>Details locked</Text>
        </View>
      </Banner>
    );
  }
  if (form.phase === 'conflict') {
    return (
      <Banner
        tone="error"
        title="Session not saved"
        body="These details weren't saved because their ID is already used by another record. Nothing was overwritten."
      />
    );
  }
  if (form.phase === 'rejected') {
    return (
      <Banner
        tone="error"
        title="Session not saved"
        body="These details didn't pass the final check. This save attempt did not write anything."
      />
    );
  }
  if (view.slow) {
    return (
      <Banner
        tone="info"
        title="Still saving"
        body="This is taking longer than usual. The session may still be saved. You can keep waiting or go back."
      />
    );
  }
  if (form.phase === 'prepareFailed') {
    return (
      <Banner
        tone="error"
        title="Couldn't prepare session"
        body="We couldn't prepare this session for saving. No save was attempted. Your details are still here. Try again."
      />
    );
  }
  if (view.waitingForPreviousSave) {
    return (
      <Banner
        tone="info"
        body="A previous save is still in progress. You can save this session when it finishes. If it remains stuck, restart the app. Unsaved details in this form will be lost."
      />
    );
  }
  if (form.phase === 'editing' && Object.keys(form.visibleErrors).length > 0) {
    return (
      <Banner
        tone="error"
        title="Check your session settings"
        body="Correct the fields below, then create your session."
      />
    );
  }
  return null;
}

export function SessionForm() {
  const store = useSessionStore();
  const router = useRouter();
  // Set by the controller when its own save succeeds; an effect then leaves the screen.
  const [savedNavigationPending, setSavedNavigationPending] = useState(false);
  const [controller] = useState(() =>
    createSessionFormController({
      coordinator: store.coordinator,
      save: (session) => saveSession(store.db, session),
      prepare: { newId: newSessionId, now: nowUtcIso, timeZone: deviceTimeZone },
      onSaved: () => setSavedNavigationPending(true),
    }),
  );
  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  const { form } = view;
  const locked = !isEditable(form.phase);

  const [dialog, setDialog] = useState<PendingDialog | null>(null);
  // Set when Stay or Keep editing closes a dialog; focus returns to Back once it has closed.
  const restoreFocusToBack = useRef(false);
  const backRef = useRef<HostInstance>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const firstChoiceRef = useRef<HostInstance>(null);
  const fieldOffsets = useRef<Partial<Record<SessionField, number>>>({});
  const firearmNameRef = useRef<TextInputInstance>(null);
  const calibreLabelRef = useRef<TextInputInstance>(null);
  const distanceMetresRef = useRef<TextInputInstance>(null);
  const plannedShotsPerRoundRef = useRef<TextInputInstance>(null);
  const plannedRoundsRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    controller.resume();
    return () => controller.dispose();
  }, [controller]);

  // Prevents Back in the header, Android back and the iOS back gesture whenever leaving needs
  // a decision. A normal save in progress blocks without a dialog (U8).
  const disablePrevention = usePreventRemove(view.leaveBehaviour !== 'free', ({ repeat }) => {
    if (view.leaveBehaviour === 'confirmDiscard') {
      setDialog({ kind: 'discard', repeat });
    } else if (view.leaveBehaviour === 'confirmUncertain') {
      setDialog({ kind: 'uncertain', repeat });
    }
  });

  function goBack(): void {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  function leaveWithoutPrompt(): void {
    disablePrevention();
    goBack();
  }

  // The form is left for good after a successful save, so the flag is never reset.
  const leaveAfterSave = useEffectEvent(() => {
    leaveWithoutPrompt();
  });

  useEffect(() => {
    if (savedNavigationPending) {
      leaveAfterSave();
    }
  }, [savedNavigationPending]);

  useEffect(() => {
    if (form.phase === 'saving' && !view.slow) {
      AccessibilityInfo.announceForAccessibility('Creating session…');
    }
  }, [form.phase, view.slow]);

  useEffect(() => {
    if (dialog === null && restoreFocusToBack.current && backRef.current !== null) {
      restoreFocusToBack.current = false;
      AccessibilityInfo.sendAccessibilityEvent(backRef.current, 'focus');
    }
  }, [dialog]);

  function focusFirstInvalidField(): void {
    const { form: current } = controller.getView();
    if (current.phase !== 'editing') {
      return;
    }
    const field = FIELD_ORDER.find((name) => current.visibleErrors[name] !== undefined);
    if (field === undefined) {
      return;
    }
    scrollRef.current?.scrollTo({
      y: Math.max(0, (fieldOffsets.current[field] ?? 0) - spacing.field),
      animated: false,
    });
    if (field === 'firearmType') {
      if (firstChoiceRef.current !== null) {
        AccessibilityInfo.sendAccessibilityEvent(firstChoiceRef.current, 'focus');
      }
    } else {
      const inputs: Record<TextFieldName, TextInputInstance | null> = {
        firearmName: firearmNameRef.current,
        calibreLabel: calibreLabelRef.current,
        distanceMetres: distanceMetresRef.current,
        plannedShotsPerRound: plannedShotsPerRoundRef.current,
        plannedRounds: plannedRoundsRef.current,
      };
      inputs[field]?.focus();
    }
  }

  function createSession(): void {
    controller.submit();
    focusFirstInvalidField();
  }

  function recordOffset(event: LayoutChangeEvent, ...fields: SessionField[]): void {
    for (const field of fields) {
      fieldOffsets.current[field] = event.nativeEvent.layout.y;
    }
  }

  function errorFor(field: SessionField): string | undefined {
    const error = form.visibleErrors[field];
    return error === undefined ? undefined : fieldErrorMessage(field, error);
  }

  function textFieldProps(field: TextFieldName) {
    return {
      value: form.input[field],
      onChangeText: (value: string) => controller.changeField(field, value),
      error: errorFor(field),
      locked,
    };
  }

  const typeError = errorFor('firearmType');

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        // Padding on Android too: in Expo Go on a Galaxy S20 the window does not shrink for the
        // keyboard, so without it the lower fields cannot be reached.
        // See docs/bugs/keyboard-covers-lower-form-fields.md.
        behavior="padding"
        style={styles.fill}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          style={styles.fill}
        >
          <ScreenHeader backRef={backRef} onBack={goBack} title="New session" />
          <StatusBanner view={view} />

          <TextField
            {...textFieldProps('firearmName')}
            inputRef={firearmNameRef}
            label="Firearm name"
            onLayout={(event) => recordOffset(event, 'firearmName')}
            onSubmitEditing={() => calibreLabelRef.current?.focus()}
            returnKeyType="next"
          />

          <View
            accessibilityLabel="Firearm type"
            accessibilityRole="radiogroup"
            onLayout={(event) => recordOffset(event, 'firearmType')}
            style={styles.group}
          >
            <Text style={styles.groupLabel}>Firearm type</Text>
            {FIREARM_TYPES.map((type, index) => (
              <ChoiceRow
                key={type}
                label={FIREARM_TYPE_LABELS[type]}
                locked={locked}
                onSelect={() => controller.changeField('firearmType', type)}
                rowRef={index === 0 ? firstChoiceRef : undefined}
                selected={form.input.firearmType === type}
              />
            ))}
            {typeError === undefined ? null : (
              <View style={styles.errorRow}>
                <Icon icon={CircleAlert} size="inline" color={colors.error} />
                <Text style={styles.groupError}>{typeError}</Text>
              </View>
            )}
          </View>

          <TextField
            {...textFieldProps('calibreLabel')}
            inputRef={calibreLabelRef}
            label="Calibre"
            onLayout={(event) => recordOffset(event, 'calibreLabel')}
            onSubmitEditing={() => distanceMetresRef.current?.focus()}
            returnKeyType="next"
          />

          <TextField
            {...textFieldProps('distanceMetres')}
            inputRef={distanceMetresRef}
            keyboardType="decimal-pad"
            label="Distance (m)"
            onLayout={(event) => recordOffset(event, 'distanceMetres')}
          />

          <View
            onLayout={(event) => recordOffset(event, 'plannedShotsPerRound', 'plannedRounds')}
            style={styles.row}
          >
            <View style={styles.column}>
              <TextField
                {...textFieldProps('plannedShotsPerRound')}
                inputRef={plannedShotsPerRoundRef}
                keyboardType="number-pad"
                label="Shots per round"
              />
            </View>
            <View style={styles.column}>
              <TextField
                {...textFieldProps('plannedRounds')}
                inputRef={plannedRoundsRef}
                keyboardType="number-pad"
                label="Planned rounds (optional)"
              />
            </View>
          </View>

          <PrimaryAction
            onBackToSessions={leaveWithoutPrompt}
            onCreate={createSession}
            onRetry={controller.retry}
            view={view}
          />
          <Text style={styles.footer}>Saved on this device. No account needed.</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        body="This draft will be removed. Saved sessions won't change."
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        onCancel={() => {
          restoreFocusToBack.current = true;
          setDialog(null);
        }}
        onConfirm={() => {
          const pending = dialog;
          setDialog(null);
          disablePrevention();
          pending?.repeat();
        }}
        title="Discard unsaved changes?"
        visible={dialog?.kind === 'discard'}
      />
      <ConfirmDialog
        body="We couldn't confirm whether this session was saved. If it was saved, it will appear in Sessions. If it wasn't, leaving will discard these details."
        cancelLabel="Stay"
        confirmLabel="Leave"
        onCancel={() => {
          restoreFocusToBack.current = true;
          setDialog(null);
        }}
        onConfirm={() => {
          const pending = dialog;
          setDialog(null);
          disablePrevention();
          pending?.repeat();
        }}
        title="Leave this screen?"
        visible={dialog?.kind === 'uncertain'}
      />
    </SafeAreaView>
  );
}

type PrimaryActionProps = {
  view: SessionFormView;
  onCreate: () => void;
  onRetry: () => void;
  onBackToSessions: () => void;
};

function PrimaryAction({ view, onCreate, onRetry, onBackToSessions }: PrimaryActionProps) {
  switch (view.form.phase) {
    case 'saving':
      return <Button busy icon={RefreshCw} label="Creating session…" onPress={onCreate} />;
    case 'saveFailed':
      return <Button label="Try saving again" onPress={onRetry} />;
    case 'rejected':
    case 'conflict':
      return <Button label="Back to sessions" onPress={onBackToSessions} />;
    case 'saved':
      return <Button disabled label="Create session" onPress={onCreate} />;
    case 'editing':
    case 'prepareFailed':
      return <Button disabled={!view.canSubmit} label="Create session" onPress={onCreate} />;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.field,
    padding: spacing.inset,
  },
  group: {
    gap: spacing.label,
  },
  groupLabel: {
    ...typography.label,
    color: colors.text,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.fine,
  },
  groupError: {
    ...typography.supporting,
    color: colors.error,
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  column: {
    flex: 1,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.fine,
  },
  lockedText: {
    ...typography.supporting,
    color: colors.secondary,
  },
  footer: {
    ...typography.supporting,
    color: colors.secondary,
  },
});
