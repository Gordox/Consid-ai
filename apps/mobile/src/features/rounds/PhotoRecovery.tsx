import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { spacing } from '../../components/tokens';
import { clearPendingPick, readPendingPick } from '../../persistence/pendingPhotoPick';
import { getRound } from '../../persistence/roundRepository';
import { takePendingPickerResult } from '../../services/photoPicker';
import { usePhotoStore } from '../startup/photoStoreContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import { recoverPendingPick, type RecoveryOutcome } from './pendingPickRecovery';
import { cleanAbandonedPhotos, photoSaveDeps } from './photoActions';
import { savePickedPhoto } from './roundPhotos';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Photo recovery error:', error instanceof Error ? error.name : typeof error);
  }
}

const NOT_SAVED_TEXT = {
  noPhoto:
    'Taking or choosing a photo was interrupted when the app closed, and no photo came back. Take or choose it again.',
  roundClosed:
    'A photo came back after the app was closed, but its round is no longer in progress. Nothing was changed.',
  saveFailed:
    "A photo came back after the app was closed, but it couldn't be saved. Take or choose it again.",
} as const;

// Runs once each time a database opens: first saves a photo Android delivered after the app's
// activity was recreated during a pick, then removes abandoned photo copies (photoActions.ts).
export function PhotoRecovery() {
  const { db } = useSessionStore();
  const photos = usePhotoStore();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function run(): Promise<void> {
      let outcome: RecoveryOutcome = { kind: 'nothingPending' };
      try {
        outcome = await recoverPendingPick({
          readPending: () => readPendingPick(db),
          takePendingResult: takePendingPickerResult,
          savePhoto: async (pick, picked) => {
            await savePickedPhoto(
              pick.role,
              picked,
              photoSaveDeps(db, photos, pick.roundId, reportDevError),
            );
          },
          clearPending: () => clearPendingPick(db),
          reportError: reportDevError,
        });
      } catch (error) {
        reportDevError(error);
      }
      if (active && outcome.kind !== 'nothingPending') {
        const round = await getRound(db, outcome.pick.roundId).catch(() => null);
        if (!active) return;
        if (outcome.kind === 'saved') {
          setNotice(
            `The ${outcome.pick.role} photo you took or chose before the app was closed was saved.`,
          );
        } else {
          setNotice(NOT_SAVED_TEXT[outcome.reason]);
        }
        if (round !== null && round.state === 'draft') {
          router.push(`/sessions/${round.sessionId}/rounds/${round.id}`);
        }
      }
      // Cleanup only after recovery, so a recovered photo is already referenced.
      try {
        await cleanAbandonedPhotos(db, photos, Date.now(), reportDevError);
      } catch (error) {
        // Unused copies only waste space; the next start tries again.
        reportDevError(error);
      }
    }
    void run();
    return () => {
      active = false;
    };
  }, [db, photos, router]);

  if (notice === null) {
    return null;
  }
  return (
    <SafeAreaView edges={['top']} style={styles.notice}>
      <Banner body={notice} tone="info">
        <Button label="OK" onPress={() => setNotice(null)} variant="secondary" />
      </Banner>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  notice: {
    paddingHorizontal: spacing.inset,
    paddingTop: spacing.small,
  },
});
