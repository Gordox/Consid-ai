import { useEffect, useRef, useState } from 'react';

import type { DraftRound } from '../../domain/round/round';
import type { SessionDatabase } from '../../persistence/database';
import { type DraftCounts, updateDraftCounts } from '../../persistence/roundRepository';

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
// written in order. When the screen reads the draft again (after another screen changed the
// counts) the stored values are taken over, unless a local change is still being written.
export function useDraftCounts(
  db: SessionDatabase,
  draft: DraftRound,
  reportError: (error: unknown) => void,
): {
  counts: DraftCounts;
  change: (next: DraftCounts) => void;
  // Settles when every change made so far has been written (or has failed).
  written: () => Promise<void>;
  saveFailed: boolean;
} {
  const [counts, setCounts] = useState<DraftCounts>(() => countsOf(draft));
  const [saveFailed, setSaveFailed] = useState(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);

  useEffect(() => {
    if (pending.current === 0) {
      setCounts(countsOf(draft));
    }
  }, [draft]);

  function change(next: DraftCounts): void {
    setCounts(next);
    pending.current += 1;
    writes.current = writes.current
      .then(() => updateDraftCounts(db, draft.id, next))
      .then(
        () => setSaveFailed(false),
        (error: unknown) => {
          reportError(error);
          setSaveFailed(true);
        },
      )
      .finally(() => {
        pending.current -= 1;
      });
  }

  return { counts, change, written: () => writes.current, saveFailed };
}
