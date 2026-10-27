import { FIREARM_TYPES, isFirearmType } from '../../src/domain/session/firearmType';

describe('FIREARM_TYPES', () => {
  it('contains exactly the supported internal values', () => {
    expect(FIREARM_TYPES).toEqual(['pistol', 'revolver', 'rifle', 'other']);
  });
});

describe('isFirearmType', () => {
  it.each(['pistol', 'revolver', 'rifle', 'other'])('accepts %p', (value) => {
    expect(isFirearmType(value)).toBe(true);
  });

  it.each(['', 'Pistol', 'RIFLE', ' pistol', 'pistol ', 'shotgun', 'gevär'])(
    'rejects unknown string %p',
    (value) => {
      expect(isFirearmType(value)).toBe(false);
    },
  );

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['number', 1],
    ['boolean', true],
    ['array', ['pistol']],
    ['object', { value: 'pistol' }],
    ['String object', new String('pistol')],
    ['symbol', Symbol('pistol')],
  ])('rejects non-string value (%s)', (_label, value) => {
    expect(isFirearmType(value)).toBe(false);
  });
});
