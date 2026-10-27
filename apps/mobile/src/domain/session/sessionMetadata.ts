// Lowercase canonical UUID v4, as produced by randomUUID(). Other spellings are rejected
// rather than normalized so the same ID cannot be stored in two forms.
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Exactly the shape of Date.prototype.toISOString() for four-digit years.
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// IANA-style names such as Europe/Stockholm or UTC; excludes offsets like +01:00.
const TIME_ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;
const TIME_ZONE_MAX_LENGTH = 64;

export function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}

export function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !UTC_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }
  // Date silently rolls impossible dates over (2026-02-30 becomes 2026-03-02),
  // so the value must survive a round trip unchanged.
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

// Zone data comes from the JavaScript engine, so Hermes on the device may differ from Node.
export function isTimeZone(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length > TIME_ZONE_MAX_LENGTH ||
    !TIME_ZONE_PATTERN.test(value)
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }
    throw error;
  }
}
