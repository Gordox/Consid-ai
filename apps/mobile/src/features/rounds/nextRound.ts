import type { SessionDatabase } from '../../persistence/database';
import {
  DraftRoundExistsError,
  SessionFinishedError,
  startRound,
} from '../../persistence/roundRepository';

// Where the user goes after asking for a new round. The repository decides inside one
// transaction: a finished session gets no round, and a session with a draft gets no second one.
export type NextRoundOutcome =
  | { readonly kind: 'open'; readonly roundId: string }
  | { readonly kind: 'sessionFinished' }
  | { readonly kind: 'failed'; readonly error: unknown };

export async function startNextRound(
  db: SessionDatabase,
  input: {
    readonly sessionId: string;
    readonly actualShots: number;
    readonly targetId: string;
    readonly newId: () => string;
    readonly now: () => string;
  },
): Promise<NextRoundOutcome> {
  const roundId = input.newId();
  try {
    await startRound(db, {
      roundId,
      sessionId: input.sessionId,
      createdAtUtc: input.now(),
      actualShots: input.actualShots,
      targetId: input.targetId,
    });
    return { kind: 'open', roundId };
  } catch (error) {
    if (error instanceof DraftRoundExistsError) {
      // Already started (e.g. by a repeated tap): open that draft instead of a second one.
      return { kind: 'open', roundId: error.draftRoundId };
    }
    if (error instanceof SessionFinishedError) {
      return { kind: 'sessionFinished' };
    }
    return { kind: 'failed', error };
  }
}

// Synchronous guard for actions that navigate away. React state updates too late to stop a
// second tap in the same frame; this refuses it at once. After a navigation the guard stays
// closed, because the screen is leaving; it reopens only when the action failed.
export type ActionGuard = {
  tryEnter(): boolean;
  release(): void;
};

export function createActionGuard(): ActionGuard {
  let busy = false;
  return {
    tryEnter() {
      if (busy) return false;
      busy = true;
      return true;
    },
    release() {
      busy = false;
    },
  };
}
