import type { Result } from '../../domain/result';
import { buildSession } from '../../domain/session/buildSession';
import type { Session, SessionFieldErrors, SessionFormInput } from '../../domain/session/session';
import { validateSessionInput } from '../../domain/session/validateSessionInput';

export type PrepareSessionDeps = {
  newId: () => string;
  now: () => string;
  timeZone: () => string;
};

export type PrepareSessionError =
  | { readonly kind: 'invalid'; readonly fieldErrors: SessionFieldErrors }
  // Id, time or time zone could not be produced or validated. No save was attempted.
  | { readonly kind: 'prepareFailed' };

// Builds the full session snapshot (id, time, time zone, settings) that a save and every
// Retry send unchanged. Validation comes only from the domain.
export function prepareSession(
  input: SessionFormInput,
  deps: PrepareSessionDeps,
): Result<Session, PrepareSessionError> {
  const settings = validateSessionInput(input);
  if (!settings.ok) {
    return { ok: false, error: { kind: 'invalid', fieldErrors: settings.error } };
  }

  let metadata: { id: string; createdAtUtc: string; createdTimeZone: string };
  try {
    metadata = { id: deps.newId(), createdAtUtc: deps.now(), createdTimeZone: deps.timeZone() };
  } catch {
    return { ok: false, error: { kind: 'prepareFailed' } };
  }

  const session = buildSession(settings.value, metadata);
  return session.ok ? session : { ok: false, error: { kind: 'prepareFailed' } };
}
