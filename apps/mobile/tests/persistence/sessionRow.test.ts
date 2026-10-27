import type { Session } from '../../src/domain/session/session';
import {
  parseSessionRow,
  SESSION_COLUMNS,
  sessionToRowParams,
} from '../../src/persistence/sessionRow';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const VALID_ROW = {
  id: ID,
  created_at_utc: '2026-10-27T13:00:00.000Z',
  created_time_zone: 'Europe/Stockholm',
  firearm_name: 'Glock 17',
  firearm_type: 'pistol',
  calibre_label: '9×19 mm',
  distance_m: 25.5,
  planned_shots_per_round: 10,
  planned_rounds: null,
};

const VALID_SESSION: Session = {
  id: ID,
  createdAtUtc: '2026-10-27T13:00:00.000Z',
  createdTimeZone: 'Europe/Stockholm',
  settings: {
    firearmName: 'Glock 17',
    firearmType: 'pistol',
    calibreLabel: '9×19 mm',
    distanceMetres: 25.5,
    plannedShotsPerRound: 10,
    plannedRounds: null,
  },
};

function withColumn(column: string, value: unknown): Record<string, unknown> {
  return { ...VALID_ROW, [column]: value };
}

function withoutColumn(column: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(VALID_ROW).filter(([key]) => key !== column));
}

describe('parseSessionRow', () => {
  it('maps a valid row to a session', () => {
    expect(parseSessionRow(VALID_ROW)).toEqual({ ok: true, value: VALID_SESSION });
  });

  it('maps planned rounds when present', () => {
    const result = parseSessionRow(withColumn('planned_rounds', 5));
    expect(result.ok && result.value.settings.plannedRounds).toBe(5);
  });

  it('ignores extra columns', () => {
    expect(parseSessionRow({ ...VALID_ROW, rowid: 7 })).toEqual({
      ok: true,
      value: VALID_SESSION,
    });
  });

  it('accepts a stored distance with float noise, as the domain does', () => {
    expect(parseSessionRow(withColumn('distance_m', 0.1 + 0.2)).ok).toBe(true);
  });

  it.each(SESSION_COLUMNS)('reports a missing %s column', (column) => {
    const result = parseSessionRow(withoutColumn(column));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.errors).toEqual({ [column]: 'missingColumn' });
  });

  it('keeps the id when another column is missing', () => {
    expect(parseSessionRow(withoutColumn('planned_rounds'))).toEqual({
      ok: false,
      error: { id: ID, errors: { planned_rounds: 'missingColumn' } },
    });
  });

  it.each([
    ['null', null],
    ['array', []],
    ['string', 'row'],
    ['number', 1],
  ])('reports every column as invalidType for a non-object (%s)', (_label, value) => {
    const result = parseSessionRow(value);
    expect(result).toEqual({
      ok: false,
      error: {
        id: null,
        errors: Object.fromEntries(SESSION_COLUMNS.map((column) => [column, 'invalidType'])),
      },
    });
  });

  it.each<[string, string, unknown, string]>([
    ['numeric id', 'id', 42, 'invalidType'],
    ['null id', 'id', null, 'invalidType'],
    ['uppercase id', 'id', ID.toUpperCase(), 'invalidId'],
    ['numeric timestamp', 'created_at_utc', 1761570000000, 'invalidType'],
    ['impossible date', 'created_at_utc', '2026-02-30T00:00:00.000Z', 'invalidTimestamp'],
    ['unknown time zone', 'created_time_zone', 'Foo/Bar', 'invalidTimeZone'],
    ['null firearm name', 'firearm_name', null, 'invalidType'],
    ['untrimmed firearm name', 'firearm_name', ' x', 'notNormalized'],
    ['NFD firearm name', 'firearm_name', 'é', 'notNormalized'],
    ['too long firearm name', 'firearm_name', 'a'.repeat(101), 'tooLong'],
    ['unknown firearm type', 'firearm_type', 'shotgun', 'unsupportedValue'],
    ['too long calibre', 'calibre_label', '9'.repeat(51), 'tooLong'],
    ['distance as text', 'distance_m', '25', 'invalidType'],
    ['null distance', 'distance_m', null, 'invalidType'],
    ['distance with two decimals', 'distance_m', 0.15, 'tooManyDecimals'],
    ['zero distance', 'distance_m', 0, 'outOfRange'],
    ['fractional shots', 'planned_shots_per_round', 1.5, 'invalidNumber'],
    ['too many shots', 'planned_shots_per_round', 101, 'outOfRange'],
    ['zero planned rounds', 'planned_rounds', 0, 'outOfRange'],
  ])('reports %s', (_label, column, value, expectedError) => {
    const result = parseSessionRow(withColumn(column, value));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.errors).toEqual({ [column]: expectedError });
  });

  it('returns null as id when the id itself is invalid', () => {
    const result = parseSessionRow(withColumn('id', 'not-a-uuid'));
    expect(!result.ok && result.error.id).toBeNull();
  });

  it('keeps a valid id when other columns are invalid', () => {
    const result = parseSessionRow(withColumn('created_at_utc', '2026-02-30T00:00:00.000Z'));
    expect(!result.ok && result.error.id).toBe(ID);
  });

  it('collects errors from several columns at once', () => {
    const row = {
      ...VALID_ROW,
      created_time_zone: '+01:00',
      firearm_type: 'shotgun',
      distance_m: 0.15,
      planned_rounds: 0,
    };
    expect(parseSessionRow(row)).toEqual({
      ok: false,
      error: {
        id: ID,
        errors: {
          created_time_zone: 'invalidTimeZone',
          firearm_type: 'unsupportedValue',
          distance_m: 'tooManyDecimals',
          planned_rounds: 'outOfRange',
        },
      },
    });
  });

  it('does not expose row values in the error', () => {
    const row = {
      ...VALID_ROW,
      firearm_name: ' Private Name',
      calibre_label: `Private ${'9'.repeat(60)}`,
      created_time_zone: 'Private/Zone',
    };
    const result = parseSessionRow(row);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('Private');
  });

  it('does not mutate the row', () => {
    const row = Object.freeze({ ...VALID_ROW, firearm_name: ' x' });
    const snapshot = { ...row };
    parseSessionRow(row);
    expect(row).toEqual(snapshot);
  });
});

describe('sessionToRowParams', () => {
  it('returns bind values in SESSION_COLUMNS order', () => {
    expect(sessionToRowParams(VALID_SESSION)).toEqual(
      SESSION_COLUMNS.map((column) => VALID_ROW[column]),
    );
  });

  it('round-trips through parseSessionRow', () => {
    const params = sessionToRowParams({
      ...VALID_SESSION,
      settings: { ...VALID_SESSION.settings, plannedRounds: 3 },
    });
    const row = Object.fromEntries(SESSION_COLUMNS.map((column, index) => [column, params[index]]));
    const result = parseSessionRow(row);
    expect(result.ok && result.value.settings.plannedRounds).toBe(3);
  });
});
