import type { SQLiteBindValue } from 'expo-sqlite';

import type { Result } from '../domain/result';
import type { Session, SessionField, SettingsFieldError } from '../domain/session/session';
import { isSessionId, isTimeZone, isUtcTimestamp } from '../domain/session/sessionMetadata';
import { checkSessionSettings } from '../domain/session/validateSessionInput';

export const SESSION_COLUMNS = [
  'id',
  'created_at_utc',
  'created_time_zone',
  'firearm_name',
  'firearm_type',
  'calibre_label',
  'distance_m',
  'planned_shots_per_round',
  'planned_rounds',
] as const;

export type SessionColumn = (typeof SESSION_COLUMNS)[number];

export type SessionRowError =
  SettingsFieldError | 'missingColumn' | 'invalidId' | 'invalidTimestamp' | 'invalidTimeZone';

export type SessionRowErrors = Partial<Record<SessionColumn, SessionRowError>>;

// Names columns and reasons only. Row values never leave this module in an error,
// and the id is included only when it is itself a valid session ID.
export type InvalidSessionRow = {
  readonly id: string | null;
  readonly errors: SessionRowErrors;
};

const COLUMN_BY_SETTINGS_FIELD: Record<SessionField, SessionColumn> = {
  firearmName: 'firearm_name',
  firearmType: 'firearm_type',
  calibreLabel: 'calibre_label',
  distanceMetres: 'distance_m',
  plannedShotsPerRound: 'planned_shots_per_round',
  plannedRounds: 'planned_rounds',
};

function isSettingsField(key: string): key is SessionField {
  return Object.prototype.hasOwnProperty.call(COLUMN_BY_SETTINGS_FIELD, key);
}

function hasColumn(row: object, column: SessionColumn): boolean {
  return Object.prototype.hasOwnProperty.call(row, column);
}

function readColumn(row: object, column: SessionColumn): unknown {
  return hasColumn(row, column) ? Reflect.get(row, column) : undefined;
}

function checkMetadataColumn(
  value: unknown,
  isValid: (value: string) => boolean,
  error: SessionRowError,
): SessionRowError | null {
  if (typeof value !== 'string') {
    return 'invalidType';
  }
  return isValid(value) ? null : error;
}

export function parseSessionRow(row: unknown): Result<Session, InvalidSessionRow> {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    const errors: SessionRowErrors = {};
    for (const column of SESSION_COLUMNS) {
      errors[column] = 'invalidType';
    }
    return { ok: false, error: { id: null, errors } };
  }

  const errors: SessionRowErrors = {};
  for (const column of SESSION_COLUMNS) {
    if (!hasColumn(row, column)) {
      errors[column] = 'missingColumn';
    }
  }

  const id = readColumn(row, 'id');
  const createdAtUtc = readColumn(row, 'created_at_utc');
  const createdTimeZone = readColumn(row, 'created_time_zone');
  const metadataErrors: [SessionColumn, SessionRowError | null][] = [
    ['id', checkMetadataColumn(id, isSessionId, 'invalidId')],
    ['created_at_utc', checkMetadataColumn(createdAtUtc, isUtcTimestamp, 'invalidTimestamp')],
    ['created_time_zone', checkMetadataColumn(createdTimeZone, isTimeZone, 'invalidTimeZone')],
  ];
  for (const [column, error] of metadataErrors) {
    if (error !== null && errors[column] === undefined) {
      errors[column] = error;
    }
  }

  // Settings rules come only from the domain, including its float-noise epsilon for distance.
  const settings = checkSessionSettings({
    firearmName: readColumn(row, 'firearm_name'),
    firearmType: readColumn(row, 'firearm_type'),
    calibreLabel: readColumn(row, 'calibre_label'),
    distanceMetres: readColumn(row, 'distance_m'),
    plannedShotsPerRound: readColumn(row, 'planned_shots_per_round'),
    plannedRounds: readColumn(row, 'planned_rounds'),
  });
  if (!settings.ok) {
    for (const [field, error] of Object.entries(settings.error)) {
      if (!isSettingsField(field) || error === undefined) continue;
      const column = COLUMN_BY_SETTINGS_FIELD[field];
      if (errors[column] === undefined) {
        errors[column] = error;
      }
    }
  }

  if (
    settings.ok &&
    isSessionId(id) &&
    isUtcTimestamp(createdAtUtc) &&
    isTimeZone(createdTimeZone) &&
    Object.keys(errors).length === 0
  ) {
    return { ok: true, value: { id, createdAtUtc, createdTimeZone, settings: settings.value } };
  }
  return { ok: false, error: { id: isSessionId(id) ? id : null, errors } };
}

// Bind values in the same order as SESSION_COLUMNS.
export function sessionToRowParams(session: Session): SQLiteBindValue[] {
  const { settings } = session;
  return [
    session.id,
    session.createdAtUtc,
    session.createdTimeZone,
    settings.firearmName,
    settings.firearmType,
    settings.calibreLabel,
    settings.distanceMetres,
    settings.plannedShotsPerRound,
    settings.plannedRounds,
  ];
}
