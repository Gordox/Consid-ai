import type { SessionField, SessionFieldError } from '../../domain/session/session';
import {
  CALIBRE_LABEL_MAX_CODE_POINTS,
  DISTANCE_TENTHS_RANGE,
  FIREARM_NAME_MAX_CODE_POINTS,
  PLANNED_ROUNDS_RANGE,
  PLANNED_SHOTS_PER_ROUND_RANGE,
} from '../../domain/session/sessionLimits';

// Field error copy from docs/design/ui-ux.md §6. Several error codes share one message per
// field; numbers come from the domain limits, never typed by hand.
export function fieldErrorMessage(field: SessionField, error: SessionFieldError): string {
  switch (field) {
    case 'firearmName':
      return error === 'tooLong'
        ? `Use ${FIREARM_NAME_MAX_CODE_POINTS} characters or fewer.`
        : 'Enter a firearm name.';
    case 'firearmType':
      return 'Choose a firearm type.';
    case 'calibreLabel':
      return error === 'tooLong'
        ? `Use ${CALIBRE_LABEL_MAX_CODE_POINTS} characters or fewer.`
        : 'Enter a calibre.';
    case 'distanceMetres':
      return `Enter ${DISTANCE_TENTHS_RANGE.min / 10} to ${DISTANCE_TENTHS_RANGE.max / 10} m, with at most one decimal.`;
    case 'plannedShotsPerRound':
      return `Enter a whole number from ${PLANNED_SHOTS_PER_ROUND_RANGE.min} to ${PLANNED_SHOTS_PER_ROUND_RANGE.max}.`;
    case 'plannedRounds':
      return `Leave empty or enter ${PLANNED_ROUNDS_RANGE.min} to ${PLANNED_ROUNDS_RANGE.max}.`;
  }
}
