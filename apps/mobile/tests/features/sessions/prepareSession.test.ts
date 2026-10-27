import type { SessionFormInput } from '../../../src/domain/session/session';
import { prepareSession } from '../../../src/features/sessions/prepareSession';

const VALID_INPUT: SessionFormInput = {
  firearmName: ' Glock 17 ',
  firearmType: 'pistol',
  calibreLabel: '9×19 mm',
  distanceMetres: '25,5',
  plannedShotsPerRound: '10',
  plannedRounds: '',
};

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function deps() {
  return {
    newId: jest.fn(() => ID),
    now: jest.fn(() => '2026-10-27T13:00:00.000Z'),
    timeZone: jest.fn(() => 'Europe/Stockholm'),
  };
}

describe('prepareSession', () => {
  it('builds a full snapshot from the input and the injected id, time and time zone', () => {
    expect(prepareSession(VALID_INPUT, deps())).toEqual({
      ok: true,
      value: {
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
      },
    });
  });

  it('returns the domain field errors and creates no id for invalid input', () => {
    const injected = deps();
    const result = prepareSession(
      { ...VALID_INPUT, firearmType: null, distanceMetres: '0' },
      injected,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid',
        fieldErrors: { firearmType: 'required', distanceMetres: 'outOfRange' },
      },
    });
    expect(injected.newId).not.toHaveBeenCalled();
    expect(injected.now).not.toHaveBeenCalled();
  });

  it('reports prepareFailed when the time zone cannot be read', () => {
    const injected = {
      ...deps(),
      timeZone: () => {
        throw new Error('no time zone');
      },
    };
    expect(prepareSession(VALID_INPUT, injected)).toEqual({
      ok: false,
      error: { kind: 'prepareFailed' },
    });
  });

  it.each([
    ['an invalid id', { newId: () => 'not-a-uuid' }],
    ['an invalid timestamp', { now: () => '2026-02-30T00:00:00.000Z' }],
    ['an invalid time zone', { timeZone: () => 'Foo/Bar' }],
  ])('reports prepareFailed for %s', (_label, override) => {
    expect(prepareSession(VALID_INPUT, { ...deps(), ...override })).toEqual({
      ok: false,
      error: { kind: 'prepareFailed' },
    });
  });
});
