import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Plus from 'lucide-react-native/icons/plus';
import Trash2 from 'lucide-react-native/icons/trash';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScoreSummary } from '../../components/ScoreSummary';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, sizes, spacing, typography } from '../../components/tokens';
import { DEMO_TARGET } from '../../domain/target/targetDefinition';
import {
  discardDraftRound,
  DraftRoundExistsError,
  finishSession,
  getSessionProgress,
  type RoundSummary,
  SessionFinishedError,
  startRound,
} from '../../persistence/roundRepository';
import { getSession } from '../../persistence/sessionRepository';
import { newId, nowUtcIso } from '../../services/deviceContext';
import { discardPhotos } from '../rounds/photoActions';
import { usePhotoStore } from '../startup/photoStoreContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import { useFocusLoad } from '../useFocusLoad';
import { formatCreatedAt, formatPlannedRounds } from './formatSession';
import { FIREARM_TYPE_LABELS } from './firearmTypeLabels';
import {
  formatRoundResult,
  formatShortScore,
  isVerifiedTarget,
  type ResultGroup,
  summarizeRounds,
} from './sessionProgressText';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Session detail error:', error instanceof Error ? error.name : typeof error);
  }
}

type ActionError = 'startFailed' | 'finishFailed' | 'discardFailed' | null;

const ACTION_ERROR_TEXT: Record<Exclude<ActionError, null>, string> = {
  startFailed: "Couldn't start a round. Your sessions are unchanged. Try again.",
  finishFailed: "Couldn't finish the session. Try again.",
  discardFailed: "Couldn't discard the round. It is still a draft. Try again.",
};

type Dialog = 'finish' | 'draftBlocksFinish' | 'discardDraft' | null;

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

function twoDigits(sequence: number): string {
  return sequence < 10 ? `0${sequence}` : String(sequence);
}

// components/13-round-card.png. A draft opens the round to continue it; a confirmed round opens
// its read-only result.
function RoundCard({ round, onPress }: { round: RoundSummary; onPress: () => void }) {
  const confirmed = round.state === 'confirmed';
  const score = confirmed
    ? formatShortScore(
        round.confirmedSubtotal ?? 0,
        round.confirmedComplete === true,
        !isVerifiedTarget(round.targetId),
      )
    : 'Not confirmed';
  return (
    <Pressable
      accessibilityHint={confirmed ? 'Opens the confirmed result' : 'Continues the round'}
      accessibilityLabel={`Round ${round.sequence}, ${plural(round.actualShots, 'shot', 'shots')}, ${confirmed ? 'confirmed' : 'draft'}, ${formatRoundResult(round)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roundCard, pressed && styles.pressed]}
    >
      <View style={styles.roundTop}>
        <View style={styles.sequenceBox}>
          <Text style={styles.sequence}>{twoDigits(round.sequence)}</Text>
        </View>
        <View style={styles.roundText}>
          <Text style={styles.roundTitle}>Round {round.sequence}</Text>
          <Text style={styles.secondary}>{plural(round.actualShots, 'shot', 'shots')}</Text>
        </View>
        <Icon icon={ChevronRight} size="feature" color={colors.secondary} />
      </View>
      <View style={styles.roundBottom}>
        <StatusBadge
          label={confirmed ? 'Confirmed' : 'Draft'}
          tone={confirmed ? 'success' : 'warning'}
        />
        <Text style={styles.roundScore}>{score}</Text>
      </View>
    </Pressable>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function resultDetail(result: ResultGroup): string {
  const parts = [
    plural(result.rounds, 'confirmed round', 'confirmed rounds'),
    plural(result.shots, 'shot', 'shots'),
  ];
  if (result.unresolvedShots > 0) {
    parts.push(
      `${plural(result.unresolvedShots, 'unresolved shot', 'unresolved shots')} not counted`,
    );
  }
  return parts.join(' · ');
}

export function SessionDetail({ sessionId }: { sessionId: string }) {
  const { db } = useSessionStore();
  const photos = usePhotoStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ActionError>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const load = useCallback(async () => {
    const found = await getSession(db, sessionId);
    if (found === null || 'invalid' in found) {
      return null;
    }
    return { session: found.session, progress: await getSessionProgress(db, sessionId) };
  }, [db, sessionId]);
  const { state, reload } = useFocusLoad(load);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openRound = (roundId: string) => router.push(`/sessions/${sessionId}/rounds/${roundId}`);

  if (state.status !== 'loaded' || state.data === null) {
    return (
      <Screen scroll>
        <View style={styles.stack}>
          <ScreenHeader onBack={goBack} title="Session" />
          {state.status === 'loading' ? (
            <Text accessibilityLiveRegion="polite" style={styles.secondary}>
              Loading session…
            </Text>
          ) : null}
          {state.status === 'failed' ? (
            <>
              <Banner
                body="Your saved records haven't been changed. Try again."
                title="Couldn't open the session"
                tone="error"
              />
              <Button label="Try again" onPress={reload} />
            </>
          ) : null}
          {state.status === 'loaded' ? (
            <Banner
              body="This session record can't be opened. Other sessions are still available."
              title="Session unavailable"
              tone="error"
            />
          ) : null}
        </View>
      </Screen>
    );
  }

  const { session, progress } = state.data;
  const { settings } = session;
  const summary = summarizeRounds(progress.rounds);
  const finished = progress.finishedAtUtc !== null;
  const draft = progress.rounds.find((round) => round.state === 'draft') ?? null;
  const unresolved =
    (summary.demo?.unresolvedShots ?? 0) + (summary.verified?.unresolvedShots ?? 0);
  const shots = (summary.demo?.shots ?? 0) + (summary.verified?.shots ?? 0);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    const roundId = newId();
    try {
      await startRound(db, {
        roundId,
        sessionId,
        createdAtUtc: nowUtcIso(),
        actualShots: settings.plannedShotsPerRound,
        targetId: DEMO_TARGET.id,
      });
      openRound(roundId);
    } catch (error) {
      if (error instanceof DraftRoundExistsError) {
        openRound(error.draftRoundId);
      } else if (error instanceof SessionFinishedError) {
        reload();
      } else {
        setActionError('startFailed');
      }
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setDialog(null);
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await finishSession(db, sessionId, nowUtcIso());
      reload();
    } catch (error) {
      if (error instanceof DraftRoundExistsError) {
        // A draft appeared since the screen was read.
        setDialog('draftBlocksFinish');
        reload();
      } else {
        setActionError('finishFailed');
      }
    } finally {
      setBusy(false);
    }
  };

  // Removes only the draft and its photo copies; confirmed rounds are never touched.
  const discardDraft = async () => {
    setDialog(null);
    if (busy || draft === null) return;
    setBusy(true);
    setActionError(null);
    try {
      const files = await discardDraftRound(db, draft.id);
      await discardPhotos(db, photos, files, reportDevError);
      reload();
    } catch (error) {
      reportDevError(error);
      setActionError('discardFailed');
    } finally {
      setBusy(false);
    }
  };

  const results = [
    summary.verified === null ? null : { key: 'verified', demo: false, result: summary.verified },
    summary.demo === null ? null : { key: 'demo', demo: true, result: summary.demo },
  ].filter((entry) => entry !== null);

  return (
    <Screen scroll>
      <View style={styles.stack}>
        <ScreenHeader
          onBack={goBack}
          subtitle={formatCreatedAt(session.createdAtUtc)}
          title={finished ? 'Session complete' : settings.firearmName}
        />

        <View style={styles.statusRow}>
          <StatusBadge
            label={finished ? 'Finished' : 'In progress'}
            tone={finished ? 'success' : 'accent'}
          />
          <Text style={styles.secondary}>
            {settings.distanceMetres} m · {settings.calibreLabel}
          </Text>
        </View>

        <View style={styles.card}>
          {finished ? <Text style={styles.body}>{settings.firearmName}</Text> : null}
          <Text style={styles.body}>
            {FIREARM_TYPE_LABELS[settings.firearmType]} · {settings.calibreLabel}
          </Text>
          <Text style={styles.secondary}>
            {settings.distanceMetres} m · {plural(settings.plannedShotsPerRound, 'shot', 'shots')} /
            round · {formatPlannedRounds(settings.plannedRounds)}
          </Text>
          {finished ? (
            <Text style={styles.secondary}>
              Finished {formatCreatedAt(progress.finishedAtUtc ?? '')}
            </Text>
          ) : null}
        </View>

        {results.length === 0 ? (
          <Text style={styles.body}>No confirmed rounds yet.</Text>
        ) : (
          // Demo and verified results are separate sections; they are never added together.
          results.map(({ key, demo, result }) => (
            <ScoreSummary
              key={key}
              complete={finished && result.complete}
              demo={demo}
              detail={resultDetail(result)}
              eyebrow={
                finished
                  ? demo
                    ? 'Demo scores'
                    : 'Session total'
                  : demo
                    ? 'Session subtotal'
                    : 'Verified subtotal'
              }
              points={result.subtotal}
            />
          ))
        )}

        {finished && summary.confirmedRounds > 0 ? (
          <View style={styles.stats}>
            <Stat
              label={summary.confirmedRounds === 1 ? 'Round' : 'Rounds'}
              value={summary.confirmedRounds}
            />
            <Stat label={shots === 1 ? 'Shot' : 'Shots'} value={shots} />
            <Stat label="Unresolved" value={unresolved} />
          </View>
        ) : null}

        {actionError === null ? null : (
          <Banner body={ACTION_ERROR_TEXT[actionError]} tone="error" />
        )}

        {finished ? null : draft !== null ? (
          <>
            <Banner
              body="Your photos, alignment and markers were saved."
              title={`Round ${draft.sequence} is unfinished`}
              tone="info"
            />
            <Button
              icon={ChevronRight}
              label={`Continue round ${draft.sequence}`}
              onPress={() => openRound(draft.id)}
            />
          </>
        ) : (
          <Button
            busy={busy}
            icon={Plus}
            label={`Start round ${progress.rounds.length + 1}`}
            onPress={() => void start()}
          />
        )}

        {progress.rounds.length === 0 ? null : (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {finished ? 'Round results' : 'Rounds'}
            </Text>
            {[...progress.rounds].reverse().map((round) => (
              <RoundCard key={round.id} onPress={() => openRound(round.id)} round={round} />
            ))}
          </View>
        )}

        {summary.demo !== null ? (
          <Banner
            body="This session used unverified target geometry. It is not an official score."
            title="Demo scores"
            tone="warning"
          />
        ) : null}

        {finished ? (
          <Button
            icon={ChevronLeft}
            label="Back to sessions"
            onPress={() => router.dismissTo('/')}
          />
        ) : (
          <View style={styles.section}>
            {draft === null ? null : (
              <Button
                busy={busy}
                icon={Trash2}
                label={`Discard round ${draft.sequence}`}
                onPress={() => setDialog('discardDraft')}
                variant="destructive"
              />
            )}
            <Button
              busy={busy}
              label="Finish session"
              onPress={() => setDialog(draft === null ? 'finish' : 'draftBlocksFinish')}
              variant="secondary"
            />
            {draft === null ? null : (
              <Text style={styles.secondary}>
                Finish or discard the draft before ending this session.
              </Text>
            )}
          </View>
        )}

        <ConfirmDialog
          body="You can still view the session and its rounds, but you can't add rounds afterwards."
          cancelLabel="Keep going"
          confirmLabel="Finish session"
          confirmVariant="primary"
          onCancel={() => setDialog(null)}
          onConfirm={() => void finish()}
          title="Finish this session?"
          visible={dialog === 'finish'}
        />
        <ConfirmDialog
          body="Continue or discard the unfinished round before ending this session."
          cancelLabel="Cancel"
          confirmLabel="Continue draft"
          confirmVariant="primary"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            if (draft !== null) openRound(draft.id);
          }}
          title="Finish the draft first"
          visible={dialog === 'draftBlocksFinish'}
        />
        <ConfirmDialog
          body="The draft, its marks and its photo copies in this app are removed. Confirmed rounds and photos in your phone's library are not touched."
          cancelLabel="Keep round"
          confirmLabel="Discard round"
          onCancel={() => setDialog(null)}
          onConfirm={() => void discardDraft()}
          title={draft === null ? 'Discard round?' : `Discard round ${draft.sequence}?`}
          visible={dialog === 'discardDraft'}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.group,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  card: {
    gap: spacing.fine,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  section: {
    gap: spacing.small,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  secondary: {
    ...typography.body,
    color: colors.secondary,
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
  roundCard: {
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.elevated,
  },
  roundTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  sequenceBox: {
    minWidth: sizes.minTouchTarget,
    minHeight: sizes.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sequence: {
    ...typography.body,
    color: colors.secondary,
    fontVariant: ['tabular-nums'],
  },
  roundText: {
    flex: 1,
    gap: spacing.fine,
  },
  roundTitle: {
    ...typography.section,
    color: colors.text,
  },
  roundBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  roundScore: {
    ...typography.body,
    color: colors.text,
  },
});
