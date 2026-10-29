import Plus from 'lucide-react-native/icons/plus';
import Target from 'lucide-react-native/icons/target';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { colors, radius, spacing, typography } from '../../components/tokens';
import { calibrationProblem } from '../../domain/round/calibrationCheck';
import type { DraftRound } from '../../domain/round/round';
import { findTarget } from '../../domain/target/targetDefinition';
import { getLatestAttempt, type LatestAttempt } from '../../persistence/analysisRepository';
import { ANALYSIS_TIMEOUT_MS } from '../../services/analysis/analysisClient';
import { readAnalysisConfig } from '../../services/analysis/analysisConfig';
import { newId, nowUtcIso } from '../../services/deviceContext';
import { formatCreatedAt } from '../sessions/formatSession';
import { usePhotoStore } from '../startup/photoStoreContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import { type AnalysisRunResult, runAnalysisAttempt } from './analysisRun';
import {
  ANALYSIS_BLOCK_TEXT,
  ANALYSIS_ERROR_TEXT,
  analysisBlock,
  analysisErrorTitle,
  latestAttemptText,
  modeText,
  suggestionSummary,
} from './analysisText';
import { useRoundAnalysis } from './useRoundAnalysis';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Analysis error:', error instanceof Error ? error.name : typeof error);
  }
}

type Message =
  | { readonly tone: 'success' | 'info'; readonly text: string }
  | {
      readonly tone: 'error';
      readonly code: string;
      readonly title: string;
      readonly text: string;
    };

function failure(code: string, text: string): Message {
  return { tone: 'error', code, title: analysisErrorTitle(code), text };
}

function messageFor(result: AnalysisRunResult): Message {
  switch (result.kind) {
    case 'applied':
      return { tone: 'success', text: suggestionSummary(result.added, result.warnings) };
    case 'stale':
      return failure('stale', ANALYSIS_ERROR_TEXT.stale);
    case 'cancelled':
      return { tone: 'info', text: ANALYSIS_ERROR_TEXT.cancelled };
    case 'failed':
      return failure(
        result.code,
        result.code === 'oldPhotoCopy'
          ? ANALYSIS_BLOCK_TEXT.oldPhotoCopy
          : ANALYSIS_ERROR_TEXT[result.code],
      );
    case 'saveFailed':
      return failure(
        'save',
        "Couldn't save the analysis. Your photos and marks are kept. Try again.",
      );
  }
}

// Screens 08 (analyse or mark manually), 09 (analysing) and 15 (analysis unavailable). Nothing
// is sent until the user chooses Analyse; the manual path is always available. The analysis
// keeps running when the user leaves the round; Cancel only stops the app waiting for it.
export function AnalysisPanel({
  draft,
  photosMissing,
  onOpenEditor,
}: {
  draft: DraftRound;
  photosMissing: boolean;
  onOpenEditor: () => void;
}) {
  const { db, analysisRuns } = useSessionStore();
  const photos = usePhotoStore();
  const [config] = useState(readAnalysisConfig);
  const [latest, setLatest] = useState<LatestAttempt | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const { runningAttempt, cancelling, lastFinished } = useRoundAnalysis(analysisRuns, draft.id);
  const running = runningAttempt !== null;
  const target = findTarget(draft.targetId);
  const { after, before } = draft.photos;
  const pending = draft.marks.filter((mark) => !mark.accepted).length;
  const message = running || lastFinished === null ? null : messageFor(lastFinished.outcome.result);

  // The stored attempt survives leaving the screen and restarts; reread when the round or the
  // running attempt changes.
  useEffect(() => {
    let active = true;
    getLatestAttempt(db, draft.id).then(
      (attempt) => {
        if (active) setLatest(attempt);
      },
      (error: unknown) => reportDevError(error),
    );
    return () => {
      active = false;
    };
  }, [db, draft, runningAttempt]);

  useEffect(() => {
    if (running) {
      AccessibilityInfo.announceForAccessibility('Analysing photos…');
    }
  }, [running]);

  const block = analysisBlock({
    hasAfter: after !== null,
    photosMissing,
    oldPhotoCopy:
      (after !== null && after.originalFileName === null) ||
      (before !== null && before.originalFileName === null),
    // A crossed or folded calibration counts as not calibrated: it cannot frame the search.
    calibrated:
      draft.calibration !== null &&
      (after === null || calibrationProblem(draft.calibration, after) === null),
    targetKnown: target !== null,
  });

  // afterOnly sends only the after photo even when a before photo exists: the user's explicit
  // choice after the photos could not be aligned.
  function run(afterOnly = false): void {
    setConfirmReplace(false);
    const calibration = draft.calibration;
    if (running || config === null || after === null || target === null) return;
    if (calibration === null || block !== null) return;
    const attemptId = newId();
    analysisRuns.start(draft.id, attemptId, (signal) =>
      runAnalysisAttempt(
        {
          db,
          config,
          photos,
          fetch: (url, init) => fetch(url, init),
          timeoutMs: ANALYSIS_TIMEOUT_MS,
          now: nowUtcIso,
          newId,
          reportError: reportDevError,
        },
        {
          attemptId,
          roundId: draft.id,
          targetId: draft.targetId,
          calibration,
          after,
          before: afterOnly ? null : before,
        },
        signal,
      ),
    );
  }

  const start = () => (pending > 0 ? setConfirmReplace(true) : run());
  const stored =
    latest === null || running || message !== null ? null : latestAttemptText(latest, false);
  const lastFailed =
    (latest !== null && latest.status !== 'succeeded' && !running) || message?.tone === 'error';
  const canAnalyse = config !== null && block === null;
  // The photos could not be aligned: offer the after photo alone as an explicit choice.
  const registrationFailed =
    (message?.tone === 'error' && message.code === 'registrationFailed') ||
    (message === null && latest?.status === 'failed' && latest.errorCode === 'registrationFailed');
  const offerAfterOnly = canAnalyse && before !== null && registrationFailed && pending === 0;
  const storedPrefix = latest === null ? '' : `${formatCreatedAt(latest.createdAtUtc)}: `;

  if (running) {
    return (
      <View style={styles.card}>
        <View style={styles.progressRow}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text accessibilityRole="header" style={styles.title}>
            Analysing photos…
          </Text>
        </View>
        <Text style={styles.body}>
          This can take up to a minute. Photos and marks are locked until it finishes. Your draft is
          saved, and the analysis keeps running if you leave this screen.
        </Text>
        <Button
          busy={cancelling}
          label={cancelling ? 'Cancelling…' : 'Cancel analysis'}
          onPress={() => analysisRuns.cancel(draft.id)}
          variant="secondary"
        />
        <Text style={styles.caption}>
          Cancelling stops waiting for the answer. The service may still finish its work, but its
          answer is not used.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {config === null ? (
        <Banner
          body="Automatic analysis isn't set up in this app. Mark the hits yourself."
          title="Analysis unavailable"
          tone="info"
        />
      ) : (
        <>
          <Banner
            body={`Your configured analysis service receives the normalised ${before === null ? 'after photo' : 'photos'}, without location data, when you choose Analyse. Nothing is sent before that.`}
            title={before === null ? 'Photo will be sent' : 'Photos will be sent'}
            tone="info"
          />
          <Text style={styles.body}>{modeText(before !== null)}</Text>
        </>
      )}

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          You stay in control
        </Text>
        <Text style={styles.body}>
          Suggestions are not counted until you review them. You can also mark every hit yourself.
        </Text>
      </View>

      {block === null || config === null ? null : (
        <Text style={styles.blocked}>{ANALYSIS_BLOCK_TEXT[block]}</Text>
      )}
      {stored === null ? null : stored.tone === 'error' ? (
        <Banner
          body={`${storedPrefix}${stored.text}`}
          title={analysisErrorTitle(latest?.errorCode ?? '')}
          tone="error"
        />
      ) : (
        <Text style={styles.body}>{`${storedPrefix}${stored.text}`}</Text>
      )}
      {message === null ? null : message.tone === 'error' ? (
        <Banner body={message.text} title={message.title} tone="error" />
      ) : (
        <Banner body={message.text} tone={message.tone} />
      )}

      {pending > 0 ? (
        <>
          <Banner
            body={`Review or remove every suggestion before confirming. ${pending === 1 ? '1 suggestion' : `${pending} suggestions`} to review.`}
            title="Review required"
            tone="warning"
          />
          <Button label="Review hits" onPress={onOpenEditor} />
          {canAnalyse ? <Button label="Analyse again" onPress={start} variant="secondary" /> : null}
        </>
      ) : (
        <>
          {canAnalyse ? (
            <Button
              icon={Target}
              label={lastFailed ? 'Try again' : 'Analyse photos'}
              onPress={start}
            />
          ) : null}
          {offerAfterOnly ? (
            <>
              <Button
                label="Analyse after photo only"
                onPress={() => void run(true)}
                variant="secondary"
              />
              <Text style={styles.caption}>
                Without the before photo, old holes under stickers can look like new ones and the
                number columns are not searched. Review every suggestion.
              </Text>
            </>
          ) : null}
          <Button
            disabled={after === null || photosMissing}
            icon={Plus}
            label={draft.marks.length > 0 ? 'Review hits' : 'Mark hits manually'}
            onPress={onOpenEditor}
            variant={canAnalyse ? 'secondary' : 'primary'}
          />
        </>
      )}

      <ConfirmDialog
        body="Suggestions you haven't accepted or changed are replaced. Hits you marked, accepted or edited stay."
        cancelLabel="Keep current"
        confirmLabel="Replace suggestions"
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => void run()}
        title="Replace the suggestions to review?"
        visible={confirmReplace}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.field,
  },
  card: {
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  title: {
    ...typography.section,
    color: colors.text,
    flexShrink: 1,
  },
  body: {
    ...typography.body,
    color: colors.secondary,
  },
  caption: {
    ...typography.caption,
    color: colors.secondary,
  },
  blocked: {
    ...typography.body,
    color: colors.error,
  },
});
