import Plus from 'lucide-react-native/icons/plus';
import Target from 'lucide-react-native/icons/target';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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
import { uploadablePhoto } from './analysisPhotos';
import {
  ANALYSIS_BLOCK_TEXT,
  ANALYSIS_ERROR_TEXT,
  analysisBlock,
  analysisErrorTitle,
  latestAttemptText,
  modeText,
  suggestionSummary,
} from './analysisText';
import { candidatesToMarks, duplicateRadiusPx } from './suggestions';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Analysis error:', error instanceof Error ? error.name : typeof error);
  }
}

type Message =
  | { readonly tone: 'success' | 'info'; readonly text: string }
  | { readonly tone: 'error'; readonly title: string; readonly text: string };

function failure(code: string, text: string): Message {
  return { tone: 'error', title: analysisErrorTitle(code), text };
}

// Screens 08 (analyse or mark manually), 09 (analysing) and 15 (analysis unavailable). Nothing
// is sent until the user chooses Analyse; the manual path is always available.
export function AnalysisPanel({
  draft,
  photosMissing,
  running,
  onRunningChange,
  onChanged,
  onOpenEditor,
}: {
  draft: DraftRound;
  photosMissing: boolean;
  running: boolean;
  onRunningChange: (running: boolean) => void;
  onChanged: () => void;
  onOpenEditor: () => void;
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
    calibrated: draft.calibration !== null,
    targetKnown: target !== null,
  });

  async function run(): Promise<void> {
    setConfirmReplace(false);
    if (running || config === null || after === null || target === null) return;
    if (draft.calibration === null) return;
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
      const afterUpload = uploadablePhoto(after, photos.uri);
      const beforeUpload = before === null ? null : uploadablePhoto(before, photos.uri);
      if (afterUpload === null || (before !== null && beforeUpload === null)) {
        await failAnalysisAttempt(db, attemptId, 'oldPhotoCopy');
        setMessage(failure('oldPhotoCopy', ANALYSIS_BLOCK_TEXT.oldPhotoCopy));
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
        setMessage(failure(result.error, ANALYSIS_ERROR_TEXT[result.error]));
        return;
      }
      if (result.value.status !== 'succeeded') {
        await failAnalysisAttempt(db, attemptId, result.value.status);
        setMessage(failure(result.value.status, ANALYSIS_ERROR_TEXT[result.value.status]));
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
          ? failure('stale', ANALYSIS_ERROR_TEXT.stale)
          : { tone: 'success', text: suggestionSummary(outcome.added, result.value.warnings) },
      );
    } catch (error) {
      reportDevError(error);
      setMessage(
        failure('save', "Couldn't save the analysis. Your photos and marks are kept. Try again."),
      );
    } finally {
      onRunningChange(false);
      onChanged();
    }
  }

  const start = () => (pending > 0 ? setConfirmReplace(true) : void run());
  const stored =
    latest === null || running || message !== null ? null : latestAttemptText(latest, false);
  const lastFailed =
    (latest !== null && latest.status !== 'succeeded' && !running) || message?.tone === 'error';
  const canAnalyse = config !== null && block === null;
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
          saved; leaving this screen does not delete the round.
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
  blocked: {
    ...typography.body,
    color: colors.error,
  },
});
