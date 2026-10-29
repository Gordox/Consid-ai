import { isSessionId } from '../domain/session/sessionMetadata';

// Route params come from the URL and may be missing, repeated or malformed. Session and
// round ids share the lowercase UUID v4 format.
export function readIdParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && isSessionId(value) ? value : null;
}
