import { isSessionId, isTimeZone, isUtcTimestamp } from '../../src/domain/session/sessionMetadata';

describe('isSessionId', () => {
  it.each(['3f2504e0-4f89-41d3-9a0c-0305e82c3301', '00000000-0000-4000-8000-000000000000'])(
    'accepts lowercase UUID v4 %p',
    (value) => {
      expect(isSessionId(value)).toBe(true);
    },
  );

  it.each([
    ['empty string', ''],
    ['uppercase', '3F2504E0-4F89-41D3-9A0C-0305E82C3301'],
    ['braces', '{3f2504e0-4f89-41d3-9a0c-0305e82c3301}'],
    ['no hyphens', '3f2504e04f8941d39a0c0305e82c3301'],
    ['nil UUID', '00000000-0000-0000-0000-000000000000'],
    ['version 1', '3f2504e0-4f89-11d3-9a0c-0305e82c3301'],
    ['wrong variant', '3f2504e0-4f89-41d3-7a0c-0305e82c3301'],
    ['surrounding space', ' 3f2504e0-4f89-41d3-9a0c-0305e82c3301 '],
    ['number', 42],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(isSessionId(value)).toBe(false);
  });
});

describe('isUtcTimestamp', () => {
  it.each(['2026-10-27T13:00:00.000Z', '2024-02-29T00:00:00.000Z', '2026-12-31T23:59:59.999Z'])(
    'accepts %p',
    (value) => {
      expect(isUtcTimestamp(value)).toBe(true);
    },
  );

  it.each([
    ['30 February', '2026-02-30T00:00:00.000Z'],
    ['29 February in a non-leap year', '2026-02-29T00:00:00.000Z'],
    ['31 April', '2026-04-31T10:00:00.000Z'],
    ['hour 24', '2026-01-01T24:00:00.000Z'],
    ['month 13', '2026-13-01T00:00:00.000Z'],
    ['missing milliseconds', '2026-10-27T13:00:00Z'],
    ['offset instead of Z', '2026-10-27T14:00:00.000+01:00'],
    ['space instead of T', '2026-10-27 13:00:00.000Z'],
    ['no zone designator', '2026-10-27T13:00:00.000'],
    ['lowercase z', '2026-10-27T13:00:00.000z'],
    ['date only', '2026-10-27'],
    ['empty string', ''],
    ['number', 1761570000000],
    ['Date object', new Date('2026-10-27T13:00:00.000Z')],
  ])('rejects %s', (_label, value) => {
    expect(isUtcTimestamp(value)).toBe(false);
  });
});

describe('isTimeZone', () => {
  it.each(['Europe/Stockholm', 'UTC', 'America/Argentina/Buenos_Aires', 'Etc/GMT+5'])(
    'accepts %p',
    (value) => {
      expect(isTimeZone(value)).toBe(true);
    },
  );

  it.each([
    ['empty string', ''],
    ['unknown zone', 'Foo/Bar'],
    ['UTC offset', '+01:00'],
    ['leading space', ' Europe/Stockholm'],
    ['trailing slash', 'Europe/'],
    ['longer than 64 characters', 'A'.repeat(65)],
    ['number', 42],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(isTimeZone(value)).toBe(false);
  });
});
