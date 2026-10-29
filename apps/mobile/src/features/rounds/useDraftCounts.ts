import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { DraftRound } from '../../domain/round/round';
import type { SessionDatabase } from '../../persistence/database';
import {
  type DraftCounts,
  DraftChangedError,
  updateDraftCounts,
} from '../../persistence/roundRepository';
import { createDraftWriteQueue, type DraftWriteQueue, type WriteOutcome } from './draftWriteQueue';

function countsOf(draft: DraftRound): DraftCounts {
  return {
    actualShots: draft.actualShots,
    declaredMisses: draft.declaredMisses,
    unresolvedShots: draft.unresolvedShots,
    hitDiameterMm: draft.hitDiameterMm,
    hitDiameterSource: draft.hitDiameterSource,
  };
}

// Shot counts and hole diameter of a draft. Local state answers immediately and every change is
// written in order, each based on the draft revision this screen showed (draftWriteQueue.ts).
// When the screen reads the draft again, the stored values and revision are taken over unless
// a local change is still being written. If the draft changed elsewhere, the queued changes are
// dropped, onConflict asks the screen to read it again, and lostChanges says how many were lost.
export function useDraftCounts(
  db: SessionDatabase,
  draft: DraftRound,
  reportError: (error: unknown) => void,
  onConflict: () => void,
): {
  counts: DraftCounts;
  change: (next: DraftCounts) => void;
  // Settles when every change made so far has been written, has failed or was dropped.
  written: () => Promise<WriteOutcome>;
  // The draft revision after this screen's own successful writes.
  revision: () => number;
  saveFailed: boolean;
  lostChanges: number;
} {
  const [counts, setCounts] = useState<DraftCounts>(() => countsOf(draft));
  const [lost, setLost] = useState(0);
  const makeQueue = (revision: number): DraftWriteQueue<DraftCounts> =>
    createDraftWriteQueue({
      initialRevision: revision,
      write: (next, expectedRevision) => updateDraftCounts(db, draft.id, expectedRevision, next),
      isConflict: (error) => error instanceof DraftChangedError,
      reportError,
    });
  const [queue, setQueue] = useState(() => makeQueue(draft.revision));
  const status = useSyncExternalStore(queue.subscribe, queue.status);

  // A newly read draft is taken over while rendering (React's pattern for state that follows a
  // prop), but only when no own change is still being written.
  const [seenDraft, setSeenDraft] = useState(draft);
  if (seenDraft !== draft) {
    setSeenDraft(draft);
    const current = queue.status();
    if (current.pending === 0 && (draft.revision !== queue.revision() || current.lostChanges > 0)) {
      setQueue(makeQueue(draft.revision));
      setCounts(countsOf(draft));
      if (current.lostChanges > 0) setLost(current.lostChanges);
    }
  }

  const reported = useRef(false);
  useEffect(() => {
    if (status.lostChanges > 0 && !reported.current) {
      reported.current = true;
      onConflict();
    }
    if (status.lostChanges === 0) reported.current = false;
  }, [status.lostChanges, onConflict]);

  function change(next: DraftCounts): void {
    setCounts(next);
    setLost(0);
    queue.enqueue(next);
  }

  return {
    counts,
    change,
    written: () => queue.settled(),
    revision: () => queue.revision(),
    saveFailed: status.failed,
    lostChanges: Math.max(lost, status.lostChanges),
  };
}
