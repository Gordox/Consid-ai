import type { Session } from '../../../src/domain/session/session';
import {
  formatCreatedAt,
  formatPlannedRounds,
  presentSession,
} from '../../../src/features/sessions/formatSession';

// Dates use an explicit locale and time zone so the results are deterministic in Node.
// These tests do not verify Intl in Hermes on the device; that is manual check M5.
const SWEDEN_EN = { locale: 'en-GB', timeZone: 'Europe/Stockholm' };

const SESSION: Session = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  createdAtUtc: '2026-10-27T13:00:00.000Z',
  createdTimeZone: 'America/New_York',
  settings: {
    firearmName: 'Glock 17',
    firearmType: 'pistol',
    calibreLabel: '9×19 mm',
    distanceMetres: 25.5,
    plannedShotsPerRound: 10,
    plannedRounds: null,
  },
};

function withSettings(overrides: Partial<Session['settings']>): Session {
  return { ...SESSION, settings: { ...SESSION.settings, ...overrides } };
}

describe('formatCreatedAt', () => {
  it('shows local date and time in winter time', () => {
    expect(formatCreatedAt('2026-10-27T13:00:00.000Z', SWEDEN_EN)).toBe('27 Oct 2026, 14:00');
  });

  it('shows local date and time in summer time', () => {
    expect(formatCreatedAt('2026-07-01T13:00:00.000Z', SWEDEN_EN)).toBe('1 Jul 2026, 15:00');
  });

  it('follows the given locale and time zone', () => {
    expect(
      formatCreatedAt('2026-10-27T13:00:00.000Z', {
        locale: 'en-US',
        timeZone: 'America/New_York',
      }),
    ).toBe('Oct 27, 2026, 9:00 AM');
  });
});

describe('formatPlannedRounds', () => {
  it.each<[number | null, string]>([
    [null, 'Not planned'],
    [1, '1 planned round'],
    [2, '2 planned rounds'],
    [100, '100 planned rounds'],
  ])('formats %p as %p', (value, expected) => {
    expect(formatPlannedRounds(value)).toBe(expected);
  });
});

describe('presentSession', () => {
  it('builds the card lines in the approved order and format', () => {
    expect(presentSession(SESSION, SWEDEN_EN)).toEqual({
      title: 'Glock 17',
      createdAt: '27 Oct 2026, 14:00',
      typeAndCalibre: 'Pistol · 9×19 mm',
      distanceAndShots: '25.5 m · 10 shots / round',
      plannedRounds: 'Not planned',
      accessibilityLabel:
        'Glock 17, 27 Oct 2026, 14:00, Pistol, 9×19 mm, 25.5 m, 10 shots per round, Planned rounds: not planned',
    });
  });

  it('shows the time in the requested time zone, not the one stored with the session', () => {
    expect(presentSession(SESSION, SWEDEN_EN).createdAt).toBe('27 Oct 2026, 14:00');
  });

  it('shows whole-metre distances without decimals', () => {
    expect(presentSession(withSettings({ distanceMetres: 25 }), SWEDEN_EN).distanceAndShots).toBe(
      '25 m · 10 shots / round',
    );
  });

  it('uses the singular for one shot and one planned round', () => {
    const text = presentSession(
      withSettings({ plannedShotsPerRound: 1, plannedRounds: 1 }),
      SWEDEN_EN,
    );
    expect(text.distanceAndShots).toBe('25.5 m · 1 shot / round');
    expect(text.plannedRounds).toBe('1 planned round');
    expect(text.accessibilityLabel).toContain('1 shot per round');
    expect(text.accessibilityLabel).toContain('1 planned round');
  });

  it('shows planned rounds when set, never as zero', () => {
    const text = presentSession(withSettings({ plannedRounds: 5 }), SWEDEN_EN);
    expect(text.plannedRounds).toBe('5 planned rounds');
    expect(text.accessibilityLabel.endsWith('5 planned rounds')).toBe(true);
  });

  it.each([
    ['revolver', 'Revolver'],
    ['rifle', 'Rifle'],
    ['other', 'Other'],
  ] as const)('labels firearm type %s as %s', (firearmType, label) => {
    expect(presentSession(withSettings({ firearmType }), SWEDEN_EN).typeAndCalibre).toBe(
      `${label} · 9×19 mm`,
    );
  });

  it('keeps symbols out of the accessibility label', () => {
    const { accessibilityLabel } = presentSession(SESSION, SWEDEN_EN);
    expect(accessibilityLabel).not.toContain('·');
    expect(accessibilityLabel).not.toContain('/');
  });
});
