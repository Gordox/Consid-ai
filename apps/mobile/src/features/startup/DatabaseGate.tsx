import { openDatabaseAsync } from 'expo-sqlite';
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { colors } from '../../components/tokens';
import { openSessionDatabase } from '../../persistence/openSessionDatabase';
import { assertDevelopment, databaseNameForMode } from '../dev-tools/testDatabases';
import { TestModeBanner } from '../dev-tools/TestModeBanner';
import { createSaveCoordinator } from '../sessions/saveCoordinator';
import { ContentOffsetContext } from './contentOffsetContext';
import { createDatabaseLifecycle, type DatabaseMode } from './databaseLifecycle';
import { type DatabaseModeControl, DatabaseModeContext } from './databaseModeContext';
import { SessionStoreContext } from './sessionStoreContext';
import { StartupErrorScreen } from './StartupErrorScreen';

// Logs only the error class, never messages or values that could contain user data.
function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Database lifecycle error:', error instanceof Error ? error.name : typeof error);
  }
}

function createAppDatabaseLifecycle() {
  return createDatabaseLifecycle({
    // The name is resolved per open, so the test database is guarded on every attempt.
    openAndMigrate: (mode) =>
      openSessionDatabase({
        open: () => openDatabaseAsync(databaseNameForMode(mode)),
        reportCloseFailure: reportDevError,
      }),
    createCoordinator: () => createSaveCoordinator(),
    reportError: reportDevError,
  });
}

// Replaces SQLiteProvider; see implementation/step-5-create-session.md §3 for the reasons.
export function DatabaseGate({ children }: { children: ReactNode }) {
  const [lifecycle] = useState(createAppDatabaseLifecycle);
  const state = useSyncExternalStore(lifecycle.subscribe, lifecycle.getState);
  const mode = useSyncExternalStore(lifecycle.subscribe, lifecycle.getMode);
  // Where the screens start below the test-mode banner; SessionForm needs it for the keyboard.
  const [measuredContentOffsetY, setMeasuredContentOffsetY] = useState(0);
  // Only the banner moves the content, so normal mode never reuses a value from test mode.
  const contentOffsetY = mode === 'test' ? measuredContentOffsetY : 0;
  const modeControl = useMemo<DatabaseModeControl>(
    () => ({
      mode,
      switchMode: (next: DatabaseMode) => {
        if (next === 'test') {
          assertDevelopment();
        }
        lifecycle.switchMode(next);
      },
    }),
    [lifecycle, mode],
  );

  useEffect(() => {
    lifecycle.activate();
    return () => lifecycle.deactivate();
  }, [lifecycle]);

  let content: ReactNode;
  if (state.status === 'failed') {
    content = <StartupErrorScreen errorKind={state.errorKind} onRetry={lifecycle.retry} />;
  } else if (state.status === 'loading') {
    content = (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator
            accessibilityLabel="Loading saved sessions…"
            color={colors.accent}
            size="large"
          />
        </View>
      </Screen>
    );
  } else {
    content = (
      <SessionStoreContext.Provider value={state.store}>{children}</SessionStoreContext.Provider>
    );
  }

  return (
    <DatabaseModeContext.Provider value={modeControl}>
      <View style={styles.fill}>
        {mode === 'test' ? <TestModeBanner /> : null}
        <View
          onLayout={(event: LayoutChangeEvent) => {
            setMeasuredContentOffsetY(event.nativeEvent.layout.y);
          }}
          style={styles.fill}
        >
          <ContentOffsetContext.Provider value={contentOffsetY}>
            {content}
          </ContentOffsetContext.Provider>
        </View>
      </View>
    </DatabaseModeContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
