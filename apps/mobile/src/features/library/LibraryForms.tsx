import Archive from 'lucide-react-native/icons/archive';
import ArchiveRestore from 'lucide-react-native/icons/archive-restore';
import { usePreventRemove, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SelectSheet } from '../../components/SelectSheet';
import { FieldPair, TextField } from '../../components/TextField';
import { colors, spacing, typography } from '../../components/tokens';
import {
  type ProfileInput,
  TEMPLATE_NAME_MAX_CODE_POINTS,
  type TemplateInput,
  validateProfileInput,
  validateTemplateInput,
} from '../../domain/library/library';
import { FIREARM_TYPES } from '../../domain/session/firearmType';
import {
  createProfile,
  createTemplate,
  type LibraryKind,
  setArchived,
  updateProfile,
  updateTemplate,
} from '../../persistence/libraryRepository';
import { newId, nowUtcIso } from '../../services/deviceContext';
import { CalibreField } from '../calibre/CalibreField';
import { createActionGuard } from '../rounds/nextRound';
import { fieldErrorMessage } from '../sessions/fieldErrorMessages';
import { FIREARM_TYPE_LABELS } from '../sessions/firearmTypeLabels';
import { useSessionStore } from '../startup/sessionStoreContext';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Library error:', error instanceof Error ? error.name : typeof error);
  }
}

const TYPE_OPTIONS = FIREARM_TYPES.map((type) => ({
  value: type,
  label: FIREARM_TYPE_LABELS[type],
}));

// Shared frame: header, keyboard avoidance, save and archive buttons, and the discard dialog
// for unsaved edits (header Back, Android Back and the iOS swipe alike).
function FormFrame({
  kind,
  title,
  dirty,
  saving,
  saveFailed,
  archived,
  onSave,
  onArchive,
  allowLeaveRef,
  children,
}: {
  kind: LibraryKind;
  title: string;
  dirty: boolean;
  saving: boolean;
  saveFailed: boolean;
  // null for a new item, which cannot be archived yet.
  archived: boolean | null;
  onSave: () => void;
  onArchive: () => void;
  allowLeaveRef: { current: () => void };
  children: ReactNode;
}) {
  const router = useRouter();
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  const allowLeave = usePreventRemove(dirty, ({ repeat }) => setDiscard(() => repeat));
  useEffect(() => {
    allowLeaveRef.current = allowLeave;
  }, [allowLeave, allowLeaveRef]);
  const noun = kind === 'profile' ? 'profile' : 'template';
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          style={styles.fill}
        >
          <ScreenHeader
            onBack={() => (router.canGoBack() ? router.back() : router.replace('/library'))}
            subtitle="Changes here never alter saved sessions."
            title={title}
          />
          {saveFailed ? (
            <Banner
              body="Nothing was saved. Your entries are still here. Try again."
              title={`Couldn't save the ${noun}`}
              tone="error"
            />
          ) : null}
          {children}
          <Button busy={saving} label={saving ? 'Saving…' : `Save ${noun}`} onPress={onSave} />
          {archived === null ? null : (
            <>
              <Button
                disabled={saving}
                icon={archived ? ArchiveRestore : Archive}
                label={archived ? `Restore ${noun}` : `Archive ${noun}`}
                onPress={onArchive}
                variant="secondary"
              />
              <Text style={styles.caption}>
                {archived
                  ? 'Archived: not offered for new sessions. Restoring makes it available again.'
                  : 'Archiving hides it from new sessions without deleting it. You can restore it later.'}
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog
        body={`Your changes to this ${noun} will be lost. Saved sessions won't change.`}
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        onCancel={() => setDiscard(null)}
        onConfirm={() => {
          const repeat = discard;
          setDiscard(null);
          allowLeave();
          repeat?.();
        }}
        title="Discard unsaved changes?"
        visible={discard !== null}
      />
    </SafeAreaView>
  );
}

function useSaveFlow() {
  const router = useRouter();
  const guard = useRef(createActionGuard());
  const allowLeaveRef = useRef<() => void>(() => undefined);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // One write per tap; on success the form is left for good, so the guard stays closed.
  async function run(write: () => Promise<void>): Promise<void> {
    if (!guard.current.tryEnter()) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await write();
      allowLeaveRef.current();
      router.back();
    } catch (error) {
      reportDevError(error);
      setSaveFailed(true);
      guard.current.release();
    } finally {
      setSaving(false);
    }
  }
  return { run, saving, saveFailed, allowLeaveRef };
}

export function ProfileForm({
  profileId,
  initial,
  archived,
}: {
  profileId: string | null;
  initial: ProfileInput;
  archived: boolean | null;
}) {
  const { db } = useSessionStore();
  const [input, setInput] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const flow = useSaveFlow();
  const validation = validateProfileInput(input);
  const errors = submitted && !validation.ok ? validation.error : {};
  const dirty =
    input.firearmName !== initial.firearmName ||
    input.firearmType !== initial.firearmType ||
    input.calibreLabel !== initial.calibreLabel;

  const save = () => {
    setSubmitted(true);
    if (!validation.ok) return;
    const values = validation.value;
    void flow.run(() =>
      profileId === null
        ? createProfile(db, { id: newId(), nowUtc: nowUtcIso(), values })
        : updateProfile(db, profileId, values, nowUtcIso()),
    );
  };

  return (
    <FormFrame
      allowLeaveRef={flow.allowLeaveRef}
      archived={archived}
      dirty={dirty}
      kind="profile"
      onArchive={() =>
        profileId !== null &&
        void flow.run(() => setArchived(db, 'profile', profileId, archived !== true, nowUtcIso()))
      }
      onSave={save}
      saveFailed={flow.saveFailed}
      saving={flow.saving}
      title={profileId === null ? 'New firearm profile' : 'Edit firearm profile'}
    >
      <TextField
        error={errors.firearmName && fieldErrorMessage('firearmName', errors.firearmName)}
        label="Firearm name"
        locked={flow.saving}
        onChangeText={(value) => setInput({ ...input, firearmName: value })}
        placeholder="Enter firearm name"
        value={input.firearmName}
      />
      <SelectSheet
        error={errors.firearmType && fieldErrorMessage('firearmType', errors.firearmType)}
        label="Firearm type"
        locked={flow.saving}
        onChange={(type) => setInput({ ...input, firearmType: type })}
        options={TYPE_OPTIONS}
        placeholder="Choose a firearm type"
        value={FIREARM_TYPES.find((type) => type === input.firearmType) ?? null}
      />
      <CalibreField
        error={errors.calibreLabel && fieldErrorMessage('calibreLabel', errors.calibreLabel)}
        locked={flow.saving}
        onChange={(value) => setInput({ ...input, calibreLabel: value })}
        value={input.calibreLabel}
      />
    </FormFrame>
  );
}

export function TemplateForm({
  templateId,
  initial,
  archived,
}: {
  templateId: string | null;
  initial: TemplateInput;
  archived: boolean | null;
}) {
  const { db } = useSessionStore();
  const [input, setInput] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const flow = useSaveFlow();
  const validation = validateTemplateInput(input);
  const errors = submitted && !validation.ok ? validation.error : {};
  const dirty =
    input.name !== initial.name ||
    input.distanceMetres !== initial.distanceMetres ||
    input.plannedShotsPerRound !== initial.plannedShotsPerRound ||
    input.plannedRounds !== initial.plannedRounds;

  const save = () => {
    setSubmitted(true);
    if (!validation.ok) return;
    const values = validation.value;
    void flow.run(() =>
      templateId === null
        ? createTemplate(db, { id: newId(), nowUtc: nowUtcIso(), values })
        : updateTemplate(db, templateId, values, nowUtcIso()),
    );
  };

  return (
    <FormFrame
      allowLeaveRef={flow.allowLeaveRef}
      archived={archived}
      dirty={dirty}
      kind="template"
      onArchive={() =>
        templateId !== null &&
        void flow.run(() => setArchived(db, 'template', templateId, archived !== true, nowUtcIso()))
      }
      onSave={save}
      saveFailed={flow.saveFailed}
      saving={flow.saving}
      title={templateId === null ? 'New training template' : 'Edit training template'}
    >
      <TextField
        error={
          errors.name === undefined
            ? undefined
            : errors.name === 'tooLong'
              ? `Use ${TEMPLATE_NAME_MAX_CODE_POINTS} characters or fewer.`
              : 'Enter a name.'
        }
        hint="For example Standard training."
        label="Template name"
        locked={flow.saving}
        onChangeText={(value) => setInput({ ...input, name: value })}
        value={input.name}
      />
      <TextField
        error={errors.distanceMetres && fieldErrorMessage('distanceMetres', errors.distanceMetres)}
        keyboardType="decimal-pad"
        label="Distance (m)"
        locked={flow.saving}
        onChangeText={(value) => setInput({ ...input, distanceMetres: value })}
        value={input.distanceMetres}
      />
      <FieldPair
        first={{
          error:
            errors.plannedShotsPerRound &&
            fieldErrorMessage('plannedShotsPerRound', errors.plannedShotsPerRound),
          keyboardType: 'number-pad',
          label: 'Shots per round',
          locked: flow.saving,
          onChangeText: (value) => setInput({ ...input, plannedShotsPerRound: value }),
          value: input.plannedShotsPerRound,
        }}
        second={{
          error: errors.plannedRounds && fieldErrorMessage('plannedRounds', errors.plannedRounds),
          hint: input.plannedRounds.trim() === '' ? 'Not planned' : undefined,
          keyboardType: 'number-pad',
          label: 'Planned rounds',
          locked: flow.saving,
          onChangeText: (value) => setInput({ ...input, plannedRounds: value }),
          optional: true,
          value: input.plannedRounds,
        }}
      />
    </FormFrame>
  );
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
    gap: spacing.field,
    padding: spacing.inset,
  },
  caption: {
    ...typography.caption,
    color: colors.secondary,
  },
});

export const EMPTY_PROFILE: ProfileInput = { firearmName: '', firearmType: null, calibreLabel: '' };
export const EMPTY_TEMPLATE: TemplateInput = {
  name: '',
  distanceMetres: '',
  plannedShotsPerRound: '',
  plannedRounds: '',
};
