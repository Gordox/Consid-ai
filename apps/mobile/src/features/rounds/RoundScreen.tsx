import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Stepper } from '../../components/Stepper';
import { colors, radius, spacing, typography } from '../../components/tokens';
import type { ConfirmedRound, DraftRound, PhotoRole } from '../../domain/round/round';
import { buildConfirmedResult, evaluateDraft } from '../../domain/round/roundEvaluation';
import { ACTUAL_SHOTS_RANGE, HIT_DIAMETER_MM_RANGE } from '../../domain/round/roundRules';
import { DEMO_TARGET_NOTICE, findTarget } from '../../domain/target/targetDefinition';
import {
  confirmRound,
  type DraftCounts,
  discardDraftRound,
  getRound,
  removeDraftPhoto,
  setDraftPhoto,
  updateDraftCounts,
} from '../../persistence/roundRepository';
import { newId, nowUtcIso } from '../../services/deviceContext';
import type { PickOutcome } from '../../services/pickedPhoto';
import { choosePhoto, takePhoto } from '../../services/photoPicker';
import { copyPhotoIntoApp, deleteAppPhoto, photoExists } from '../../services/photoStorage';
import { formatPoints } from '../sessions/sessionProgressText';
import { useSessionStore } from '../startup/sessionStoreContext';
import { useFocusLoad } from '../useFocusLoad';
import { PhotoSlot } from './PhotoSlot';
import { savePickedPhoto } from './roundPhotos';
import { roundStatusText } from './roundText';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Round screen error:', error instanceof Error ? error.name : typeof error);
  }
}

type LoadedRound = {
  readonly round: DraftRound | ConfirmedRound;
  readonly missing: { readonly before: boolean; readonly after: boolean };
};

const PHOTO_TIPS =
  'Before the round, cover old holes with matching stickers and take the before photo. ' +
  'After the round, take the after photo from the same spot. Fill the frame with the whole ' +
  'target, hold the phone straight in front of it, and avoid glare and shadows.';

type PendingPick = { readonly role: PhotoRole; readonly source: 'camera' | 'library' };

function DraftRoundView({
  draft,
  missing,
  onChanged,
}: {
  draft: DraftRound;
  missing: LoadedRound['missing'];
  onChanged: () => void;
}) {
  const { db } = useSessionStore();
  const router = useRouter();
  const target = findTarget(draft.targetId);
  // This screen is the only place that edits the counts, so local state stays authoritative
  // while it is open; every change is written in order.
  const [counts, setCounts] = useState<DraftCounts>(() => ({
    actualShots: draft.actualShots,
    declaredMisses: draft.declaredMisses,
    unresolvedShots: draft.unresolvedShots,
    hitDiameterMm: draft.hitDiameterMm,
  }));
  const writes = useRef<Promise<void>>(Promise.resolve());
  const [message, setMessage] = useState<string | null>(null);
  const [permission, setPermission] = useState<{ canAskAgain: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<
    | { kind: 'confirm' }
    | { kind: 'discard' }
    | { kind: 'replaceAfter'; pick: PendingPick | null }
    | null
  >(null);

  const current: DraftRound = { ...draft, ...counts };
  const evaluation = evaluateDraft(current, target);
  const afterAnnotated = draft.calibration !== null || draft.marks.length > 0;

  function changeCounts(next: DraftCounts): void {
    setCounts(next);
    writes.current = writes.current
      .then(() => updateDraftCounts(db, draft.id, next))
      .catch((error: unknown) => {
        reportDevError(error);
        setMessage("Couldn't save the shot counts. Change a value to try again.");
      });
  }

  async function runPick({ role, source }: PendingPick): Promise<void> {
    setMessage(null);
    setPermission(null);
    const outcome: PickOutcome = source === 'camera' ? await takePhoto() : await choosePhoto();
    if (outcome.kind === 'cancelled') return;
    if (outcome.kind === 'permissionDenied') {
      setPermission({ canAskAgain: outcome.canAskAgain });
      return;
    }
    if (outcome.kind === 'failed') {
      setMessage("Couldn't use that photo. Try again or choose another one.");
      return;
    }
    setBusy(true);
    try {
      await savePickedPhoto(role, outcome.photo, {
        copyIntoApp: copyPhotoIntoApp,
        saveRow: (photo) => setDraftPhoto(db, draft.id, photo),
        deleteFile: deleteAppPhoto,
        newId,
        now: nowUtcIso,
        reportError: reportDevError,
      });
      onChanged();
    } catch (error) {
      reportDevError(error);
      setMessage("Couldn't save the photo. Nothing was changed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function requestPick(pick: PendingPick): void {
    if (pick.role === 'after' && afterAnnotated) {
      setDialog({ kind: 'replaceAfter', pick });
    } else {
      void runPick(pick);
    }
  }

  async function removePhoto(role: PhotoRole): Promise<void> {
    setBusy(true);
    try {
      const removed = await removeDraftPhoto(db, draft.id, role);
      if (removed !== null) {
        try {
          deleteAppPhoto(removed);
        } catch (error) {
          reportDevError(error);
        }
      }
      onChanged();
    } catch (error) {
      reportDevError(error);
      setMessage("Couldn't remove the photo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(): Promise<void> {
    setDialog(null);
    if (busy) return;
    setBusy(true);
    try {
      await writes.current;
      await confirmRound(db, draft.id, buildConfirmedResult(current, target), nowUtcIso());
      router.back();
    } catch (error) {
      reportDevError(error);
      setMessage("Couldn't confirm the round. Your marks are kept. Try again.");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function discard(): Promise<void> {
    setDialog(null);
    setBusy(true);
    try {
      await writes.current;
      const files = await discardDraftRound(db, draft.id);
      for (const file of files) {
        try {
          deleteAppPhoto(file);
        } catch (error) {
          reportDevError(error);
        }
      }
      router.back();
    } catch (error) {
      reportDevError(error);
      setMessage("Couldn't discard the round. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const resultText =
    evaluation.score === null
      ? null
      : formatPoints(evaluation.score.subtotal, evaluation.status === 'complete');

  return (
    <>
      {message === null ? null : <Banner body={message} tone="error" />}
      {permission === null ? null : (
        <Banner
          body={
            permission.canAskAgain
              ? 'Camera access was not allowed. Try again, or choose a photo from the library.'
              : 'Camera access is turned off for this app. Allow it in Settings, or choose a photo from the library.'
          }
          title="No camera access"
          tone="error"
        >
          {permission.canAskAgain ? null : (
            <Button
              label="Open settings"
              onPress={() => void Linking.openSettings()}
              variant="secondary"
            />
          )}
        </Banner>
      )}

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Shots
        </Text>
        <Stepper
          label="Shots fired"
          max={ACTUAL_SHOTS_RANGE.max}
          min={ACTUAL_SHOTS_RANGE.min}
          onChange={(value) => changeCounts({ ...counts, actualShots: value })}
          value={counts.actualShots}
        />
        <Stepper
          label="Declared misses"
          max={ACTUAL_SHOTS_RANGE.max}
          min={0}
          onChange={(value) => changeCounts({ ...counts, declaredMisses: value })}
          value={counts.declaredMisses}
        />
        <Stepper
          label="Unresolved shots"
          max={ACTUAL_SHOTS_RANGE.max}
          min={0}
          onChange={(value) => changeCounts({ ...counts, unresolvedShots: value })}
          value={counts.unresolvedShots}
        />
        <Text style={styles.supporting}>
          {
            "Declare a miss only when you know the shot missed. Use unresolved when you can't tell where a shot went; it is not counted as 0."
          }
        </Text>
        <Stepper
          label="Hole diameter"
          max={HIT_DIAMETER_MM_RANGE.max}
          min={HIT_DIAMETER_MM_RANGE.min}
          onChange={(value) => changeCounts({ ...counts, hitDiameterMm: value })}
          step={0.5}
          value={counts.hitDiameterMm}
          valueText={`${counts.hitDiameterMm.toFixed(1)} mm`}
        />
        <Text style={styles.supporting}>
          Assumed size of a bullet hole. Change it if your holes are clearly larger or smaller; a
          hole touching a ring line gets the higher score.
        </Text>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Photos
        </Text>
        <Text style={styles.supporting}>{PHOTO_TIPS}</Text>
        <PhotoSlot
          busy={busy}
          editable
          hint="Optional. Taken after covering old holes, before shooting."
          missing={missing.before}
          onChoose={() => requestPick({ role: 'before', source: 'library' })}
          onRemove={() => void removePhoto('before')}
          onTake={() => requestPick({ role: 'before', source: 'camera' })}
          photo={draft.photos.before}
          title="Before"
        />
        <PhotoSlot
          busy={busy}
          editable
          hint="Taken after the round. Hits are marked on this photo."
          missing={missing.after}
          onChoose={() => requestPick({ role: 'after', source: 'library' })}
          onRemove={() =>
            afterAnnotated
              ? setDialog({ kind: 'replaceAfter', pick: null })
              : void removePhoto('after')
          }
          onTake={() => requestPick({ role: 'after', source: 'camera' })}
          photo={draft.photos.after}
          title="After"
        />
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Hits
        </Text>
        <Text style={styles.body}>
          {draft.calibration === null ? 'Not calibrated' : 'Calibrated'} ·{' '}
          {evaluation.hitShots === 1
            ? '1 hit shot marked'
            : `${evaluation.hitShots} hit shots marked`}
          {draft.marks.some((mark) => mark.uncertain) ? ' · uncertain suggestions to check' : ''}
        </Text>
        <Button
          disabled={draft.photos.after === null || missing.after}
          label={draft.calibration === null ? 'Calibrate and mark hits' : 'Edit hits'}
          onPress={() => router.push(`/sessions/${draft.sessionId}/rounds/${draft.id}/editor`)}
        />
        {draft.photos.after === null ? (
          <Text style={styles.supporting}>Add an after photo to mark hits.</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Result
        </Text>
        <Text style={styles.body}>{roundStatusText(evaluation, counts.actualShots)}</Text>
        {resultText === null ? null : <Text style={styles.total}>{resultText}</Text>}
        {target?.isDemo === true ? <Text style={styles.notice}>{DEMO_TARGET_NOTICE}</Text> : null}
        <Button
          busy={busy}
          disabled={evaluation.blockReason !== null}
          label="Confirm round"
          onPress={() => setDialog({ kind: 'confirm' })}
        />
        <Button
          busy={busy}
          label="Discard round"
          onPress={() => setDialog({ kind: 'discard' })}
          variant="destructive"
        />
      </View>

      <ConfirmDialog
        body={
          evaluation.status === 'incomplete'
            ? 'Unresolved shots stay unknown and the round shows a subtotal. Confirmed rounds cannot be changed.'
            : 'Confirmed rounds cannot be changed.'
        }
        cancelLabel="Keep editing"
        confirmLabel="Confirm round"
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirm()}
        title={`Confirm round ${draft.sequence}?`}
        visible={dialog?.kind === 'confirm'}
      />
      <ConfirmDialog
        body="The round, its marks and its photo copies in this app are removed. Photos in your phone's library are not touched."
        cancelLabel="Keep round"
        confirmLabel="Discard round"
        onCancel={() => setDialog(null)}
        onConfirm={() => void discard()}
        title={`Discard round ${draft.sequence}?`}
        visible={dialog?.kind === 'discard'}
      />
      <ConfirmDialog
        body="The calibration and hit marks belong to the current after photo and will be cleared."
        cancelLabel="Keep photo"
        confirmLabel="Replace photo"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          const pending = dialog?.kind === 'replaceAfter' ? dialog.pick : null;
          setDialog(null);
          if (pending === null) {
            void removePhoto('after');
          } else {
            void runPick(pending);
          }
        }}
        title="Replace the after photo?"
        visible={dialog?.kind === 'replaceAfter'}
      />
    </>
  );
}

function ConfirmedRoundView({
  round,
  missing,
}: {
  round: ConfirmedRound;
  missing: LoadedRound['missing'];
}) {
  const { result } = round;
  const target = findTarget(result.targetId);
  const values = result.shots.flatMap((shot) =>
    Array.from({ length: shot.shots }, () => shot.value),
  );
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.total}>
          {formatPoints(result.subtotal, result.status === 'complete')}
        </Text>
        <Text style={styles.body}>
          {result.actualShots === 1 ? '1 shot fired' : `${result.actualShots} shots fired`} ·{' '}
          {values.length} hits · {result.declaredMisses} misses · {result.unresolvedShots}{' '}
          unresolved
        </Text>
        {values.length === 0 ? null : (
          <Text style={styles.body}>
            Hit scores: {[...values].sort((a, b) => b - a).join(', ')}
          </Text>
        )}
        <Text style={styles.supporting}>
          Hole diameter {result.hitDiameterMm.toFixed(1)} mm · {target?.label ?? result.targetId} ·
          rule {result.scoringRule}
        </Text>
        {target?.isDemo !== false ? <Text style={styles.notice}>{DEMO_TARGET_NOTICE}</Text> : null}
        <Text style={styles.supporting}>{"Confirmed results can't be changed."}</Text>
      </View>
      <PhotoSlot
        busy={false}
        editable={false}
        hint="No before photo."
        missing={missing.before}
        photo={round.photos.before}
        title="Before"
      />
      <PhotoSlot
        busy={false}
        editable={false}
        hint="No after photo."
        missing={missing.after}
        photo={round.photos.after}
        title="After"
      />
    </>
  );
}

export function RoundScreen({ sessionId, roundId }: { sessionId: string; roundId: string }) {
  const { db } = useSessionStore();
  const router = useRouter();

  const load = useCallback(async (): Promise<LoadedRound | null> => {
    const round = await getRound(db, roundId);
    if (round === null || round.sessionId !== sessionId) {
      return null;
    }
    const isMissing = (fileName: string | undefined) =>
      fileName !== undefined && !photoExists(fileName);
    return {
      round,
      missing: {
        before: isMissing(round.photos.before?.fileName),
        after: isMissing(round.photos.after?.fileName),
      },
    };
  }, [db, roundId, sessionId]);
  const { state, reload } = useFocusLoad(load);

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace(`/sessions/${sessionId}`);
  const loaded = state.status === 'loaded' ? state.data : null;
  const title = loaded === null ? 'Round' : `Round ${loaded.round.sequence}`;

  return (
    <Screen scroll>
      <View style={styles.stack}>
        <ScreenHeader onBack={goBack} title={title} />
        {state.status === 'loading' ? <Text style={styles.supporting}>Loading round…</Text> : null}
        {state.status === 'failed' ? (
          <>
            <Banner
              body="Your saved rounds haven't been changed. Try again."
              title="Couldn't open the round"
              tone="error"
            />
            <Button label="Try again" onPress={reload} />
          </>
        ) : null}
        {state.status === 'loaded' && loaded === null ? (
          <Banner body="This round doesn't exist in this session." tone="error" />
        ) : null}
        {loaded?.round.state === 'draft' ? (
          <DraftRoundView
            draft={loaded.round}
            key={loaded.round.id}
            missing={loaded.missing}
            onChanged={reload}
          />
        ) : null}
        {loaded?.round.state === 'confirmed' ? (
          <ConfirmedRoundView missing={loaded.missing} round={loaded.round} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.group,
  },
  card: {
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  section: {
    gap: spacing.small,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.text,
  },
  total: {
    ...typography.pageTitle,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  supporting: {
    ...typography.body,
    color: colors.secondary,
  },
  notice: {
    ...typography.supporting,
    color: colors.warning,
  },
});
