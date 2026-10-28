import type { SessionOverview } from '../../persistence/roundRepository';
import type { SessionListing } from '../../persistence/sessionRepository';
import { presentSession, type SessionCardText } from './formatSession';
import { type InvalidRowText, presentInvalidRows } from './invalidRowPresentation';
import {
  type SessionCardSummary,
  type SessionStatus,
  summarizeSessionCard,
} from './sessionProgressText';

// Sessions plus their status and round summaries, read together for the list.
export type ListingWithProgress = SessionListing & {
  readonly overviews: ReadonlyMap<string, SessionOverview>;
};

export type SessionItem = {
  readonly kind: 'session';
  readonly key: string;
  readonly text: SessionCardText;
  readonly summary: SessionCardSummary;
};

export type InvalidItem = {
  readonly kind: 'invalid';
  readonly key: string;
  readonly text: InvalidRowText;
};

export type ListItem = SessionItem | InvalidItem;

export type SessionFilter = 'all' | SessionStatus;

export const SESSION_FILTERS: readonly { readonly value: SessionFilter; readonly label: string }[] =
  [
    { value: 'all', label: 'All' },
    { value: 'inProgress', label: 'In progress' },
    { value: 'finished', label: 'Finished' },
  ];

// Valid sessions keep the order listSessions returns, keyed by their full id; unreadable rows
// follow them.
export function toListItems(listing: ListingWithProgress): ListItem[] {
  return [
    ...listing.sessions.map((session): ListItem => {
      const overview = listing.overviews.get(session.id);
      return {
        kind: 'session',
        key: session.id,
        text: presentSession(session),
        summary: summarizeSessionCard(overview?.finishedAtUtc ?? null, overview?.rounds ?? []),
      };
    }),
    ...presentInvalidRows(listing.invalidRows).map((text): ListItem => ({
      kind: 'invalid',
      key: text.key,
      text,
    })),
  ];
}

export type FilteredItems = {
  readonly sessions: readonly SessionItem[];
  // Unreadable rows have no known status, so they are kept in every filter, after the matches.
  readonly invalid: readonly InvalidItem[];
};

// Filtering is local presentation of each session's actual status; nothing is reread or moved.
export function filterItems(items: readonly ListItem[], filter: SessionFilter): FilteredItems {
  const sessions: SessionItem[] = [];
  const invalid: InvalidItem[] = [];
  for (const item of items) {
    if (item.kind === 'invalid') {
      invalid.push(item);
    } else if (filter === 'all' || item.summary.status === filter) {
      sessions.push(item);
    }
  }
  return { sessions, invalid };
}
