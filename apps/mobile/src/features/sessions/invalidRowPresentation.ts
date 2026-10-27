import type { InvalidSessionRow, SessionRowError } from '../../persistence/sessionRow';

// Presentation of unreadable rows (docs/design/ui-ux.md §5.3). Uses only what the persistence
// contract exposes: a valid id or null, and error codes. No column names, codes or values are shown.

export const INVALID_ROW_TITLE = 'Unreadable session record';
export const INVALID_ROW_MESSAGE =
  "This record can't be opened. Other sessions are still available. The original record is kept.";

const SHORT_ID_LENGTH = 8;

// Approved reason texts in the order of the table in §5.3.
const REASONS_IN_ORDER = [
  'Some saved details are missing or damaged.',
  'The record ID is not valid.',
  'The saved date and time are not valid.',
  'The saved time zone is not valid.',
  'A saved text detail is not valid.',
  'A saved number is not valid.',
  'The saved firearm type is not recognised.',
] as const;

type Reason = (typeof REASONS_IN_ORDER)[number];

const REASON_BY_ERROR: Record<SessionRowError, Reason> = {
  missingColumn: 'Some saved details are missing or damaged.',
  invalidType: 'Some saved details are missing or damaged.',
  invalidId: 'The record ID is not valid.',
  invalidTimestamp: 'The saved date and time are not valid.',
  invalidTimeZone: 'The saved time zone is not valid.',
  required: 'A saved text detail is not valid.',
  tooLong: 'A saved text detail is not valid.',
  notNormalized: 'A saved text detail is not valid.',
  invalidNumber: 'A saved number is not valid.',
  tooManyDecimals: 'A saved number is not valid.',
  outOfRange: 'A saved number is not valid.',
  unsupportedValue: 'The saved firearm type is not recognised.',
};

export type InvalidRowText = {
  readonly key: string;
  // Visual reference only (U5); never used as an identity.
  readonly idText: string;
  readonly idAccessibilityLabel: string;
  readonly reasons: readonly string[];
};

function reasonsFor(row: InvalidSessionRow): string[] {
  const present = new Set<Reason>();
  for (const error of Object.values(row.errors)) {
    if (error !== undefined) {
      present.add(REASON_BY_ERROR[error]);
    }
  }
  return REASONS_IN_ORDER.filter((reason) => present.has(reason));
}

// Keys use the full id when the contract provides one. A row without an id falls back to its
// position, which is unique within one result but not a stable identity across reloads; that is
// acceptable because the cards hold no state. A repeated base key gets a #n suffix.
export function presentInvalidRows(rows: readonly InvalidSessionRow[]): InvalidRowText[] {
  const usedKeys = new Map<string, number>();
  return rows.map((row, index) => {
    const baseKey = row.id === null ? `invalid-position:${index}` : `invalid:${row.id}`;
    const seen = usedKeys.get(baseKey) ?? 0;
    usedKeys.set(baseKey, seen + 1);
    return {
      key: seen === 0 ? baseKey : `${baseKey}#${seen + 1}`,
      idText: row.id === null ? 'ID unavailable' : `ID ${row.id.slice(0, SHORT_ID_LENGTH)}`,
      idAccessibilityLabel: row.id === null ? 'ID unavailable' : `ID ${row.id}`,
      reasons: reasonsFor(row),
    };
  });
}
