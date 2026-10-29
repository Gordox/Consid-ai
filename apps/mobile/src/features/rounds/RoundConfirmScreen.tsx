import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Plus from 'lucide-react-native/icons/plus';
import { usePreventRemove, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScoreSummary } from '../../components/ScoreSummary';
import { colors, radius, spacing, typography } from '../../components/tokens';
import type { ConfirmedResult, DraftRound } from '../../domain/round/round';
import { evaluateDraft } from '../../domain/round/roundEvaluation';
import { DEMO_TARGET, findTarget } from '../../domain/target/targetDefinition';
import { confirmRound, getRound } from '../../persistence/roundRepository';
import { getSession } from '../../persistence/sessionRepository';
import { newId, nowUtcIso } from '../../services/deviceContext';
import { useRoundAnalysis } from '../analysis/useRoundAnalysis';
import { useSessionStore } from '../startup/sessionStoreContext';
import { useFocusLoad } from '../useFocusLoad';
import { createActionGuard, startNextRound } from './nextRound';
import { ShotAccounting } from './RoundCounts';
import { roundStatusText } from './roundText';
import { useDraftCounts } from './useDraftCounts';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Confirm round error:', error instanceof Error ? error.name : typeof error);
  }
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

type ConfirmProblem = 'countsNotSaved' | 'changed' | 'analysisRunning' | 'blocked' | 'failed';

// The round always stays a draft in these cases; nothing of it was lost.
const CONFIRM_PROBLEM_TEXT: Record<ConfirmProblem, string> = {
  countsNotSaved:
    "The shot counts couldn't be saved, so the round wasn't confirmed. Change a value to save it again, then confirm.",
  changed:
    "The round changed after this screen showed it, so it wasn't confirmed. Check the values shown now, then confirm.",
  analysisRunning: "An analysis of this round is still running, so it wasn't confirmed.",
  blocked:
    "The saved round doesn't add up or still has suggestions to review, so it wasn't confirmed. Check it, then try again.",
  failed: 'The round is still a draft. Your marks and counts are kept. Try again.',
};

type Loaded =
  | { readonly kind: 'draft'; readonly draft: DraftRound; readonly plannedShots: number }
  | { readonly kind: 'confirmed'; readonly sequence: number }
  | { readonly kind: 'missing' };

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Screen 13: a result screen that survives leaving and returning; it does not depend on an
// animation or a toast. Next round and Back to session are explicit choices.
function RoundComplete({
  sessionId,
  sequence,
  result,
  plannedShots,
}: {
  sessionId: string;
  sequence: number;
  result: ConfirmedResult;
  plannedShots: number;
}) {
  const { db } = useSessionStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const guard = useRef(createActionGuard());
  const sessionPath = `/sessions/${sessionId}` as const;
  // Every way back (header, Android Back, iOS swipe) returns to the session, never to the
  // editor of a round that is now confirmed. The hook only redirects; it never keeps the user.
  const allowLeaveRef = useRef<() => void>(() => undefined);
  const allowLeave = usePreventRemove(true, () => {
    // While the next round is being created, Back waits for it; that call always finishes and
    // then navigates or reopens the guard.
    if (!guard.current.tryEnter()) return;
    allowLeaveRef.current();
    router.dismissTo(sessionPath);
  });
  useEffect(() => {
    allowLeaveRef.current = allowLeave;
  }, [allowLeave]);
  const hits = result.shots.reduce((sum, shot) => sum + shot.shots, 0);
  const demo = findTarget(result.targetId)?.isDemo !== false;

  const backToSession = () => {
    if (!guard.current.tryEnter()) return;
    allowLeave();
    router.dismissTo(sessionPath);
  };

  const startNext = async () => {
    if (!guard.current.tryEnter()) return;
    setBusy(true);
    setStartFailed(false);
    const outcome = await startNextRound(db, {
      sessionId,
      actualShots: plannedShots,
      targetId: DEMO_TARGET.id,
      newId,
      now: nowUtcIso,
    });
    if (outcome.kind === 'failed') {
      reportDevError(outcome.error);
      setStartFailed(true);
      setBusy(false);
      guard.current.release();
      return;
    }
    // The guard stays closed: this screen is leaving.
    allowLeave();
    router.dismissTo(sessionPath);
    if (outcome.kind === 'open') {
      router.push(`${sessionPath}/rounds/${outcome.roundId}`);
    }
  };

  return (
    <>
      <ScreenHeader
        onBack={backToSession}
        subtitle="Saved on this device"
        title="Round confirmed"
      />
      <Banner
        body="Your reviewed result is now part of this session."
        title={`Round ${sequence} saved`}
        tone="success"
      />
      <ScoreSummary
        complete={result.status === 'complete'}
        demo={demo}
        detail={`${result.actualShots - result.unresolvedShots} of ${plural(result.actualShots, 'shot', 'shots')} accounted for`}
        eyebrow={`Round ${sequence}`}
        points={result.subtotal}
      />
      <View style={styles.stats}>
        <Stat label={hits === 1 ? 'Hit' : 'Hits'} value={hits} />
        <Stat
          label={result.declaredMisses === 1 ? 'Miss' : 'Misses'}
          value={result.declaredMisses}
        />
        <Stat label="Unresolved" value={result.unresolvedShots} />
      </View>
      {startFailed ? (
        <Banner
          body="Couldn't start a round. Your sessions are unchanged. Try again."
          tone="error"
        />
      ) : null}
      <Button busy={busy} icon={Plus} label="Start next round" onPress={() => void startNext()} />
      <Button label="Back to session" onPress={backToSession} variant="secondary" />
    </>
  );
}

function ReviewDraft({
  draft,
  onConfirmed,
  onChanged,
}: {
  draft: DraftRound;
  onConfirmed: (result: ConfirmedResult) => void;
  onChanged: () => void;
}) {
  const { db, analysisRuns } = useSessionStore();
  const router = useRouter();
  const target = findTarget(draft.targetId);
  const { counts, change, written, revision, saveFailed, lostChanges } = useDraftCounts(
    db,
    draft,
    reportDevError,
    onChanged,
  );
  const { runningAttempt } = useRoundAnalysis(analysisRuns, draft.id);
  const [busy, setBusy] = useState(false);
  const [confirmFailed, setConfirmFailed] = useState<ConfirmProblem | null>(null);
  const confirmGuard = useRef(createActionGuard());
  const current: DraftRound = { ...draft, ...counts };
  const analysisRunning = runningAttempt !== null;
  const evaluation = evaluateDraft(current, target);
  const incomplete = evaluation.status === 'incomplete';
  const accounted = evaluation.hitShots + counts.declaredMisses;
  const editorPath = `/sessions/${draft.sessionId}/rounds/${draft.id}/editor` as const;

  const confirm = async () => {
    if (evaluation.blockReason !== null || analysisRunning) return;
    if (!confirmGuard.current.tryEnter()) return;
    setBusy(true);
    setConfirmFailed(null);
    const reopen = (problem: ConfirmProblem) => {
      setConfirmFailed(problem);
      confirmGuard.current.release();
      onChanged();
    };
    try {
      // Nothing is confirmed while a count change is unsaved or was refused: the result must be
      // the one this screen shows.
      const counted = await written();
      if (counted !== 'saved') {
        reopen(counted === 'failed' ? 'countsNotSaved' : 'changed');
        return;
      }
      // The repository builds the result from the stored draft in the same transaction, at the
      // revision this screen showed after its own writes.
      const outcome = await confirmRound(db, draft.id, {
        expectedRevision: revision(),
        confirmedAtUtc: nowUtcIso(),
        findTarget,
        isAttemptRunning: analysisRuns.isAttemptRunning,
      });
      switch (outcome.kind) {
        case 'confirmed':
        case 'alreadyConfirmed':
          // A confirmed round is never confirmed again, so the guard stays closed. A repeated
          // confirmation shows the result stored the first time.
          onConfirmed(outcome.result);
          return;
        case 'changed':
          reopen('changed');
          return;
        case 'analysisRunning':
          reopen('analysisRunning');
          return;
        case 'blocked':
          reopen('blocked');
          return;
      }
    } catch (error) {
      reportDevError(error);
      reopen('failed');
    } finally {
      setBusy(false);
    }
  };

  const backToEditor = () => (router.canGoBack() ? router.back() : router.replace(editorPath));

  return (
    <>
      {evaluation.score === null ? null : (
        <ScoreSummary
          complete={evaluation.status === 'complete'}
          demo={target?.isDemo !== false}
          detail={`${accounted} of ${plural(counts.actualShots, 'shot', 'shots')} accounted for${evaluation.status === 'complete' ? '' : ' · subtotal'}`}
          eyebrow={evaluation.status === 'complete' ? 'Round total' : 'Round subtotal'}
          points={evaluation.score.subtotal}
        />
      )}
      {saveFailed ? (
        <Banner body="Couldn't save the shot counts. Change a value to try again." tone="error" />
      ) : null}
      {lostChanges > 0 ? (
        <Banner
          body={`The round changed elsewhere, so ${lostChanges === 1 ? 'your last change' : `your last ${lostChanges} changes`} to the counts weren't saved. The values shown are the saved ones; check them again.`}
          title="Round changed"
          tone="warning"
        />
      ) : null}
      {analysisRunning ? (
        <Banner
          body="An analysis of this round is still running. Wait for it to finish, or cancel it on the round screen, before confirming."
          title="Analysis running"
          tone="info"
        />
      ) : null}
      <ShotAccounting counts={counts} disabled={busy} evaluation={evaluation} onChange={change} />

      {evaluation.pendingSuggestions > 0 ? (
        <Banner
          body="Review or remove every suggestion before confirming."
          title="Review required"
          tone="warning"
        />
      ) : null}
      {counts.hitDiameterSource === 'assumed' ? (
        <Banner
          body={`${counts.hitDiameterMm.toFixed(1)} mm is a default. Check this value before using boundary scores. If you confirm now, it is saved as an assumption.`}
          title="Hole diameter is assumed"
          tone="warning"
        >
          <Button
            disabled={busy}
            label={`Use ${counts.hitDiameterMm.toFixed(1)} mm`}
            onPress={() => change({ ...counts, hitDiameterSource: 'userSet' })}
            variant="secondary"
          />
        </Banner>
      ) : null}
      {incomplete && evaluation.blockReason === null ? (
        <Banner
          body={`${plural(counts.unresolvedShots, 'shot is', 'shots are')} unresolved. The score will be saved as a subtotal.`}
          title="Incomplete result"
          tone="warning"
        />
      ) : null}
      {evaluation.blockReason === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.blocked}>
          {roundStatusText(evaluation, counts.actualShots)}
        </Text>
      )}
      {confirmFailed === null ? null : (
        <Banner
          body={CONFIRM_PROBLEM_TEXT[confirmFailed]}
          title="Couldn't confirm the round"
          tone="error"
        />
      )}
      <Text style={styles.secondary}>
        Confirmed rounds cannot be edited. Check your markers and shot count first.
      </Text>
      <Button
        busy={busy}
        disabled={evaluation.blockReason !== null || analysisRunning}
        label={busy ? 'Confirming…' : incomplete ? 'Confirm incomplete round' : 'Confirm round'}
        onPress={() => void confirm()}
      />
      <Button
        icon={ChevronLeft}
        label="Back to editor"
        onPress={backToEditor}
        variant="secondary"
      />
    </>
  );
}

export function RoundConfirmScreen({ sessionId, roundId }: { sessionId: string; roundId: string }) {
  const { db } = useSessionStore();
  const router = useRouter();
  // Set by this screen's own confirmation, so the result screen survives a reread of the round.
  const [confirmed, setConfirmed] = useState<{
    readonly result: ConfirmedResult;
    readonly sequence: number;
    readonly plannedShots: number;
  } | null>(null);

  const load = useCallback(async (): Promise<Loaded> => {
    const round = await getRound(db, roundId);
    if (round === null || round.sessionId !== sessionId) return { kind: 'missing' };
    if (round.state === 'confirmed') return { kind: 'confirmed', sequence: round.sequence };
    const found = await getSession(db, sessionId);
    const plannedShots =
      found !== null && 'session' in found
        ? found.session.settings.plannedShotsPerRound
        : round.actualShots;
    return { kind: 'draft', draft: round, plannedShots };
  }, [db, roundId, sessionId]);
  const { state, reload } = useFocusLoad(load);
  const loaded = state.status === 'loaded' ? state.data : null;
  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace(`/sessions/${sessionId}`);

  if (confirmed !== null) {
    return (
      <Screen scroll>
        <View style={styles.stack}>
          <RoundComplete
            plannedShots={confirmed.plannedShots}
            result={confirmed.result}
            sequence={confirmed.sequence}
            sessionId={sessionId}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.stack}>
        <ScreenHeader
          onBack={goBack}
          subtitle={
            loaded?.kind === 'draft'
              ? `Round ${loaded.draft.sequence} · Changes saved as a draft`
              : undefined
          }
          title="Review round"
        />
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
        {loaded?.kind === 'missing' ? (
          <Banner body="This round doesn't exist in this session." tone="error" />
        ) : null}
        {loaded?.kind === 'confirmed' ? (
          <>
            <Banner
              body="Confirmed results can't be changed."
              title={`Round ${loaded.sequence} is already confirmed`}
              tone="info"
            />
            <Button
              label="Back to session"
              onPress={() => router.dismissTo(`/sessions/${sessionId}`)}
            />
          </>
        ) : null}
        {loaded?.kind === 'draft' ? (
          <ReviewDraft
            key={loaded.draft.id}
            draft={loaded.draft}
            onChanged={reload}
            onConfirmed={(result) =>
              setConfirmed({
                result,
                sequence: loaded.draft.sequence,
                plannedShots: loaded.plannedShots,
              })
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.group,
  },
  secondary: {
    ...typography.body,
    color: colors.secondary,
  },
  blocked: {
    ...typography.body,
    color: colors.warning,
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
