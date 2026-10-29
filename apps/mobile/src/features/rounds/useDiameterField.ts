import { useState } from 'react';

import {
  formatHitDiameterMm,
  type HitDiameterInputError,
  parseHitDiameterMm,
} from '../../domain/round/roundRules';
import type { DraftCounts } from '../../persistence/roundRepository';

const ERROR_TEXT: Record<HitDiameterInputError, string> = {
  required: 'Enter the hole diameter in millimetres.',
  invalidNumber: 'Enter a number, for example 9.65 or 9,65.',
  tooManyDecimals: 'Use at most two decimals.',
  outOfRange: 'Enter 1 to 30 mm.',
};

// What committing the typed text means for the saved counts. Pure, so the rule is tested
// without rendering.
export function diameterCommit(
  text: string,
  counts: DraftCounts,
):
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'invalid'; readonly error: string }
  | { readonly kind: 'committed'; readonly counts: DraftCounts; readonly text: string } {
  if (text === formatHitDiameterMm(counts.hitDiameterMm)) return { kind: 'unchanged' };
  const parsed = parseHitDiameterMm(text);
  if (!parsed.ok) return { kind: 'invalid', error: ERROR_TEXT[parsed.error] };
  if (parsed.value === counts.hitDiameterMm) return { kind: 'unchanged' };
  return {
    kind: 'committed',
    counts: { ...counts, hitDiameterMm: parsed.value, hitDiameterSource: 'userSet' },
    text: formatHitDiameterMm(parsed.value),
  };
}

export type DiameterCommit =
  // The text is the saved value; nothing to write.
  | 'unchanged'
  // A new valid value was handed to the counts queue; wait for it before moving on.
  | 'committed'
  // The text is not a valid diameter; it is kept and its error shown, nothing is written.
  | 'invalid';

// The hole diameter as typed. The raw text, the validated value and the saved value are kept
// apart: typing changes only the text, commit() validates it with the domain rule and hands a new
// value to the counts queue. Screens call commit() before moving on, so text that was never
// saved, or is invalid, is never silently replaced by the old diameter.
export function useDiameterField(
  counts: DraftCounts,
  change: (next: DraftCounts) => void,
): {
  text: string;
  error: string | undefined;
  onChangeText: (text: string) => void;
  commit: () => DiameterCommit;
} {
  const saved = formatHitDiameterMm(counts.hitDiameterMm);
  const [text, setText] = useState(saved);
  const [error, setError] = useState<string | undefined>(undefined);
  // A diameter saved elsewhere replaces the text only while the user has not typed in it.
  const [seen, setSeen] = useState(counts.hitDiameterMm);
  if (seen !== counts.hitDiameterMm) {
    setSeen(counts.hitDiameterMm);
    if (text === formatHitDiameterMm(seen)) {
      setText(saved);
      setError(undefined);
    }
  }

  return {
    text,
    error,
    onChangeText: (next) => {
      setText(next);
      setError(undefined);
    },
    commit() {
      const outcome = diameterCommit(text, counts);
      switch (outcome.kind) {
        case 'unchanged':
          setText(saved);
          return 'unchanged';
        case 'invalid':
          setError(outcome.error);
          return 'invalid';
        case 'committed':
          setText(outcome.text);
          setSeen(outcome.counts.hitDiameterMm);
          change(outcome.counts);
          return 'committed';
      }
    },
  };
}
