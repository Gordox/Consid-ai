import {
  INVALID_ROW_MESSAGE,
  INVALID_ROW_TITLE,
  presentInvalidRows,
} from '../../../src/features/sessions/invalidRowPresentation';
import type { InvalidSessionRow, SessionRowError } from '../../../src/persistence/sessionRow';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function row(errors: InvalidSessionRow['errors'], id: string | null = ID): InvalidSessionRow {
  return { id, errors };
}

describe('presentInvalidRows', () => {
  it('uses the approved title and message', () => {
    expect(INVALID_ROW_TITLE).toBe('Unreadable session record');
    expect(INVALID_ROW_MESSAGE).toBe(
      "This record can't be opened. Other sessions are still available. The original record is kept.",
    );
  });

  it.each<[SessionRowError, string]>([
    ['missingColumn', 'Some saved details are missing or damaged.'],
    ['invalidType', 'Some saved details are missing or damaged.'],
    ['invalidId', 'The record ID is not valid.'],
    ['invalidTimestamp', 'The saved date and time are not valid.'],
    ['invalidTimeZone', 'The saved time zone is not valid.'],
    ['required', 'A saved text detail is not valid.'],
    ['tooLong', 'A saved text detail is not valid.'],
    ['notNormalized', 'A saved text detail is not valid.'],
    ['invalidNumber', 'A saved number is not valid.'],
    ['tooManyDecimals', 'A saved number is not valid.'],
    ['outOfRange', 'A saved number is not valid.'],
    ['unsupportedValue', 'The saved firearm type is not recognised.'],
  ])('translates %s to the approved text', (error, expected) => {
    expect(presentInvalidRows([row({ distance_m: error })])[0]?.reasons).toEqual([expected]);
  });

  it('lists each reason once, in the order of the design table', () => {
    const [text] = presentInvalidRows([
      row({
        planned_rounds: 'outOfRange',
        firearm_type: 'unsupportedValue',
        distance_m: 'tooManyDecimals',
        created_at_utc: 'invalidTimestamp',
        firearm_name: 'missingColumn',
      }),
    ]);
    expect(text?.reasons).toEqual([
      'Some saved details are missing or damaged.',
      'The saved date and time are not valid.',
      'A saved number is not valid.',
      'The saved firearm type is not recognised.',
    ]);
  });

  it('shows a short id visually and the full id to screen readers', () => {
    const [text] = presentInvalidRows([row({ distance_m: 'outOfRange' })]);
    expect(text?.idText).toBe('ID 3f2504e0');
    expect(text?.idAccessibilityLabel).toBe(`ID ${ID}`);
  });

  it('shows ID unavailable when the contract provides no id', () => {
    const [text] = presentInvalidRows([row({ id: 'invalidId' }, null)]);
    expect(text?.idText).toBe('ID unavailable');
    expect(text?.idAccessibilityLabel).toBe('ID unavailable');
  });

  it('exposes no error codes, column names or row values', () => {
    const texts = presentInvalidRows([
      row({ firearm_name: 'notNormalized', distance_m: 'tooManyDecimals' }),
      row({ created_time_zone: 'invalidTimeZone' }, null),
    ]);
    const serialized = JSON.stringify(texts.map(({ key: _key, ...visible }) => visible));
    for (const forbidden of [
      'notNormalized',
      'tooManyDecimals',
      'invalidTimeZone',
      'firearm_name',
      'distance_m',
      'created_time_zone',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('keys rows by the full id when available and by position otherwise', () => {
    const otherId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
    const keys = presentInvalidRows([
      row({ distance_m: 'outOfRange' }),
      row({ id: 'invalidId' }, null),
      row({ distance_m: 'outOfRange' }, otherId),
    ]).map((text) => text.key);
    expect(keys).toEqual([`invalid:${ID}`, 'invalid-position:1', `invalid:${otherId}`]);
  });

  it('keeps keys unique when rows share an id or both lack one', () => {
    const keys = presentInvalidRows([
      row({ distance_m: 'outOfRange' }),
      row({ firearm_type: 'unsupportedValue' }),
      row({ id: 'invalidId' }, null),
      row({ id: 'invalidId' }, null),
    ]).map((text) => text.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[1]).toBe(`invalid:${ID}#2`);
  });

  it('never produces a key that equals a valid session id', () => {
    const keys = presentInvalidRows([row({ distance_m: 'outOfRange' })]).map((text) => text.key);
    expect(keys).not.toContain(ID);
  });
});
