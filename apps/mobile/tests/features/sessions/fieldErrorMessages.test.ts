import type { SessionField, SessionFieldError } from '../../../src/domain/session/session';
import {
  CALIBRE_LABEL_MAX_CODE_POINTS,
  FIREARM_NAME_MAX_CODE_POINTS,
} from '../../../src/domain/session/sessionLimits';
import { fieldErrorMessage } from '../../../src/features/sessions/fieldErrorMessages';

const FIELDS: SessionField[] = [
  'firearmName',
  'firearmType',
  'calibreLabel',
  'distanceMetres',
  'plannedShotsPerRound',
  'plannedRounds',
];
const ERRORS: SessionFieldError[] = [
  'required',
  'tooLong',
  'invalidNumber',
  'tooManyDecimals',
  'outOfRange',
  'unsupportedValue',
];

describe('fieldErrorMessage', () => {
  it.each<[SessionField, SessionFieldError, string]>([
    ['firearmName', 'required', 'Enter a firearm name.'],
    ['firearmName', 'tooLong', 'Use 100 characters or fewer.'],
    ['firearmType', 'required', 'Choose a firearm type.'],
    ['firearmType', 'unsupportedValue', 'Choose a firearm type.'],
    ['calibreLabel', 'required', 'Enter a calibre.'],
    ['calibreLabel', 'tooLong', 'Use 50 characters or fewer.'],
    ['distanceMetres', 'required', 'Enter 0.1 to 1000 m, with at most one decimal.'],
    ['distanceMetres', 'invalidNumber', 'Enter 0.1 to 1000 m, with at most one decimal.'],
    ['distanceMetres', 'tooManyDecimals', 'Enter 0.1 to 1000 m, with at most one decimal.'],
    ['distanceMetres', 'outOfRange', 'Enter 0.1 to 1000 m, with at most one decimal.'],
    ['plannedShotsPerRound', 'required', 'Enter a whole number from 1 to 100.'],
    ['plannedShotsPerRound', 'invalidNumber', 'Enter a whole number from 1 to 100.'],
    ['plannedShotsPerRound', 'outOfRange', 'Enter a whole number from 1 to 100.'],
    ['plannedRounds', 'invalidNumber', 'Leave empty or enter 1 to 100.'],
    ['plannedRounds', 'outOfRange', 'Leave empty or enter 1 to 100.'],
  ])('shows the approved text for %s / %s', (field, error, expected) => {
    expect(fieldErrorMessage(field, error)).toBe(expected);
  });

  it('builds the length limits from the domain constants', () => {
    expect(fieldErrorMessage('firearmName', 'tooLong')).toContain(
      String(FIREARM_NAME_MAX_CODE_POINTS),
    );
    expect(fieldErrorMessage('calibreLabel', 'tooLong')).toContain(
      String(CALIBRE_LABEL_MAX_CODE_POINTS),
    );
  });

  it('returns a non-empty message for every field and error code', () => {
    for (const field of FIELDS) {
      for (const error of ERRORS) {
        expect(fieldErrorMessage(field, error).length).toBeGreaterThan(0);
      }
    }
  });
});
