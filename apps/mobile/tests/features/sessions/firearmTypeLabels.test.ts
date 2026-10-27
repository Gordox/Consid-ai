import { FIREARM_TYPES } from '../../../src/domain/session/firearmType';
import { FIREARM_TYPE_LABELS } from '../../../src/features/sessions/firearmTypeLabels';

describe('FIREARM_TYPE_LABELS', () => {
  it('labels every firearm type with the approved English text', () => {
    expect(FIREARM_TYPES.map((type) => FIREARM_TYPE_LABELS[type])).toEqual([
      'Pistol',
      'Revolver',
      'Rifle',
      'Other',
    ]);
  });
});
