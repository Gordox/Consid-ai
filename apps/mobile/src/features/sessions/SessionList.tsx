import Activity from 'lucide-react-native/icons/activity';
import Plus from 'lucide-react-native/icons/plus';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  AccessibilityInfo,
  FlatList,
  StyleSheet,
  Text,
  type TextInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { colors, radius, spacing, typography } from '../../components/tokens';
import { listSessionOverviews, type SessionOverview } from '../../persistence/roundRepository';
import { listSessions, type SessionListing } from '../../persistence/sessionRepository';
import { useSessionStore } from '../startup/sessionStoreContext';
import { presentSession, type SessionCardText } from './formatSession';
import { InvalidSessionCard } from './InvalidSessionCard';
import { type InvalidRowText, presentInvalidRows } from './invalidRowPresentation';
import { SessionCard } from './SessionCard';
import { createSessionListController, type SessionListView } from './sessionListController';
import { formatProgressLine } from './sessionProgressText';

// Sessions plus their status and round summaries, read together for the list.
type ListingWithProgress = SessionListing & {
  readonly overviews: ReadonlyMap<string, SessionOverview>;
};

async function loadListing(db: Parameters<typeof listSessions>[0]): Promise<ListingWithProgress> {
  const listing = await listSessions(db);
  return { ...listing, overviews: await listSessionOverviews(db) };
}

type ListItem =
  | {
      readonly kind: 'session';
      readonly key: string;
      readonly text: SessionCardText;
      readonly progress: string;
    }
  | { readonly kind: 'invalid'; readonly key: string; readonly text: InvalidRowText };

// Valid sessions keep the order listSessions returns; unreadable rows follow them (Ö1).
// Valid sessions are keyed by their full id (U5).
function toListItems(listing: ListingWithProgress): ListItem[] {
  return [
    ...listing.sessions.map((session): ListItem => {
      const overview = listing.overviews.get(session.id);
      return {
        kind: 'session',
        key: session.id,
        text: presentSession(session),
        progress: formatProgressLine(overview?.finishedAtUtc ?? null, overview?.rounds ?? []),
      };
    }),
    ...presentInvalidRows(listing.invalidRows).map((text): ListItem => ({
      kind: 'invalid',
      key: text.key,
      text,
    })),
  ];
}

function LoadingCards() {
  return (
    <View accessible accessibilityLabel="Loading saved sessions…" style={styles.skeletonGroup}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.skeletonCard}>
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, styles.skeletonShort]} />
        </View>
      ))}
    </View>
  );
}

function EmptyState({ onNewSession }: { onNewSession: () => void }) {
  return (
    <View style={styles.empty}>
      <Icon icon={Activity} size="feature" color={colors.accent} />
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        Start your practice log
      </Text>
      <Text style={styles.body}>Keep session settings together, from your first round onward.</Text>
      <Button icon={Plus} label="New session" onPress={onNewSession} />
      <Text style={styles.footer}>No account needed. Records stay on this device.</Text>
    </View>
  );
}

type HeaderProps = {
  view: SessionListView<ListingWithProgress>;
  titleRef: RefObject<TextInstance | null>;
  onNewSession: () => void;
  onRetry: () => void;
};

function ListHeader({ view, titleRef, onNewSession, onRetry }: HeaderProps) {
  const isEmpty =
    view.status === 'loaded' &&
    view.listing.sessions.length === 0 &&
    view.listing.invalidRows.length === 0;

  return (
    <View style={styles.header}>
      <View style={styles.titleGroup}>
        <Text ref={titleRef} accessibilityRole="header" style={styles.pageTitle}>
          Sessions
        </Text>
        <Text style={styles.body}>Your practice, recorded.</Text>
      </View>

      {view.status === 'initialFailed' ? (
        <>
          <Banner
            body="Your saved records haven't been removed. Try reading them again."
            title="Sessions couldn't be loaded"
            tone="error"
          />
          <Button label="Try again" onPress={onRetry} />
          <Button icon={Plus} label="New session" onPress={onNewSession} variant="secondary" />
        </>
      ) : isEmpty ? null : (
        // Available while loading too: the database is ready once this screen renders.
        <Button icon={Plus} label="New session" onPress={onNewSession} />
      )}

      {view.status === 'loaded' && view.refreshFailed ? (
        <>
          <Banner
            body="Showing the sessions loaded earlier. Try again."
            title="Sessions couldn't be refreshed"
            tone="error"
          />
          <Button label="Try again" onPress={onRetry} variant="secondary" />
        </>
      ) : null}

      {view.status === 'initialLoading' ? <LoadingCards /> : null}
      {isEmpty ? <EmptyState onNewSession={onNewSession} /> : null}
    </View>
  );
}

export function SessionList() {
  const { db, coordinator } = useSessionStore();
  const router = useRouter();
  const titleRef = useRef<TextInstance>(null);
  const [controller] = useState(() =>
    createSessionListController({ coordinator, loadSessions: () => loadListing(db) }),
  );
  const view = useSyncExternalStore(controller.subscribe, controller.getView);

  useEffect(() => {
    controller.resume();
    return () => controller.dispose();
  }, [controller]);

  // Reads only while shown; returning to the list reads it again. Focus starts on the title,
  // including after Leave or Discard from the form.
  useFocusEffect(
    useCallback(() => {
      controller.setActive(true);
      if (titleRef.current !== null) {
        AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
      }
      return () => controller.setActive(false);
    }, [controller]),
  );

  useEffect(() => {
    if (view.status === 'initialLoading') {
      AccessibilityInfo.announceForAccessibility('Loading saved sessions…');
    }
  }, [view.status]);

  const items = useMemo(() => (view.status === 'loaded' ? toListItems(view.listing) : []), [view]);
  const showFooter = view.status === 'loaded' && items.length > 0;

  const openForm = () => router.push('/sessions/new');
  // Development only, and shown in every list state so it stays reachable after a read error.
  const devChecksLink = __DEV__ ? (
    <Button
      label="Developer checks"
      onPress={() => router.push('/dev/checks')}
      variant="secondary"
    />
  ) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item) => item.key}
        ListFooterComponent={
          <>
            {showFooter ? <Text style={styles.footer}>Saved locally on this device.</Text> : null}
            {devChecksLink}
          </>
        }
        ListHeaderComponent={
          <ListHeader
            onNewSession={openForm}
            onRetry={controller.retry}
            titleRef={titleRef}
            view={view}
          />
        }
        renderItem={({ item }) =>
          item.kind === 'session' ? (
            <SessionCard
              onPress={() => router.push(`/sessions/${item.key}`)}
              progress={item.progress}
              text={item.text}
            />
          ) : (
            <InvalidSessionCard onRetry={controller.retry} text={item.text} />
          )
        }
        style={styles.fill}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.field,
    padding: spacing.inset,
  },
  header: {
    gap: spacing.field,
  },
  titleGroup: {
    gap: spacing.fine,
  },
  pageTitle: {
    ...typography.pageTitle,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.secondary,
  },
  footer: {
    ...typography.supporting,
    color: colors.secondary,
  },
  empty: {
    gap: spacing.small,
    paddingTop: spacing.group,
  },
  emptyTitle: {
    ...typography.section,
    color: colors.text,
  },
  skeletonGroup: {
    gap: spacing.field,
  },
  skeletonCard: {
    gap: spacing.label,
    padding: spacing.field,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  skeletonLine: {
    height: spacing.small,
    borderRadius: radius.small,
    backgroundColor: colors.elevated,
  },
  skeletonTitle: {
    width: '50%',
    height: spacing.field,
  },
  skeletonShort: {
    width: '70%',
  },
});
