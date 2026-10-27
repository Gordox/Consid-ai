import type { FirearmType } from './firearmType';

// Raw form values as typed by the user; nothing here is validated yet.
export type SessionFormInput = {
  readonly firearmName: string;
  readonly firearmType: string | null;
  readonly calibreLabel: string;
  readonly distanceMetres: string;
  readonly plannedShotsPerRound: string;
  readonly plannedRounds: string;
};

export type SessionField = keyof SessionFormInput;

export type SessionSettings = {
  readonly firearmName: string;
  readonly firearmType: FirearmType;
  readonly calibreLabel: string;
  readonly distanceMetres: number;
  readonly plannedShotsPerRound: number;
  readonly plannedRounds: number | null;
};

export type Session = {
  readonly id: string;
  readonly createdAtUtc: string;
  readonly createdTimeZone: string;
  readonly settings: SessionSettings;
};

export type SessionFieldError =
  'required' | 'tooLong' | 'invalidNumber' | 'tooManyDecimals' | 'outOfRange' | 'unsupportedValue';

export type SessionFieldErrors = Partial<Record<SessionField, SessionFieldError>>;

// Only reachable for values that did not come from the form, such as stored rows.
export type SettingsFieldError = SessionFieldError | 'invalidType' | 'notNormalized';

export type SettingsFieldErrors = Partial<Record<SessionField, SettingsFieldError>>;
