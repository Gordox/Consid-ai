// Every fired shot must be a hit, a declared miss or an unresolved shot before confirmation.
// Missing detections are never counted as misses, and no hits are invented to fill the count.

export type ShotCounts = {
  readonly actualShots: number;
  // Sum of shots per hole over all hit marks.
  readonly hitShots: number;
  readonly declaredMisses: number;
  readonly unresolvedShots: number;
};

export type AccountingStatus =
  | 'complete' // every shot is a hit or a miss
  | 'incomplete' // accounted for, but some shots are unresolved: only a subtotal is known
  | 'tooFew' // fewer shots recorded than fired
  | 'tooMany'; // more shots recorded than fired

export function accountShots(counts: ShotCounts): AccountingStatus {
  const recorded = counts.hitShots + counts.declaredMisses + counts.unresolvedShots;
  if (recorded < counts.actualShots) {
    return 'tooFew';
  }
  if (recorded > counts.actualShots) {
    return 'tooMany';
  }
  return counts.unresolvedShots > 0 ? 'incomplete' : 'complete';
}

export function canConfirm(status: AccountingStatus): boolean {
  return status === 'complete' || status === 'incomplete';
}

export type ScoredHit = { readonly value: number; readonly shots: number };

export type RoundScore = {
  // Sum of known hit values. Misses score 0; unresolved shots are unknown, not 0.
  readonly subtotal: number;
  // Only when every shot is known.
  readonly total: number | null;
};

export function scoreRound(hits: readonly ScoredHit[], status: AccountingStatus): RoundScore {
  const subtotal = hits.reduce((sum, hit) => sum + hit.value * hit.shots, 0);
  return { subtotal, total: status === 'complete' ? subtotal : null };
}
