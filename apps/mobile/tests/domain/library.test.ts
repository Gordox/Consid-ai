import {
  lastUsedActive,
  templateFormValues,
  validateProfileInput,
  validateTemplateInput,
} from '../../src/domain/library/library';

function saved(id: string, archivedAtUtc: string | null, lastUsedAtUtc: string | null) {
  return { id, createdAtUtc: 't', updatedAtUtc: 't', archivedAtUtc, lastUsedAtUtc };
}

describe('validateProfileInput', () => {
  it('normalises like the session form and keys errors by the same fields', () => {
    expect(
      validateProfileInput({
        firearmName: '  Club pistol ',
        firearmType: 'pistol',
        calibreLabel: '9×19mm',
      }),
    ).toEqual({
      ok: true,
      value: { firearmName: 'Club pistol', firearmType: 'pistol', calibreLabel: '9×19mm' },
    });
    expect(
      validateProfileInput({ firearmName: '', firearmType: null, calibreLabel: 'x'.repeat(51) }),
    ).toEqual({
      ok: false,
      error: { firearmName: 'required', firearmType: 'required', calibreLabel: 'tooLong' },
    });
  });

  it('keeps a custom calibre with combining accents as one normalised value', () => {
    const result = validateProfileInput({
      firearmName: 'P',
      firearmType: 'other',
      calibreLabel: '.22 Spécial',
    });
    expect(result.ok && result.value.calibreLabel).toBe('.22 Spécial');
  });
});

describe('validateTemplateInput', () => {
  it('stores no planned rounds as null, never 0', () => {
    const result = validateTemplateInput({
      name: 'Standard training',
      distanceMetres: '25',
      plannedShotsPerRound: '5',
      plannedRounds: '',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Standard training',
        distanceMetres: 25,
        plannedShotsPerRound: 5,
        plannedRounds: null,
      },
    });
    expect(result.ok && templateFormValues(result.value).plannedRounds).toBe('');
  });

  it('rejects 0 planned rounds and reports every field', () => {
    expect(
      validateTemplateInput({
        name: ' ',
        distanceMetres: '0',
        plannedShotsPerRound: '101',
        plannedRounds: '0',
      }),
    ).toEqual({
      ok: false,
      error: {
        name: 'required',
        distanceMetres: 'outOfRange',
        plannedShotsPerRound: 'outOfRange',
        plannedRounds: 'outOfRange',
      },
    });
  });
});

describe('lastUsedActive', () => {
  it('picks the most recently used active item', () => {
    const items = [
      saved('a', null, '2026-10-01T00:00:00.000Z'),
      saved('b', null, '2026-10-20T00:00:00.000Z'),
      saved('c', null, null),
    ];
    expect(lastUsedActive(items)?.id).toBe('b');
  });

  it('never suggests an archived item, even if it was used last', () => {
    const items = [
      saved('a', null, '2026-10-01T00:00:00.000Z'),
      saved('b', 't', '2026-10-20T00:00:00.000Z'),
    ];
    expect(lastUsedActive(items)?.id).toBe('a');
  });

  it('returns null when nothing active was used', () => {
    expect(
      lastUsedActive([saved('a', 't', '2026-10-20T00:00:00.000Z'), saved('b', null, null)]),
    ).toBeNull();
    expect(lastUsedActive([])).toBeNull();
  });
});
