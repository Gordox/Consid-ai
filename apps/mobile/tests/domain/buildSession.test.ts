import { buildSession, type SessionMetadata } from '../../src/domain/session/buildSession';
import type { SessionSettings } from '../../src/domain/session/session';

const SETTINGS: SessionSettings = {
  firearmName: 'Glock 17',
  firearmType: 'pistol',
  calibreLabel: '9×19 mm',
  distanceMetres: 25.5,
  plannedShotsPerRound: 10,
  plannedRounds: null,
};

const METADATA: SessionMetadata = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  createdAtUtc: '2026-10-27T13:00:00.000Z',
  createdTimeZone: 'Europe/Stockholm',
};

describe('buildSession', () => {
  it('builds a session from valid settings and metadata', () => {
    const result = buildSession(SETTINGS, METADATA);
    expect(result).toEqual({
      ok: true,
      value: { ...METADATA, settings: SETTINGS },
    });
    expect(result.ok && result.value.settings).not.toBe(SETTINGS);
  });

  it('reports all invalid metadata at once', () => {
    const metadata: SessionMetadata = {
      id: 'not-a-uuid',
      createdAtUtc: '2026-02-30T00:00:00.000Z',
      createdTimeZone: 'Foo/Bar',
    };
    expect(buildSession(SETTINGS, metadata)).toEqual({
      ok: false,
      error: {
        id: 'invalidId',
        createdAtUtc: 'invalidTimestamp',
        createdTimeZone: 'invalidTimeZone',
      },
    });
  });

  it('re-checks settings that are well typed but invalid', () => {
    const settings: SessionSettings = { ...SETTINGS, distanceMetres: 0.15, plannedRounds: 0 };
    expect(buildSession(settings, METADATA)).toEqual({
      ok: false,
      error: { settings: { distanceMetres: 'tooManyDecimals', plannedRounds: 'outOfRange' } },
    });
  });

  it('rejects a firearm name that was not normalized', () => {
    const settings: SessionSettings = { ...SETTINGS, firearmName: ' Glock 17' };
    expect(buildSession(settings, METADATA)).toEqual({
      ok: false,
      error: { settings: { firearmName: 'notNormalized' } },
    });
  });

  it('reports metadata and settings errors together', () => {
    const settings: SessionSettings = { ...SETTINGS, plannedShotsPerRound: 0 };
    expect(buildSession(settings, { ...METADATA, id: '' })).toEqual({
      ok: false,
      error: { id: 'invalidId', settings: { plannedShotsPerRound: 'outOfRange' } },
    });
  });

  it('does not mutate its inputs', () => {
    const settings = Object.freeze({ ...SETTINGS });
    const metadata = Object.freeze({ ...METADATA });
    buildSession(settings, metadata);
    expect(settings).toEqual(SETTINGS);
    expect(metadata).toEqual(METADATA);
  });
});
