import type { Result } from '../result';
import { isFirearmType, type FirearmType } from './firearmType';
import {
  checkDistanceMetres,
  checkWholeNumber,
  parseDistanceMetres,
  parseWholeNumber,
  type WholeNumberError,
} from './parseNumber';
import { normalizeLabel, parseLabel } from './parseText';
import type {
  SessionField,
  SessionFieldErrors,
  SessionFormInput,
  SessionSettings,
  SettingsFieldError,
  SettingsFieldErrors,
} from './session';
import {
  CALIBRE_LABEL_MAX_CODE_POINTS,
  FIREARM_NAME_MAX_CODE_POINTS,
  PLANNED_ROUNDS_RANGE,
  PLANNED_SHOTS_PER_ROUND_RANGE,
} from './sessionLimits';

const SESSION_FIELDS: readonly SessionField[] = [
  'firearmName',
  'firearmType',
  'calibreLabel',
  'distanceMetres',
  'plannedShotsPerRound',
  'plannedRounds',
];

function parseFirearmType(
  raw: string | null,
): Result<FirearmType, 'required' | 'unsupportedValue'> {
  if (raw === null || raw === '') {
    return { ok: false, error: 'required' };
  }
  return isFirearmType(raw) ? { ok: true, value: raw } : { ok: false, error: 'unsupportedValue' };
}

function parsePlannedRounds(raw: string): Result<number | null, WholeNumberError> {
  if (raw.trim() === '') {
    return { ok: true, value: null };
  }
  return parseWholeNumber(raw, PLANNED_ROUNDS_RANGE);
}

export function validateSessionInput(
  input: SessionFormInput,
): Result<SessionSettings, SessionFieldErrors> {
  const firearmName = parseLabel(input.firearmName, FIREARM_NAME_MAX_CODE_POINTS);
  const firearmType = parseFirearmType(input.firearmType);
  const calibreLabel = parseLabel(input.calibreLabel, CALIBRE_LABEL_MAX_CODE_POINTS);
  const distanceMetres = parseDistanceMetres(input.distanceMetres);
  const plannedShotsPerRound = parseWholeNumber(
    input.plannedShotsPerRound,
    PLANNED_SHOTS_PER_ROUND_RANGE,
  );
  const plannedRounds = parsePlannedRounds(input.plannedRounds);

  if (
    firearmName.ok &&
    firearmType.ok &&
    calibreLabel.ok &&
    distanceMetres.ok &&
    plannedShotsPerRound.ok &&
    plannedRounds.ok
  ) {
    return {
      ok: true,
      value: {
        firearmName: firearmName.value,
        firearmType: firearmType.value,
        calibreLabel: calibreLabel.value,
        distanceMetres: distanceMetres.value,
        plannedShotsPerRound: plannedShotsPerRound.value,
        plannedRounds: plannedRounds.value,
      },
    };
  }

  const errors: SessionFieldErrors = {};
  if (!firearmName.ok) errors.firearmName = firearmName.error;
  if (!firearmType.ok) errors.firearmType = firearmType.error;
  if (!calibreLabel.ok) errors.calibreLabel = calibreLabel.error;
  if (!distanceMetres.ok) errors.distanceMetres = distanceMetres.error;
  if (!plannedShotsPerRound.ok) errors.plannedShotsPerRound = plannedShotsPerRound.error;
  if (!plannedRounds.ok) errors.plannedRounds = plannedRounds.error;
  return { ok: false, error: errors };
}

function checkLabel(value: unknown, maxCodePoints: number): Result<string, SettingsFieldError> {
  if (typeof value !== 'string') {
    return { ok: false, error: 'invalidType' };
  }
  if (normalizeLabel(value) !== value) {
    return { ok: false, error: 'notNormalized' };
  }
  return parseLabel(value, maxCodePoints);
}

function checkFirearmType(value: unknown): Result<FirearmType, SettingsFieldError> {
  return typeof value === 'string' || value === null
    ? parseFirearmType(value)
    : { ok: false, error: 'invalidType' };
}

function checkNumber(
  value: unknown,
  check: (value: number) => SettingsFieldError | null,
): Result<number, SettingsFieldError> {
  if (typeof value !== 'number') {
    return { ok: false, error: 'invalidType' };
  }
  const error = check(value);
  return error === null ? { ok: true, value } : { ok: false, error };
}

// Re-checks values that are typed as SessionSettings but were not produced by
// validateSessionInput, e.g. stored rows. TypeScript types give no runtime guarantee.
export function checkSessionSettings(value: unknown): Result<SessionSettings, SettingsFieldErrors> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    const errors: SettingsFieldErrors = {};
    for (const field of SESSION_FIELDS) {
      errors[field] = 'invalidType';
    }
    return { ok: false, error: errors };
  }

  const firearmName = checkLabel(
    'firearmName' in value ? value.firearmName : undefined,
    FIREARM_NAME_MAX_CODE_POINTS,
  );
  const firearmType = checkFirearmType('firearmType' in value ? value.firearmType : undefined);
  const calibreLabel = checkLabel(
    'calibreLabel' in value ? value.calibreLabel : undefined,
    CALIBRE_LABEL_MAX_CODE_POINTS,
  );
  const distanceMetres = checkNumber(
    'distanceMetres' in value ? value.distanceMetres : undefined,
    checkDistanceMetres,
  );
  const plannedShotsPerRound = checkNumber(
    'plannedShotsPerRound' in value ? value.plannedShotsPerRound : undefined,
    (shots) => checkWholeNumber(shots, PLANNED_SHOTS_PER_ROUND_RANGE),
  );
  const rawPlannedRounds = 'plannedRounds' in value ? value.plannedRounds : undefined;
  const plannedRounds: Result<number | null, SettingsFieldError> =
    rawPlannedRounds === null
      ? { ok: true, value: null }
      : checkNumber(rawPlannedRounds, (rounds) => checkWholeNumber(rounds, PLANNED_ROUNDS_RANGE));

  if (
    firearmName.ok &&
    firearmType.ok &&
    calibreLabel.ok &&
    distanceMetres.ok &&
    plannedShotsPerRound.ok &&
    plannedRounds.ok
  ) {
    return {
      ok: true,
      value: {
        firearmName: firearmName.value,
        firearmType: firearmType.value,
        calibreLabel: calibreLabel.value,
        distanceMetres: distanceMetres.value,
        plannedShotsPerRound: plannedShotsPerRound.value,
        plannedRounds: plannedRounds.value,
      },
    };
  }

  const errors: SettingsFieldErrors = {};
  if (!firearmName.ok) errors.firearmName = firearmName.error;
  if (!firearmType.ok) errors.firearmType = firearmType.error;
  if (!calibreLabel.ok) errors.calibreLabel = calibreLabel.error;
  if (!distanceMetres.ok) errors.distanceMetres = distanceMetres.error;
  if (!plannedShotsPerRound.ok) errors.plannedShotsPerRound = plannedShotsPerRound.error;
  if (!plannedRounds.ok) errors.plannedRounds = plannedRounds.error;
  return { ok: false, error: errors };
}
