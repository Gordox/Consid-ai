import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { colors, radius, spacing, typography } from '../../components/tokens';
import type { DraftRound, RoundPhoto } from '../../domain/round/round';
import { findTarget } from '../../domain/target/targetDefinition';
import {
  applyAnalysisResult,
  type AttemptSource,
  createAnalysisAttempt,
  failAnalysisAttempt,
  getLatestAttempt,
  type LatestAttempt,
} from '../../persistence/analysisRepository';
import {
  ANALYSIS_TIMEOUT_MS,
  type AnalysisPhoto,
  requestAnalysis,
} from '../../services/analysis/analysisClient';
import { readAnalysisConfig } from '../../services/analysis/analysisConfig';
import { newId, nowUtcIso } from '../../services/deviceContext';
import type { PhotoStore } from '../../services/photoStorage';
import { formatCreatedAt } from '../sessions/formatSession';
import { usePhotoStore } from '../startup/photoStoreContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import {
  ANALYSIS_BLOCK_TEXT,
  ANALYSIS_ERROR_TEXT,
  analysisBlock,
  latestAttemptText,
  modeText,
  suggestionSummary,
} from './analysisText';
import {
  candidatesToMarks,
  DEMO_ALGORITHM_VERSION,
  demoCandidates,
  duplicateRadiusPx,
} from './suggestions';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Analysis error:', error instanceof Error ? error.name : typeof error);
  }
}

function toAnalysisPhoto(photo: RoundPhoto, photos: PhotoStore): AnalysisPhoto {
  return {
    uri: photos.uri(photo.fileName),
    fileName: photo.fileName,
    width: photo.width,
    height: photo.height,
  };
}

type Message = { readonly tone: 'info' | 'error'; readonly text: string };

export function AnalysisPanel({
  draft,
  photosMissing,
  running,
  onRunningChange,
  onChanged,
}: {
  draft: DraftRound;
  photosMissing: boolean;
  running: boolean;
  onRunningChange: (running: boolean) => void;
  onChanged: () => void;
}) {
  const { db } = useSessionStore();
  const photos = usePhotoStore();
  const [config] = useState(readAnalysisConfig);
  const [message, setMessage] = useState<Message | null>(null);
  const [latest, setLatest] = useState<LatestAttempt | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<AttemptSource | null>(null);
  const target = findTarget(draft.targetId);
  const { after, before } = draft.photos;
  const pending = draft.marks.filter((mark) => !mark.accepted).length;

  // The stored attempt survives leaving the screen and restarts; reread when the round changes.
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
  }, [db, draft]);

  const block = analysisBlock({
    hasAfter: after !== null,
    photosMissing,
    oldPhotoCopy:
      (after !== null && after.originalFileName === null) ||
      (before !== null && before.originalFileName === null),
    calibrated: draft.calibration !== null,
    targetKnown: target !== null,
  });

  async function run(source: AttemptSource): Promise<void> {
    setConfirmReplace(null);
    if (running || after === null || target === null || draft.calibration === null) return;
    onRunningChange(true);
    setMessage(null);
    const attemptId = newId();
    try {
      await createAnalysisAttempt(db, {
        attemptId,
        roundId: draft.id,
        source,
        createdAtUtc: nowUtcIso(),
        afterFileName: after.fileName,
        beforeFileName: before?.fileName ?? null,
      });
      if (source === 'demo') {
        const candidates = demoCandidates(draft.calibration, target);
        if (candidates === null) {
          await failAnalysisAttempt(db, attemptId, 'calibrationNeeded');
          setMessage({ tone: 'error', text: ANALYSIS_BLOCK_TEXT.notCalibrated });
          return;
        }
        await applyAnalysisResult(db, {
          attemptId,
          roundId: draft.id,
          algorithmVersion: DEMO_ALGORITHM_VERSION,
          resultJson: JSON.stringify({ candidates }),
          suggestions: candidatesToMarks(candidates, newId),
          duplicateRadiusPx: duplicateRadiusPx(candidates, after),
        });
        setMessage({
          tone: 'info',
          text: 'Demo suggestions added. They are fixed positions, not analysis of your photo.',
        });
        return;
      }
      if (config === null) return;
      const result = await requestAnalysis(
        config,
        {
          roundId: draft.id,
          attemptId,
          targetId: draft.targetId,
          calibration: draft.calibration,
          after: toAnalysisPhoto(after, photos),
          before: before === null ? null : toAnalysisPhoto(before, photos),
        },
        {
          fetch: (url, init) => fetch(url, init),
          fileSize: (photo) => photos.size(photo.fileName),
          timeoutMs: ANALYSIS_TIMEOUT_MS,
        },
      );
      if (!result.ok) {
        await failAnalysisAttempt(db, attemptId, result.error);
        setMessage({ tone: 'error', text: ANALYSIS_ERROR_TEXT[result.error] });
        return;
      }
      if (result.value.status !== 'succeeded') {
        await failAnalysisAttempt(db, attemptId, result.value.status);
        setMessage({ tone: 'error', text: ANALYSIS_ERROR_TEXT[result.value.status] });
        return;
      }
      const outcome = await applyAnalysisResult(db, {
        attemptId,
        roundId: draft.id,
        algorithmVersion: result.value.algorithmVersion,
        resultJson: JSON.stringify(result.value),
        suggestions: candidatesToMarks(result.value.candidates, newId),
        duplicateRadiusPx: duplicateRadiusPx(result.value.candidates, after),
      });
      setMessage(
        outcome.kind === 'stale'
          ? { tone: 'error', text: ANALYSIS_ERROR_TEXT.stale }
          : { tone: 'info', text: suggestionSummary(outcome.added, result.value.warnings) },
      );
    } catch (error) {
      reportDevError(error);
      setMessage({
        tone: 'error',
        text: "Couldn't save the analysis. Your photos and marks are kept. Try again.",
      });
    } finally {
      onRunningChange(false);
      onChanged();
    }
  }

  const start = (source: AttemptSource) =>
    pending > 0 ? setConfirmReplace(source) : void run(source);
  const status = latest === null ? null : latestAttemptText(latest, running);
  const lastFailed = latest !== null && latest.status !== 'succeeded' && !running;

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        Suggestions
      </Text>
      {config === null ? (
        <Text style={styles.body}>
          {
            "Automatic analysis isn't set up in this app. Mark hits yourself in the editor. To use the local analysis service, see services/analysis/README.md."
          }
        </Text>
      ) : (
        <>
          <Text style={styles.body}>{modeText(before !== null)}</Text>
          <Text style={styles.body}>
            {`Analyze sends your after photo${before === null ? '' : ' and before photo'} (without location data) to ${config.host}. Nothing is sent until you tap Analyze.`}
          </Text>
          {block === null ? null : <Text style={styles.blocked}>{ANALYSIS_BLOCK_TEXT[block]}</Text>}
          <Button
            busy={running}
            disabled={block !== null}
            label={lastFailed ? 'Try analysis again' : 'Analyze photos'}
            onPress={() => start('service')}
          />
        </>
      )}
      {status === null || message !== null ? null : (
        <Text style={status.tone === 'error' ? styles.blocked : styles.body}>
          {latest === null ? '' : `${formatCreatedAt(latest.createdAtUtc)}: `}
          {status.text}
        </Text>
      )}
      {pending > 0 ? (
        <Text style={styles.pending}>
          {pending === 1
            ? '1 suggestion to review. Open the editor to accept or delete it.'
            : `${pending} suggestions to review. Open the editor to accept or delete them.`}
        </Text>
      ) : null}
      {__DEV__ ? (
        <>
          <Text style={styles.demo}>
            Development only: demo suggestions are fixed positions on the target, not analysis of
            your photo.
          </Text>
          <Button
            busy={running}
            disabled={block !== null}
            label="Add demo suggestions"
            onPress={() => start('demo')}
            variant="secondary"
          />
        </>
      ) : null}
      {message === null ? null : <Banner body={message.text} tone={message.tone} />}
      <ConfirmDialog
        body="Suggestions you haven't accepted or changed are replaced. Hits you marked, accepted or edited stay."
        cancelLabel="Keep current"
        confirmLabel="Replace suggestions"
        onCancel={() => setConfirmReplace(null)}
        onConfirm={() => confirmReplace !== null && void run(confirmReplace)}
        title="Replace the suggestions to review?"
        visible={confirmReplace !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.secondary,
  },
  blocked: {
    ...typography.body,
    color: colors.error,
  },
  pending: {
    ...typography.label,
    color: colors.warning,
  },
  demo: {
    ...typography.supporting,
    color: colors.warning,
  },
});
