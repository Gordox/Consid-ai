import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { colors, radius, spacing, typography } from '../../components/tokens';
import type { DraftRound } from '../../domain/round/round';
import { findTarget } from '../../domain/target/targetDefinition';
import {
  applyAnalysisResult,
  createAnalysisAttempt,
  failAnalysisAttempt,
  getLatestAttempt,
  type LatestAttempt,
} from '../../persistence/analysisRepository';
import {
  ANALYSIS_TIMEOUT_MS,
  requestAnalysis,
  UPLOAD_CHECK_BYTES,
} from '../../services/analysis/analysisClient';
import { readAnalysisConfig } from '../../services/analysis/analysisConfig';
import { newId, nowUtcIso } from '../../services/deviceContext';
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
import { uploadablePhoto } from './analysisPhotos';
import { candidatesToMarks, duplicateRadiusPx } from './suggestions';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Analysis error:', error instanceof Error ? error.name : typeof error);
  }
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
  const [confirmReplace, setConfirmReplace] = useState(false);
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

  async function run(): Promise<void> {
    setConfirmReplace(false);
    if (running || after === null || target === null || draft.calibration === null) return;
    onRunningChange(true);
    setMessage(null);
    const attemptId = newId();
    try {
      await createAnalysisAttempt(db, {
        attemptId,
        roundId: draft.id,
        source: 'service',
        createdAtUtc: nowUtcIso(),
        afterFileName: after.fileName,
        beforeFileName: before?.fileName ?? null,
      });
      if (config === null) return;
      const afterUpload = uploadablePhoto(after, photos.uri);
      const beforeUpload = before === null ? null : uploadablePhoto(before, photos.uri);
      if (afterUpload === null || (before !== null && beforeUpload === null)) {
        await failAnalysisAttempt(db, attemptId, 'oldPhotoCopy');
        setMessage({ tone: 'error', text: ANALYSIS_BLOCK_TEXT.oldPhotoCopy });
        return;
      }
      const result = await requestAnalysis(
        config,
        {
          roundId: draft.id,
          attemptId,
          targetId: draft.targetId,
          calibration: draft.calibration,
          after: afterUpload,
          before: beforeUpload,
        },
        {
          fetch: (url, init) => fetch(url, init),
          fileSize: (photo) => photos.size(photo.fileName),
          readHead: (photo) => photos.readHead(photo.fileName, UPLOAD_CHECK_BYTES),
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

  const start = () => (pending > 0 ? setConfirmReplace(true) : void run());
  // While a request runs here, an older stored result would be misleading.
  const status = running
    ? ({ tone: 'info', text: 'Analysing… this can take up to a minute.' } as const)
    : latest === null
      ? null
      : latestAttemptText(latest, false);
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
            onPress={start}
          />
        </>
      )}
      {status === null || message !== null ? null : (
        <Text style={status.tone === 'error' ? styles.blocked : styles.body}>
          {running || latest === null ? '' : `${formatCreatedAt(latest.createdAtUtc)}: `}
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
      {message === null ? null : <Banner body={message.text} tone={message.tone} />}
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
});
