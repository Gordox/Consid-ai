import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Plus from 'lucide-react-native/icons/plus';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, sizes, spacing, typography } from '../../components/tokens';
import { DEFAULT_HIT_DIAMETER_MM } from '../../domain/round/roundRules';
import { DEMO_TARGET, DEMO_TARGET_NOTICE } from '../../domain/target/targetDefinition';
import {
  DraftRoundExistsError,
  finishSession,
  getSessionProgress,
  type RoundSummary,
  SessionFinishedError,
  startRound,
} from '../../persistence/roundRepository';
import { getSession } from '../../persistence/sessionRepository';
import { newId, nowUtcIso } from '../../services/deviceContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import { useFocusLoad } from '../useFocusLoad';
import { formatCreatedAt, formatPlannedRounds } from './formatSession';
import { FIREARM_TYPE_LABELS } from './firearmTypeLabels';
import { formatPoints, formatRoundResult, summarizeRounds } from './sessionProgressText';

type ActionError = 'startFailed' | 'finishFailed' | 'finishBlocked' | null;

const ACTION_ERROR_TEXT: Record<Exclude<ActionError, null>, string> = {
  startFailed: "Couldn't start a round. Your sessions are unchanged. Try again.",
  finishFailed: "Couldn't finish the session. Try again.",
  finishBlocked: 'Confirm or discard the round in progress before finishing the session.',
};

function RoundRow({ round, onPress }: { round: RoundSummary; onPress: () => void }) {
  const result = formatRoundResult(round);
  return (
    <Pressable
      accessibilityLabel={`Round ${round.sequence}, ${round.actualShots} shots, ${result}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roundRow, pressed && styles.pressed]}
    >
      <View style={styles.roundText}>
        <Text style={styles.roundTitle}>Round {round.sequence}</Text>
        <Text style={styles.secondary}>
          {round.actualShots === 1 ? '1 shot' : `${round.actualShots} shots`} · {result}
        </Text>
      </View>
      <Icon icon={ChevronRight} size="action" color={colors.secondary} />
    </Pressable>
  );
}

export function SessionDetail({ sessionId }: { sessionId: string }) {
  const { db } = useSessionStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ActionError>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);

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
            <Text style={styles.secondary}>Loading session…</Text>
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
        hitDiameterMm: DEFAULT_HIT_DIAMETER_MM,
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
    setConfirmFinish(false);
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await finishSession(db, sessionId, nowUtcIso());
      reload();
    } catch (error) {
      setActionError(error instanceof DraftRoundExistsError ? 'finishBlocked' : 'finishFailed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.stack}>
        <ScreenHeader onBack={goBack} title={settings.firearmName} />
        <Text style={styles.status}>
          {finished ? `Finished ${formatCreatedAt(progress.finishedAtUtc ?? '')}` : 'In progress'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.secondary}>Started {formatCreatedAt(session.createdAtUtc)}</Text>
          <Text style={styles.body}>
            {FIREARM_TYPE_LABELS[settings.firearmType]} · {settings.calibreLabel}
          </Text>
          <Text style={styles.body}>
            {settings.distanceMetres} m · planned {settings.plannedShotsPerRound} per round ·{' '}
            {formatPlannedRounds(settings.plannedRounds)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Result
          </Text>
          {summary.confirmedRounds === 0 ? (
            <Text style={styles.body}>No confirmed rounds yet.</Text>
          ) : (
            <>
              <Text style={styles.total}>{formatPoints(summary.subtotal, summary.complete)}</Text>
              <Text style={styles.secondary}>
                {summary.confirmedRounds === 1
                  ? '1 confirmed round'
                  : `${summary.confirmedRounds} confirmed rounds`}{' '}
                ·{' '}
                {summary.confirmedShots === 1
                  ? '1 shot fired'
                  : `${summary.confirmedShots} shots fired`}
              </Text>
              <Text style={styles.notice}>{DEMO_TARGET_NOTICE}</Text>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Rounds
          </Text>
          {progress.rounds.map((round) => (
            <RoundRow key={round.id} onPress={() => openRound(round.id)} round={round} />
          ))}
          {actionError === null ? null : (
            <Banner body={ACTION_ERROR_TEXT[actionError]} tone="error" />
          )}
          {finished ? null : draft !== null ? (
            <Button
              label={`Continue round ${draft.sequence}`}
              onPress={() => openRound(draft.id)}
            />
          ) : (
            <Button
              busy={busy}
              icon={Plus}
              label={`Start round ${progress.rounds.length + 1}`}
              onPress={() => void start()}
            />
          )}
        </View>

        {finished ? null : (
          <View style={styles.section}>
            <Button
              busy={busy}
              disabled={draft !== null}
              label="Finish session"
              onPress={() => setConfirmFinish(true)}
              variant="secondary"
            />
            {draft !== null ? (
              <Text style={styles.secondary}>Confirm or discard round {draft.sequence} first.</Text>
            ) : null}
          </View>
        )}

        <ConfirmDialog
          body="You can still view the session and its rounds, but you can't add rounds afterwards."
          cancelLabel="Keep going"
          confirmLabel="Finish session"
          onCancel={() => setConfirmFinish(false)}
          onConfirm={() => void finish()}
          title="Finish this session?"
          visible={confirmFinish}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.group,
  },
  status: {
    ...typography.label,
    color: colors.accent,
  },
  card: {
    gap: spacing.fine,
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
  secondary: {
    ...typography.body,
    color: colors.secondary,
  },
  notice: {
    ...typography.supporting,
    color: colors.warning,
  },
  roundRow: {
    minHeight: sizes.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.elevated,
  },
  roundText: {
    flex: 1,
    gap: spacing.fine,
  },
  roundTitle: {
    ...typography.section,
    color: colors.text,
  },
});
