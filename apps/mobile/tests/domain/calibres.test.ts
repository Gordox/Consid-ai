import { isNamedCalibre, NAMED_CALIBRES, searchCalibres } from '../../src/domain/calibre/calibres';
import { validateSessionInput } from '../../src/domain/session/validateSessionInput';

describe('named calibres', () => {
  it('has unique names that pass the session calibre rules as they are', () => {
    const names = NAMED_CALIBRES.map((calibre) => calibre.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      const result = validateSessionInput({
        firearmName: 'P',
        firearmType: 'pistol',
        calibreLabel: name,
        distanceMetres: '25',
        plannedShotsPerRound: '5',
        plannedRounds: '',
      });
      expect(result.ok && result.value.calibreLabel).toBe(name);
    }
  });

  it('finds a calibre by an alias, ignoring case, spaces, dashes and ×', () => {
    expect(searchCalibres('9×19').map((calibre) => calibre.name)).toEqual(['9mm Luger']);
    expect(searchCalibres('22 lr').map((calibre) => calibre.name)).toContain('22 Long Rifle');
    expect(searchCalibres('3006').map((calibre) => calibre.name)).toEqual(['30-06 Springfield']);
    expect(searchCalibres('')).toHaveLength(NAMED_CALIBRES.length);
    expect(searchCalibres('no such calibre')).toEqual([]);
  });

  it('treats existing free text and aliases as custom values, never converting them', () => {
    expect(isNamedCalibre('9mm Luger')).toBe(true);
    // Earlier free text, an alias and a near spelling all stay as they were saved.
    expect(isNamedCalibre('9×19 mm')).toBe(false);
    expect(isNamedCalibre('9x19mm')).toBe(false);
    expect(isNamedCalibre('9mm luger')).toBe(false);
  });
});
