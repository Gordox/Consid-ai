import type { FirearmProfile, TrainingTemplate } from '../../../src/domain/library/library';
import type { SessionFormInput } from '../../../src/domain/session/session';
import {
  differsFromProfile,
  differsFromTemplate,
  newlyAdded,
  profileFields,
  templateFields,
} from '../../../src/features/sessions/startingPoints';

const saved = { createdAtUtc: 't', updatedAtUtc: 't', archivedAtUtc: null, lastUsedAtUtc: null };
const PROFILE: FirearmProfile = {
  ...saved,
  id: 'p1',
  firearmName: 'Club pistol',
  firearmType: 'pistol',
  calibreLabel: '9×19mm',
};
const TEMPLATE: TrainingTemplate = {
  ...saved,
  id: 't1',
  name: 'Standard training',
  distanceMetres: 25,
  plannedShotsPerRound: 5,
  plannedRounds: null,
};
const FORM: SessionFormInput = {
  firearmName: 'Club pistol',
  firearmType: 'pistol',
  calibreLabel: '9×19mm',
  distanceMetres: '25',
  plannedShotsPerRound: '5',
  plannedRounds: '',
};

describe('starting points', () => {
  it('fills only its own fields: a profile never touches training values, a template never the firearm', () => {
    expect(Object.keys(profileFields(PROFILE)).sort()).toEqual([
      'calibreLabel',
      'firearmName',
      'firearmType',
    ]);
    expect(templateFields(TEMPLATE)).toEqual({
      distanceMetres: '25',
      plannedShotsPerRound: '5',
      plannedRounds: '',
    });
  });

  it('notices a change from the profile, ignoring spacing the domain trims', () => {
    expect(differsFromProfile({ ...FORM, firearmName: ' Club pistol ' }, PROFILE)).toBe(false);
    expect(differsFromProfile({ ...FORM, calibreLabel: '.22 LR' }, PROFILE)).toBe(true);
    expect(differsFromProfile({ ...FORM, firearmType: null }, PROFILE)).toBe(true);
  });

  it('notices a change from the template, comparing numbers rather than text', () => {
    expect(differsFromTemplate({ ...FORM, distanceMetres: '25,0' }, TEMPLATE)).toBe(false);
    expect(differsFromTemplate({ ...FORM, plannedRounds: '3' }, TEMPLATE)).toBe(true);
  });

  it('finds the item created while the form was away', () => {
    expect(newlyAdded(new Set(['a']), [{ id: 'a' }, { id: 'b' }])?.id).toBe('b');
    expect(newlyAdded(new Set(['a']), [{ id: 'a' }])).toBeNull();
  });
});
