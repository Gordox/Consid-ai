import { useSyncExternalStore } from 'react';

import type { AnalysisRunOutcome } from './analysisRun';
import type { AnalysisRuns, FinishedRun } from './analysisRuns';

// The analysis state of one round in the app's registry. The running attempt id and the last
// finished run are what the round, editor and confirm screens all read, so they always agree.
export function useRoundAnalysis(
  runs: AnalysisRuns<AnalysisRunOutcome>,
  roundId: string,
): {
  readonly runningAttempt: string | null;
  readonly cancelling: boolean;
  readonly lastFinished: FinishedRun<AnalysisRunOutcome> | null;
} {
  const runningAttempt = useSyncExternalStore(runs.subscribe, () => runs.runningAttempt(roundId));
  const cancelling = useSyncExternalStore(runs.subscribe, () => runs.isCancelling(roundId));
  const lastFinished = useSyncExternalStore(runs.subscribe, () => runs.lastFinished(roundId));
  return { runningAttempt, cancelling, lastFinished };
}
