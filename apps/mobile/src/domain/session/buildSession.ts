import type { Result } from '../result';
import type { Session, SessionSettings, SettingsFieldErrors } from './session';
import { isSessionId, isTimeZone, isUtcTimestamp } from './sessionMetadata';
import { checkSessionSettings } from './validateSessionInput';

export type SessionMetadata = {
  readonly id: string;
  readonly createdAtUtc: string;
  readonly createdTimeZone: string;
};

export type SessionBuildErrors = {
  readonly id?: 'invalidId';
  readonly createdAtUtc?: 'invalidTimestamp';
  readonly createdTimeZone?: 'invalidTimeZone';
  readonly settings?: SettingsFieldErrors;
};

// Settings are re-checked because the SessionSettings type gives no runtime guarantee.
export function buildSession(
  settings: SessionSettings,
  metadata: SessionMetadata,
): Result<Session, SessionBuildErrors> {
  const checkedSettings = checkSessionSettings(settings);
  const validId = isSessionId(metadata.id);
  const validTimestamp = isUtcTimestamp(metadata.createdAtUtc);
  const validTimeZone = isTimeZone(metadata.createdTimeZone);

  if (checkedSettings.ok && validId && validTimestamp && validTimeZone) {
    return {
      ok: true,
      value: {
        id: metadata.id,
        createdAtUtc: metadata.createdAtUtc,
        createdTimeZone: metadata.createdTimeZone,
        settings: checkedSettings.value,
      },
    };
  }

  const errors: { -readonly [K in keyof SessionBuildErrors]: SessionBuildErrors[K] } = {};
  if (!validId) errors.id = 'invalidId';
  if (!validTimestamp) errors.createdAtUtc = 'invalidTimestamp';
  if (!validTimeZone) errors.createdTimeZone = 'invalidTimeZone';
  if (!checkedSettings.ok) errors.settings = checkedSettings.error;
  return { ok: false, error: errors };
}
