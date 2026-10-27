import { openDatabaseAsync } from 'expo-sqlite';
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { colors } from '../../components/tokens';
import { DATABASE_NAME } from '../../persistence/database';
import { openSessionDatabase } from '../../persistence/openSessionDatabase';
import { createSaveCoordinator } from '../sessions/saveCoordinator';
import { createDatabaseLifecycle } from './databaseLifecycle';
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
    openAndMigrate: () =>
      openSessionDatabase({
        open: () => openDatabaseAsync(DATABASE_NAME),
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

  useEffect(() => {
    lifecycle.activate();
    return () => lifecycle.deactivate();
  }, [lifecycle]);

  if (state.status === 'failed') {
    return <StartupErrorScreen errorKind={state.errorKind} onRetry={lifecycle.retry} />;
  }
  if (state.status === 'loading') {
    return (
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
  }
  return (
    <SessionStoreContext.Provider value={state.store}>{children}</SessionStoreContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
