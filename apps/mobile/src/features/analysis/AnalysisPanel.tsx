import { useState } from 'react';
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
} from '../../persistence/analysisRepository';
import {
  ANALYSIS_TIMEOUT_MS,
  type AnalysisPhoto,
  requestAnalysis,
} from '../../services/analysis/analysisClient';
import { readAnalysisConfig } from '../../services/analysis/analysisConfig';
import { newId, nowUtcIso } from '../../services/deviceContext';
import type { PhotoStore } from '../../services/photoStorage';
import { usePhotoStore } from '../startup/photoStoreContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import { ANALYSIS_ERROR_TEXT, suggestionSummary } from './analysisText';
import { candidatesToMarks, DEMO_ALGORITHM_VERSION, demoCandidates } from './suggestions';

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
  onChanged,
}: {
  draft: DraftRound;
  photosMissing: boolean;
  onChanged: () => void;
}) {
  const { db } = useSessionStore();
  const photos = usePhotoStore();
  const [config] = useState(readAnalysisConfig);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<AttemptSource | null>(null);
  const target = findTarget(draft.targetId);
  const after = draft.photos.after;
  const hasSuggestions = draft.marks.some((mark) => mark.source === 'suggested');

  async function run(source: AttemptSource): Promise<void> {
    setConfirmReplace(null);
    if (running || after === null || target === null) return;
    setRunning(true);
    setMessage(null);
    const attemptId = newId();
    try {
      await createAnalysisAttempt(db, {
        attemptId,
        roundId: draft.id,
        source,
        createdAtUtc: nowUtcIso(),
      });
      if (source === 'demo') {
        const candidates =
          draft.calibration === null ? null : demoCandidates(draft.calibration, target);
        if (candidates === null) {
          await failAnalysisAttempt(db, attemptId, 'calibrationNeeded');
          setMessage({
            tone: 'error',
            text: 'Calibrate the after photo before adding demo suggestions.',
          });
          return;
        }
        await applyAnalysisResult(db, {
          attemptId,
          roundId: draft.id,
          algorithmVersion: DEMO_ALGORITHM_VERSION,
          resultJson: JSON.stringify({ candidates }),
          suggestions: candidatesToMarks(candidates, newId),
        });
        setMessage({
          tone: 'info',
          text: 'Demo suggestions added. They are fixed positions, not analysis of your photo.',
        });
        onChanged();
        return;
      }
      if (config === null) return;
      const result = await requestAnalysis(
        config,
        {
          roundId: draft.id,
          attemptId,
          targetId: draft.targetId,
          after: toAnalysisPhoto(after, photos),
          before:
            draft.photos.before === null ? null : toAnalysisPhoto(draft.photos.before, photos),
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
      });
      setMessage(
        outcome === 'stale'
          ? { tone: 'error', text: ANALYSIS_ERROR_TEXT.stale }
          : {
              tone: 'info',
              text: suggestionSummary(result.value.candidates.length, result.value.warnings),
            },
      );
      onChanged();
    } catch (error) {
      reportDevError(error);
      setMessage({
        tone: 'error',
        text: "Couldn't save the analysis. Your photos and marks are kept. Try again.",
      });
    } finally {
      setRunning(false);
    }
  }

  const start = (source: AttemptSource) =>
    hasSuggestions ? setConfirmReplace(source) : void run(source);
  const ready = after !== null && !photosMissing;

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        Suggestions
      </Text>
      {config === null ? (
        <Text style={styles.body}>
          {"Automatic analysis isn't set up in this app yet. Mark hits yourself in the editor."}
        </Text>
      ) : (
        <>
          <Text style={styles.body}>
            {`Analyze sends your after photo${draft.photos.before === null ? '' : ' and before photo'} to ${config.host}. Nothing is sent until you tap Analyze. Suggestions must be checked before you confirm.`}
          </Text>
          <Button
            busy={running}
            disabled={!ready}
            label="Analyze photos"
            onPress={() => start('service')}
          />
        </>
      )}
      {__DEV__ ? (
        <>
          <Text style={styles.demo}>
            Development only: demo suggestions are fixed positions on the target, not analysis of
            your photo.
          </Text>
          <Button
            busy={running}
            disabled={!ready || draft.calibration === null}
            label="Add demo suggestions"
            onPress={() => start('demo')}
            variant="secondary"
          />
        </>
      ) : null}
      {message === null ? null : <Banner body={message.text} tone={message.tone} />}
      <ConfirmDialog
        body="Suggestions you haven't changed are replaced. Hits you marked or edited yourself stay."
        cancelLabel="Keep current"
        confirmLabel="Replace suggestions"
        onCancel={() => setConfirmReplace(null)}
        onConfirm={() => confirmReplace !== null && void run(confirmReplace)}
        title="Replace the current suggestions?"
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
  demo: {
    ...typography.supporting,
    color: colors.warning,
  },
});
