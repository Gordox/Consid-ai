import type { Result } from '../result';
import type { FirearmType } from '../session/firearmType';
import { parseDistanceMetres, parseWholeNumber } from '../session/parseNumber';
import { parseLabel } from '../session/parseText';
import type { SessionFieldError, SessionFieldErrors } from '../session/session';
import {
  CALIBRE_LABEL_MAX_CODE_POINTS,
  FIREARM_NAME_MAX_CODE_POINTS,
  PLANNED_SHOTS_PER_ROUND_RANGE,
} from '../session/sessionLimits';
import { parseFirearmType, parsePlannedRounds } from '../session/validateSessionInput';

// Saved starting points for new sessions. A profile holds what describes the firearm, a template
// what describes the training; either only fills the session form. Sessions keep their own
// snapshot, so editing or archiving a profile or template never changes a saved session.

export const TEMPLATE_NAME_MAX_CODE_POINTS = 100;

export type FirearmProfileValues = {
  // Becomes the session's firearm name.
  readonly firearmName: string;
  readonly firearmType: FirearmType;
  readonly calibreLabel: string;
};

export type TrainingTemplateValues = {
  readonly name: string;
  readonly distanceMetres: number;
  readonly plannedShotsPerRound: number;
  // Null is "Not planned", never 0.
  readonly plannedRounds: number | null;
};

type Saved = {
  readonly id: string;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
  readonly archivedAtUtc: string | null;
  readonly lastUsedAtUtc: string | null;
};

export type FirearmProfile = Saved & FirearmProfileValues;
export type TrainingTemplate = Saved & TrainingTemplateValues;

export type ProfileInput = {
  readonly firearmName: string;
  readonly firearmType: string | null;
  readonly calibreLabel: string;
};

export type TemplateInput = {
  readonly name: string;
  readonly distanceMetres: string;
  readonly plannedShotsPerRound: string;
  readonly plannedRounds: string;
};

// Same field names, rules and messages as the session form.
export function validateProfileInput(
  input: ProfileInput,
): Result<FirearmProfileValues, SessionFieldErrors> {
  const firearmName = parseLabel(input.firearmName, FIREARM_NAME_MAX_CODE_POINTS);
  const firearmType = parseFirearmType(input.firearmType);
  const calibreLabel = parseLabel(input.calibreLabel, CALIBRE_LABEL_MAX_CODE_POINTS);
  if (firearmName.ok && firearmType.ok && calibreLabel.ok) {
    return {
      ok: true,
      value: {
        firearmName: firearmName.value,
        firearmType: firearmType.value,
        calibreLabel: calibreLabel.value,
      },
    };
  }
  const errors: SessionFieldErrors = {};
  if (!firearmName.ok) errors.firearmName = firearmName.error;
  if (!firearmType.ok) errors.firearmType = firearmType.error;
  if (!calibreLabel.ok) errors.calibreLabel = calibreLabel.error;
  return { ok: false, error: errors };
}

export type TemplateField = keyof TemplateInput;
export type TemplateFieldErrors = Partial<Record<TemplateField, SessionFieldError>>;

export function validateTemplateInput(
  input: TemplateInput,
): Result<TrainingTemplateValues, TemplateFieldErrors> {
  const name = parseLabel(input.name, TEMPLATE_NAME_MAX_CODE_POINTS);
  const distanceMetres = parseDistanceMetres(input.distanceMetres);
  const plannedShotsPerRound = parseWholeNumber(
    input.plannedShotsPerRound,
    PLANNED_SHOTS_PER_ROUND_RANGE,
  );
  const plannedRounds = parsePlannedRounds(input.plannedRounds);
  if (name.ok && distanceMetres.ok && plannedShotsPerRound.ok && plannedRounds.ok) {
    return {
      ok: true,
      value: {
        name: name.value,
        distanceMetres: distanceMetres.value,
        plannedShotsPerRound: plannedShotsPerRound.value,
        plannedRounds: plannedRounds.value,
      },
    };
  }
  const errors: TemplateFieldErrors = {};
  if (!name.ok) errors.name = name.error;
  if (!distanceMetres.ok) errors.distanceMetres = distanceMetres.error;
  if (!plannedShotsPerRound.ok) errors.plannedShotsPerRound = plannedShotsPerRound.error;
  if (!plannedRounds.ok) errors.plannedRounds = plannedRounds.error;
  return { ok: false, error: errors };
}

// The active item used most recently for a new session, or null. Archived items are never
// suggested, and an item never used is not "last used".
export function lastUsedActive<T extends Saved>(items: readonly T[]): T | null {
  let best: T | null = null;
  for (const item of items) {
    if (item.archivedAtUtc !== null || item.lastUsedAtUtc === null) continue;
    if (best === null || (best.lastUsedAtUtc ?? '') < item.lastUsedAtUtc) best = item;
  }
  return best;
}

// Form text for a profile or template, as the session form shows it.
export function profileFormValues(profile: FirearmProfileValues): ProfileInput {
  return {
    firearmName: profile.firearmName,
    firearmType: profile.firearmType,
    calibreLabel: profile.calibreLabel,
  };
}

export function templateFormValues(template: TrainingTemplateValues): Omit<TemplateInput, 'name'> {
  return {
    distanceMetres: String(template.distanceMetres),
    plannedShotsPerRound: String(template.plannedShotsPerRound),
    plannedRounds: template.plannedRounds === null ? '' : String(template.plannedRounds),
  };
}
