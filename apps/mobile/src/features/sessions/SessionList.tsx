import Plus from 'lucide-react-native/icons/plus';
import Target from 'lucide-react-native/icons/target';
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
import { SegmentedControl } from '../../components/SegmentedControl';
import { colors, radius, spacing, typography } from '../../components/tokens';
import { listSessionOverviews } from '../../persistence/roundRepository';
import { listSessions } from '../../persistence/sessionRepository';
import { useSessionStore } from '../startup/sessionStoreContext';
import { InvalidSessionCard } from './InvalidSessionCard';
import { SessionCard } from './SessionCard';
import { createSessionListController, type SessionListView } from './sessionListController';
import {
  filterItems,
  type InvalidItem,
  type ListingWithProgress,
  SESSION_FILTERS,
  type SessionFilter,
  type SessionItem,
  toListItems,
} from './sessionListItems';

async function loadListing(db: Parameters<typeof listSessions>[0]): Promise<ListingWithProgress> {
  const listing = await listSessions(db);
  return { ...listing, overviews: await listSessionOverviews(db) };
}

type Row = SessionItem | InvalidItem | { readonly kind: 'invalidHeading'; readonly key: string };

// Hidden from screen readers: the list announces "Loading saved sessions…" once instead.
function LoadingCards() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.skeletonGroup}
    >
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

// Shown only after a successful read that returned no rows at all.
function EmptyState({ onNewSession }: { onNewSession: () => void }) {
  return (
    <View style={styles.empty}>
      <Icon icon={Target} size="feature" color={colors.accent} />
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
  isEmpty: boolean;
  hasRows: boolean;
  noMatches: boolean;
  filter: SessionFilter;
  onFilter: (filter: SessionFilter) => void;
  titleRef: RefObject<TextInstance | null>;
  onNewSession: () => void;
  onLibrary: () => void;
  onRetry: () => void;
};

function ListHeader({
  view,
  isEmpty,
  hasRows,
  noMatches,
  filter,
  onFilter,
  titleRef,
  onNewSession,
  onLibrary,
  onRetry,
}: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Icon icon={Target} size="feature" color={colors.accent} />
        <Text style={styles.eyebrow}>Target Practice</Text>
      </View>
      <View style={styles.titleGroup}>
        <Text ref={titleRef} accessibilityRole="header" style={styles.pageTitle}>
          Sessions
        </Text>
        <Text style={styles.body}>Your practice, recorded.</Text>
      </View>

      {view.status === 'initialFailed' ? (
        <>
          <Banner
            body="Try reading your saved sessions again."
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
      <Button label="Profiles and templates" onPress={onLibrary} variant="secondary" />

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

      {hasRows ? (
        <SegmentedControl
          label="Show sessions"
          onChange={onFilter}
          segments={SESSION_FILTERS}
          value={filter}
        />
      ) : null}
      {noMatches ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          No matching sessions
        </Text>
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
  const [filter, setFilter] = useState<SessionFilter>('all');
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
  const filtered = useMemo(() => filterItems(items, filter), [items, filter]);
  const isEmpty = view.status === 'loaded' && items.length === 0;
  const noMatches = items.length > 0 && filtered.sessions.length === 0;
  const rows: Row[] = [
    ...filtered.sessions,
    // In a filtered view, unreadable rows are records outside the filtered results.
    ...(filtered.invalid.length > 0 && filter !== 'all'
      ? [{ kind: 'invalidHeading', key: 'invalid-heading' } as const]
      : []),
    ...filtered.invalid,
  ];

  const openForm = () => router.push('/sessions/new');

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(row) => row.key}
        ListFooterComponent={
          items.length > 0 ? (
            <Text style={styles.footer}>Saved locally on this device.</Text>
          ) : undefined
        }
        ListHeaderComponent={
          <ListHeader
            filter={filter}
            hasRows={items.length > 0}
            isEmpty={isEmpty}
            noMatches={noMatches}
            onFilter={setFilter}
            onLibrary={() => router.push('/library')}
            onNewSession={openForm}
            onRetry={controller.retry}
            titleRef={titleRef}
            view={view}
          />
        }
        renderItem={({ item }) => {
          switch (item.kind) {
            case 'session':
              return (
                <SessionCard
                  onPress={() => router.push(`/sessions/${item.key}`)}
                  summary={item.summary}
                  text={item.text}
                />
              );
            case 'invalidHeading':
              return (
                <Text style={styles.body}>
                  {
                    "Records that couldn't be read are shown in every filter, because their status is unknown."
                  }
                </Text>
              );
            case 'invalid':
              return <InvalidSessionCard onRetry={controller.retry} text={item.text} />;
          }
        }}
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
    gap: spacing.group,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.secondary,
  },
  titleGroup: {
    gap: spacing.fine,
  },
  pageTitle: {
    ...typography.display,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.secondary,
  },
  footer: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
  },
  empty: {
    gap: spacing.small,
    paddingTop: spacing.label,
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
