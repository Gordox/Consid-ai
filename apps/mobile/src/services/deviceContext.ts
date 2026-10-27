import { randomUUID } from 'expo-crypto';

import { isTimeZone } from '../domain/session/sessionMetadata';

// Device-dependent inputs for a new session. Kept out of the domain so tests can inject them.

export function nowUtcIso(): string {
  return new Date().toISOString();
}

// Throws when the engine cannot report a valid IANA time zone; the form then shows
// "Couldn't prepare session" and nothing is saved.
export function deviceTimeZone(): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!isTimeZone(timeZone)) {
    throw new Error('The device time zone is unavailable or invalid');
  }
  return timeZone;
}

// Session ids are lowercase canonical UUID v4 (isSessionId). Lowercasing a freshly generated
// id is safe and guards against a platform returning upper case.
export function newSessionId(): string {
  return randomUUID().toLowerCase();
}
