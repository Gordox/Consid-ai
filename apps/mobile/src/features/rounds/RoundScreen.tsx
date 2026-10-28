import Camera from 'lucide-react-native/icons/camera';
import ScanSearch from 'lucide-react-native/icons/scan-search';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScoreSummary } from '../../components/ScoreSummary';
import { colors, radius, spacing, typography } from '../../components/tokens';
import type { ConfirmedRound, DraftRound, PhotoRole, RoundPhoto } from '../../domain/round/round';
import { findTarget } from '../../domain/target/targetDefinition';
import { clearPendingPick, recordPendingPick } from '../../persistence/pendingPhotoPick';
import { getRound, removeDraftPhoto } from '../../persistence/roundRepository';
import { getSession } from '../../persistence/sessionRepository';
import { nowUtcIso } from '../../services/deviceContext';
import { choosePhoto, takePhoto } from '../../services/photoPicker';
import type { PickOutcome } from '../../services/pickedPhoto';
import { AnalysisPanel } from '../analysis/AnalysisPanel';
import { usePhotoStore } from '../startup/photoStoreContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import { useFocusLoad } from '../useFocusLoad';
import { discardPhotos, photoSaveDeps } from './photoActions';
import { PhotoSlot } from './PhotoSlot';
import { ActualShots, HoleDiameterCard } from './RoundCounts';
import { RoundProgress } from './RoundProgress';
import { savePickedPhoto } from './roundPhotos';
import { createActionGuard } from './nextRound';
import { initialRoundStep, type RoundStep } from './roundSteps';
import { useDraftCounts } from './useDraftCounts';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Round screen error:', error instanceof Error ? error.name : typeof error);
  }
}

type LoadedRound = {
  readonly round: DraftRound | ConfirmedRound;
  readonly firearmName: string;
  // The session's calibre label, shown next to the diameter assumption. Never parsed.
  readonly calibreLabel: string;
  readonly missing: { readonly before: boolean; readonly after: boolean };
};

const PHOTO_TIPS =
  'For reused targets, add a before photo after covering the previous holes. Take the after ' +
  'photo from the same spot, with the whole target in the frame, straight on, without glare.';

const DIAMETER_SOURCE_TEXT = {
  assumed: 'assumed',
  userSet: 'set by you',
  unrecorded: 'source not recorded',
} as const;

type PendingPick = { readonly role: PhotoRole; readonly source: 'camera' | 'library' };

function Thumbnail({
  title,
  photo,
  missing,
  onPress,
}: {
  title: string;
  photo: RoundPhoto | null;
  missing: boolean;
  onPress?: () => void;
}) {
  const photos = usePhotoStore();
  return (
    <View style={styles.thumb}>
      <Text style={styles.secondary}>{title}</Text>
      {photo === null || missing ? (
        <Text style={styles.muted}>{photo === null ? 'None' : 'Unavailable'}</Text>
      ) : (
        <Pressable
          accessibilityHint={onPress === undefined ? undefined : 'Opens the photo full screen'}
          accessibilityLabel={`${title} photo`}
          accessibilityRole={onPress === undefined ? 'image' : 'button'}
          disabled={onPress === undefined}
          onPress={onPress}
        >
          <Image
            resizeMode="contain"
            source={{ uri: photos.uri(photo.fileName) }}
            style={[styles.thumbImage, { aspectRatio: photo.width / photo.height }]}
          />
        </Pressable>
      )}
    </View>
  );
}

function DraftRoundView({
  draft,
  calibreLabel,
  missing,
  onChanged,
  onInspect,
}: {
  draft: DraftRound;
  calibreLabel: string;
  missing: LoadedRound['missing'];
  onChanged: () => void;
  onInspect: (showHits: boolean) => void;
}) {
  const { db } = useSessionStore();
  const photos = usePhotoStore();
  const router = useRouter();
  const target = findTarget(draft.targetId);
  const { counts, change, saveFailed } = useDraftCounts(db, draft, reportDevError);
  const [step, setStep] = useState<RoundStep>(() => initialRoundStep(draft));
  const [message, setMessage] = useState<string | null>(null);
  const [permission, setPermission] = useState<{ role: PhotoRole; canAskAgain: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  // While analysis runs, photos and marks stay as the request saw them.
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const locked = busy || analysisRunning;
  const [replaceAfter, setReplaceAfter] = useState<{ pick: PendingPick | null } | null>(null);
  const afterAnnotated = draft.calibration !== null || draft.marks.length > 0;
  const roundPath = `/sessions/${draft.sessionId}/rounds/${draft.id}`;

  // Returning from the editor with a new alignment moves on to analysis; nothing else advances
  // a step on its own.
  const wasCalibrated = useRef(draft.calibration !== null);
  useEffect(() => {
    const calibrated = draft.calibration !== null;
    if (calibrated && !wasCalibrated.current) {
      setStep((current) => (current === 'photos' ? 'analyse' : current));
    }
    wasCalibrated.current = calibrated;
  }, [draft.calibration]);

  async function runPick({ role, source }: PendingPick): Promise<void> {
    setMessage(null);
    setPermission(null);
    try {
      // If Android ends the app while the picker is open, the next start finds the photo
      // through this record (PhotoRecovery).
      await recordPendingPick(db, { roundId: draft.id, role, startedAtUtc: nowUtcIso() });
    } catch (error) {
      reportDevError(error);
      setMessage("Couldn't prepare the photo. Nothing was changed. Try again.");
      return;
    }
    const outcome: PickOutcome = source === 'camera' ? await takePhoto() : await choosePhoto();
    if (outcome.kind !== 'picked') {
      // Cancelling keeps the current photo.
      await clearPendingPick(db).catch(reportDevError);
      if (outcome.kind === 'permissionDenied') {
        setPermission({ role, canAskAgain: outcome.canAskAgain });
      } else if (outcome.kind === 'failed') {
        setMessage("Couldn't use that photo. Try again or choose another one.");
      }
      return;
    }
    setBusy(true);
    try {
      await savePickedPhoto(
        role,
        outcome.photo,
        photoSaveDeps(db, photos, draft.id, reportDevError),
      );
      onChanged();
    } catch (error) {
      reportDevError(error);
      setMessage("Couldn't save the photo. Nothing was changed. Try again.");
    } finally {
      await clearPendingPick(db).catch(reportDevError);
      setBusy(false);
    }
  }

  function requestPick(pick: PendingPick): void {
    if (pick.role === 'after' && afterAnnotated) {
      setReplaceAfter({ pick });
    } else {
      void runPick(pick);
    }
  }

  async function removePhoto(role: PhotoRole): Promise<void> {
    setBusy(true);
    try {
      const removed = await removeDraftPhoto(db, draft.id, role);
      await discardPhotos(db, photos, removed, reportDevError);
      onChanged();
    } catch (error) {
      reportDevError(error);
      setMessage("Couldn't remove the photo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const afterUsable = draft.photos.after !== null && !missing.after;
  const openEditor = () => router.push(`${roundPath}/editor`);

  const banners = (
    <>
      {saveFailed ? (
        <Banner
          body="Couldn't save the shot counts or diameter. Change a value to try again."
          tone="error"
        />
      ) : null}
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
          <Button
            label="Use library instead"
            onPress={() => requestPick({ role: permission.role, source: 'library' })}
            variant="secondary"
          />
        </Banner>
      )}
    </>
  );

  return (
    <>
      {step === 'setup' ? (
        <>
          {banners}
          <ActualShots counts={counts} disabled={locked} onChange={change} />
          <HoleDiameterCard
            calibreLabel={calibreLabel}
            counts={counts}
            disabled={locked}
            onChange={change}
          />
          {target?.isDemo !== false ? (
            <Banner
              body="Geometry is not yet verified. Scores will be labelled as demo."
              title="Demo target"
              tone="warning"
            />
          ) : null}
          <Button icon={Camera} label="Add photos" onPress={() => setStep('photos')} />
        </>
      ) : null}

      {step === 'photos' ? (
        <>
          <Text style={styles.secondary}>Add photos of the same target.</Text>
          <RoundProgress current="photos" draft={draft} />
          {banners}
          <PhotoSlot
            busy={locked}
            editable
            hint="Recommended for reused targets: taken after covering old holes, before shooting."
            missing={missing.before}
            onChoose={() => requestPick({ role: 'before', source: 'library' })}
            onRemove={() => void removePhoto('before')}
            onTake={() => requestPick({ role: 'before', source: 'camera' })}
            photo={draft.photos.before}
            required={false}
            title="Before"
          />
          <PhotoSlot
            busy={locked}
            editable
            hint="Taken after the round. Hits are marked on this photo."
            missing={missing.after}
            onChoose={() => requestPick({ role: 'after', source: 'library' })}
            onRemove={() =>
              afterAnnotated ? setReplaceAfter({ pick: null }) : void removePhoto('after')
            }
            onTake={() => requestPick({ role: 'after', source: 'camera' })}
            photo={draft.photos.after}
            required
            title="After"
          />
          <Text style={styles.secondary}>{PHOTO_TIPS}</Text>
          {draft.calibration === null ? (
            <>
              <Button
                disabled={!afterUsable || locked}
                icon={ChevronRight}
                label="Align target"
                onPress={openEditor}
              />
              {afterUsable ? null : (
                <Text style={styles.secondary}>Add the after photo to align the target.</Text>
              )}
            </>
          ) : (
            <>
              <Button icon={ChevronRight} label="Continue" onPress={() => setStep('analyse')} />
              <Button
                disabled={!afterUsable || locked}
                label="Check alignment"
                onPress={openEditor}
                variant="secondary"
              />
            </>
          )}
          <Button
            label="Shots and hole diameter"
            onPress={() => setStep('setup')}
            variant="secondary"
          />
        </>
      ) : null}

      {step === 'analyse' ? (
        <>
          <RoundProgress current="review" draft={draft} />
          {banners}
          <View style={styles.thumbs}>
            <Thumbnail missing={missing.before} photo={draft.photos.before} title="Before" />
            <Thumbnail
              missing={missing.after}
              onPress={() => onInspect(false)}
              photo={draft.photos.after}
              title="After"
            />
          </View>
          {draft.photos.before === null ? (
            <Banner
              body="Existing holes may appear as suggestions. Review every result."
              title="No before photo"
              tone="warning"
            />
          ) : null}
          {draft.marks.length > 0 && afterUsable ? (
            <Button
              disabled={locked}
              icon={ScanSearch}
              label="Inspect hits"
              onPress={() => onInspect(true)}
              variant="secondary"
            />
          ) : null}
          <AnalysisPanel
            draft={draft}
            onChanged={onChanged}
            onOpenEditor={openEditor}
            onRunningChange={setAnalysisRunning}
            photosMissing={missing.after || missing.before}
            running={analysisRunning}
          />
          <Button
            disabled={locked}
            label="Review round"
            onPress={() => router.push(`${roundPath}/confirm`)}
            variant="secondary"
          />
          <Button
            disabled={locked}
            label="Change photos"
            onPress={() => setStep('photos')}
            variant="secondary"
          />
          <Text style={styles.muted}>
            {target?.isDemo !== false ? 'Demo score geometry · ' : ''}manual review required
          </Text>
        </>
      ) : null}

      <ConfirmDialog
        body="Alignment and hit markers for this photo will be cleared."
        cancelLabel="Keep photo"
        confirmLabel="Replace photo"
        onCancel={() => setReplaceAfter(null)}
        onConfirm={() => {
          const pending = replaceAfter?.pick ?? null;
          setReplaceAfter(null);
          if (pending === null) {
            void removePhoto('after');
          } else {
            void runPick(pending);
          }
        }}
        title="Replace after photo?"
        visible={replaceAfter !== null}
      />
    </>
  );
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Read-only: a confirmed result is never edited or rescored.
function ConfirmedRoundView({
  round,
  missing,
  onInspect,
}: {
  round: ConfirmedRound;
  missing: LoadedRound['missing'];
  onInspect: (showHits: boolean) => void;
}) {
  const { result } = round;
  const target = findTarget(result.targetId);
  const values = result.shots.flatMap((shot) =>
    Array.from({ length: shot.shots }, () => shot.value),
  );
  const accounted = result.actualShots - result.unresolvedShots;
  return (
    <>
      <ScoreSummary
        complete={result.status === 'complete'}
        demo={target?.isDemo !== false}
        detail={`${accounted} of ${plural(result.actualShots, 'shot', 'shots')} accounted for${result.status === 'complete' ? '' : ' · subtotal'}`}
        eyebrow={`Round ${round.sequence}`}
        points={result.subtotal}
      />
      <View style={styles.stats}>
        <Stat label={values.length === 1 ? 'Hit' : 'Hits'} value={values.length} />
        <Stat
          label={result.declaredMisses === 1 ? 'Miss' : 'Misses'}
          value={result.declaredMisses}
        />
        <Stat label="Unresolved" value={result.unresolvedShots} />
      </View>
      <View style={styles.card}>
        {values.length === 0 ? null : (
          <Text style={styles.body}>
            Hit scores: {[...values].sort((a, b) => b - a).join(', ')}
          </Text>
        )}
        <Text style={styles.secondary}>
          Hole diameter {result.hitDiameterMm.toFixed(1)} mm (
          {DIAMETER_SOURCE_TEXT[result.hitDiameterSource ?? 'unrecorded']}) ·{' '}
          {target?.label ?? result.targetId} · rule {result.scoringRule}
        </Text>
        <Text style={styles.secondary}>{"Confirmed results can't be changed."}</Text>
      </View>
      {round.photos.after !== null && !missing.after ? (
        <Button icon={ScanSearch} label="Inspect hits" onPress={() => onInspect(true)} />
      ) : null}
      {target?.isDemo !== false ? (
        <Banner
          body="This round used unverified target geometry. It is not an official score."
          title="Demo score"
          tone="warning"
        />
      ) : null}
      <PhotoSlot
        busy={false}
        editable={false}
        hint="No before photo."
        missing={missing.before}
        photo={round.photos.before}
        required={false}
        title="Before"
      />
      <PhotoSlot
        busy={false}
        editable={false}
        hint="No after photo."
        missing={missing.after}
        onInspect={() => onInspect(false)}
        photo={round.photos.after}
        required
        title="After"
      />
    </>
  );
}

export function RoundScreen({ sessionId, roundId }: { sessionId: string; roundId: string }) {
  const { db } = useSessionStore();
  const photos = usePhotoStore();
  const router = useRouter();

  const load = useCallback(async (): Promise<LoadedRound | null> => {
    const round = await getRound(db, roundId);
    if (round === null || round.sessionId !== sessionId) {
      return null;
    }
    const isMissing = (fileName: string | undefined) =>
      fileName !== undefined && !photos.exists(fileName);
    const found = await getSession(db, sessionId);
    const settings = found !== null && 'session' in found ? found.session.settings : null;
    return {
      round,
      firearmName: settings?.firearmName ?? '',
      calibreLabel: settings?.calibreLabel ?? '',
      missing: {
        before: isMissing(round.photos.before?.fileName),
        after: isMissing(round.photos.after?.fileName),
      },
    };
  }, [db, photos, roundId, sessionId]);
  const { state, reload } = useFocusLoad(load);
  // One inspection at a time: a second tap in the same frame must not open it twice.
  const inspectGuard = useRef(createActionGuard());
  useFocusEffect(
    useCallback(() => {
      inspectGuard.current.release();
    }, []),
  );
  const inspect = (showHits: boolean) => {
    if (!inspectGuard.current.tryEnter()) return;
    router.push(`/sessions/${sessionId}/rounds/${roundId}/inspect?hits=${showHits ? '1' : '0'}`);
  };

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace(`/sessions/${sessionId}`);
  const loaded = state.status === 'loaded' ? state.data : null;
  const title = loaded === null ? 'Round' : `Round ${loaded.round.sequence}`;
  const subtitle =
    loaded === null
      ? undefined
      : loaded.round.state === 'confirmed'
        ? 'Confirmed · read-only'
        : loaded.firearmName === ''
          ? 'Draft saved'
          : `${loaded.firearmName} · Draft saved`;

  return (
    <Screen scroll>
      <View style={styles.stack}>
        <ScreenHeader onBack={goBack} subtitle={subtitle} title={title} />
        {state.status === 'loading' ? (
          <Text accessibilityLiveRegion="polite" style={styles.secondary}>
            Loading round…
          </Text>
        ) : null}
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
            calibreLabel={loaded.calibreLabel}
            draft={loaded.round}
            key={loaded.round.id}
            missing={loaded.missing}
            onChanged={reload}
            onInspect={inspect}
          />
        ) : null}
        {loaded?.round.state === 'confirmed' ? (
          <ConfirmedRoundView missing={loaded.missing} onInspect={inspect} round={loaded.round} />
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  secondary: {
    ...typography.body,
    color: colors.secondary,
  },
  muted: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
  },
  thumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  thumb: {
    flexGrow: 1,
    flexBasis: 140,
    gap: spacing.label,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  thumbImage: {
    width: '100%',
    maxHeight: 160,
    borderRadius: radius.small,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 90,
    alignItems: 'center',
    gap: spacing.fine,
    padding: spacing.field,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  statValue: {
    ...typography.title,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...typography.caption,
    color: colors.secondary,
  },
});
