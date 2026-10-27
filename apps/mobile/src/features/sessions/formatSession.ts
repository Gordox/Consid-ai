import type { Session, SessionSettings } from '../../domain/session/session';
import { FIREARM_TYPE_LABELS } from './firearmTypeLabels';

// Text for a session card (docs/design/ui-ux.md §5.1). Pure so it can be tested in Node;
// Node tests use an explicit locale and time zone and do not verify Hermes on the device.

export type DateTimeFormatContext = {
  // Defaults follow the device: its locale, region, 12/24-hour setting and time zone (U10).
  readonly locale?: string;
  readonly timeZone?: string;
};

export type SessionCardText = {
  readonly title: string;
  readonly createdAt: string;
  readonly typeAndCalibre: string;
  readonly distanceAndShots: string;
  readonly plannedRounds: string;
  readonly accessibilityLabel: string;
};

// Local date and time of creation, shown in the device's time zone rather than the time zone
// stored with the session.
export function formatCreatedAt(createdAtUtc: string, context: DateTimeFormatContext = {}): string {
  return new Intl.DateTimeFormat(context.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: context.timeZone,
  }).format(new Date(createdAtUtc));
}

function formatShotsPerRound(shots: number): string {
  return shots === 1 ? '1 shot / round' : `${shots} shots / round`;
}

export function formatPlannedRounds(plannedRounds: number | null): string {
  if (plannedRounds === null) {
    return 'Not planned';
  }
  return plannedRounds === 1 ? '1 planned round' : `${plannedRounds} planned rounds`;
}

function formatTypeAndCalibre(settings: SessionSettings): string {
  return `${FIREARM_TYPE_LABELS[settings.firearmType]} · ${settings.calibreLabel}`;
}

function formatDistanceAndShots(settings: SessionSettings): string {
  return `${settings.distanceMetres} m · ${formatShotsPerRound(settings.plannedShotsPerRound)}`;
}

// Spoken as one group. Separators and "/" are replaced so screen readers do not read symbols.
function formatAccessibilityLabel(session: Session, createdAt: string): string {
  const { settings } = session;
  const shots =
    settings.plannedShotsPerRound === 1
      ? '1 shot per round'
      : `${settings.plannedShotsPerRound} shots per round`;
  const rounds =
    settings.plannedRounds === null
      ? 'Planned rounds: not planned'
      : formatPlannedRounds(settings.plannedRounds);
  return [
    settings.firearmName,
    createdAt,
    `${FIREARM_TYPE_LABELS[settings.firearmType]}, ${settings.calibreLabel}`,
    `${settings.distanceMetres} m, ${shots}`,
    rounds,
  ].join(', ');
}

export function presentSession(
  session: Session,
  context: DateTimeFormatContext = {},
): SessionCardText {
  const createdAt = formatCreatedAt(session.createdAtUtc, context);
  return {
    title: session.settings.firearmName,
    createdAt,
    typeAndCalibre: formatTypeAndCalibre(session.settings),
    distanceAndShots: formatDistanceAndShots(session.settings),
    plannedRounds: formatPlannedRounds(session.settings.plannedRounds),
    accessibilityLabel: formatAccessibilityLabel(session, createdAt),
  };
}
