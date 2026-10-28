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
import { buildConfirmedResult, evaluateDraft } from '../../domain/round/roundEvaluation';
import { DEMO_TARGET, findTarget } from '../../domain/target/targetDefinition';
import {
  confirmRound,
  DraftRoundExistsError,
  getRound,
  SessionFinishedError,
  startRound,
} from '../../persistence/roundRepository';
import { getSession } from '../../persistence/sessionRepository';
import { newId, nowUtcIso } from '../../services/deviceContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import { useFocusLoad } from '../useFocusLoad';
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
  const sessionPath = `/sessions/${sessionId}` as const;
  // Back from here returns to the session, not to the editor of a round that is now confirmed.
  const allowLeaveRef = useRef<() => void>(() => undefined);
  const allowLeave = usePreventRemove(true, () => {
    allowLeaveRef.current();
    router.dismissTo(sessionPath);
  });
  useEffect(() => {
    allowLeaveRef.current = allowLeave;
  }, [allowLeave]);
  const hits = result.shots.reduce((sum, shot) => sum + shot.shots, 0);
  const demo = findTarget(result.targetId)?.isDemo !== false;

  const backToSession = () => {
    allowLeave();
    router.dismissTo(sessionPath);
  };

  const startNext = async () => {
    if (busy) return;
    setBusy(true);
    setStartFailed(false);
    const roundId = newId();
    try {
      await startRound(db, {
        roundId,
        sessionId,
        createdAtUtc: nowUtcIso(),
        actualShots: plannedShots,
        targetId: DEMO_TARGET.id,
      });
      allowLeave();
      router.dismissTo(sessionPath);
      router.push(`${sessionPath}/rounds/${roundId}`);
    } catch (error) {
      if (error instanceof DraftRoundExistsError) {
        allowLeave();
        router.dismissTo(sessionPath);
        router.push(`${sessionPath}/rounds/${error.draftRoundId}`);
      } else if (error instanceof SessionFinishedError) {
        backToSession();
      } else {
        reportDevError(error);
        setStartFailed(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
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
  const { db } = useSessionStore();
  const router = useRouter();
  const target = findTarget(draft.targetId);
  const { counts, change, written, saveFailed } = useDraftCounts(db, draft, reportDevError);
  const [busy, setBusy] = useState(false);
  const [confirmFailed, setConfirmFailed] = useState(false);
  const current: DraftRound = { ...draft, ...counts };
  const evaluation = evaluateDraft(current, target);
  const incomplete = evaluation.status === 'incomplete';
  const accounted = evaluation.hitShots + counts.declaredMisses;
  const editorPath = `/sessions/${draft.sessionId}/rounds/${draft.id}/editor` as const;

  const confirm = async () => {
    if (busy || evaluation.blockReason !== null) return;
    setBusy(true);
    setConfirmFailed(false);
    try {
      await written();
      // Built by the domain from the same counts the screen shows; it refuses a round that
      // cannot be confirmed.
      const result = buildConfirmedResult(current, target);
      const outcome = await confirmRound(db, draft.id, result, nowUtcIso());
      if (outcome === 'confirmed') {
        onConfirmed(result);
      } else {
        // Confirmed earlier (e.g. a repeated press): show the stored round, not this result.
        onChanged();
      }
    } catch (error) {
      reportDevError(error);
      setConfirmFailed(true);
      onChanged();
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
      {confirmFailed ? (
        <Banner
          body="The round is still a draft. Your marks and counts are kept. Try again."
          title="Couldn't confirm the round"
          tone="error"
        />
      ) : null}
      <Text style={styles.secondary}>
        Confirmed rounds cannot be edited. Check your markers and shot count first.
      </Text>
      <Button
        busy={busy}
        disabled={evaluation.blockReason !== null}
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
          <ScreenHeader
            onBack={() => router.dismissTo(`/sessions/${sessionId}`)}
            subtitle="Saved on this device"
            title="Round confirmed"
          />
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
