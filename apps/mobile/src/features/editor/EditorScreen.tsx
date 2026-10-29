import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, spacing, typography } from '../../components/tokens';
import type { DraftRound } from '../../domain/round/round';
import { getRound } from '../../persistence/roundRepository';
import { useRoundAnalysis } from '../analysis/useRoundAnalysis';
import { useSessionStore } from '../startup/sessionStoreContext';
import { useFocusLoad } from '../useFocusLoad';
import { HitEditor } from './HitEditor';

export function EditorScreen({ sessionId, roundId }: { sessionId: string; roundId: string }) {
  const { db, analysisRuns } = useSessionStore();
  const router = useRouter();
  const [lostChanges, setLostChanges] = useState(0);
  const { runningAttempt, cancelling } = useRoundAnalysis(analysisRuns, roundId);
  const analysisRunning = runningAttempt !== null;
  const load = useCallback(async (): Promise<DraftRound | null> => {
    const round = await getRound(db, roundId);
    return round?.state === 'draft' && round.sessionId === sessionId ? round : null;
  }, [db, roundId, sessionId]);
  const { state, reload } = useFocusLoad(load);

  // An analysis that ends while the editor is open may have added suggestions: read them.
  const wasRunning = useRef(analysisRunning);
  useEffect(() => {
    if (wasRunning.current && !analysisRunning) reload();
    wasRunning.current = analysisRunning;
  }, [analysisRunning, reload]);

  const onConflict = useCallback(
    (lost: number) => {
      setLostChanges(lost);
      reload();
    },
    [reload],
  );

  if (state.status === 'loaded' && state.data !== null) {
    // Keyed by round and revision: the editor starts from the saved annotations and then owns
    // them, until the draft is read again after a change made elsewhere.
    return (
      <HitEditor
        analysisRunning={analysisRunning}
        cancellingAnalysis={cancelling}
        draft={state.data}
        key={`${state.data.id}:${state.data.revision}`}
        lostChanges={lostChanges}
        onCancelAnalysis={() => analysisRuns.cancel(roundId)}
        onConflict={onConflict}
      />
    );
  }
  return (
    <Screen>
      <View style={styles.stack}>
        <ScreenHeader onBack={() => router.back()} title="Mark hits" />
        {state.status === 'loading' ? <Text style={styles.text}>Loading round…</Text> : null}
        {state.status === 'failed' ? (
          <>
            <Banner
              body="Your marks haven't been changed. Try again."
              title="Couldn't open the round"
              tone="error"
            />
            <Button label="Try again" onPress={reload} />
          </>
        ) : null}
        {state.status === 'loaded' ? (
          <Banner
            body="Only a round in progress can be edited. Confirmed rounds can't be changed."
            tone="error"
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
  text: {
    ...typography.body,
    color: colors.secondary,
  },
});
