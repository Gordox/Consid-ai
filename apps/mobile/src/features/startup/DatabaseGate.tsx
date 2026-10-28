import { openDatabaseAsync } from 'expo-sqlite';
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { colors } from '../../components/tokens';
import { DATABASE_NAME } from '../../persistence/database';
import { openSessionDatabase } from '../../persistence/openSessionDatabase';
import { createPhotoStore, PHOTO_FOLDER } from '../../services/photoStorage';
import { createSaveCoordinator } from '../sessions/saveCoordinator';
import { createDatabaseLifecycle } from './databaseLifecycle';
import { PhotoStoreContext } from './photoStoreContext';
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
    photoFolder: PHOTO_FOLDER,
    createCoordinator: () => createSaveCoordinator(),
    reportError: reportDevError,
  });
}

// Replaces SQLiteProvider; see implementation/step-5-create-session.md §3 for the reasons.
export function DatabaseGate({ children }: { children: ReactNode }) {
  const [lifecycle] = useState(createAppDatabaseLifecycle);
  const state = useSyncExternalStore(lifecycle.subscribe, lifecycle.getState);
  const store = state.status === 'ready' ? state.store : null;
  const photos = useMemo(
    () => (store === null ? null : createPhotoStore(store.photoFolder)),
    [store],
  );

  useEffect(() => {
    lifecycle.activate();
    return () => lifecycle.deactivate();
  }, [lifecycle]);

  let content: ReactNode;
  if (state.status === 'failed') {
    content = <StartupErrorScreen errorKind={state.errorKind} onRetry={lifecycle.retry} />;
  } else if (state.status === 'loading' || photos === null) {
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
      <SessionStoreContext.Provider value={state.store}>
        <PhotoStoreContext.Provider value={photos}>{children}</PhotoStoreContext.Provider>
      </SessionStoreContext.Provider>
    );
  }

  return <View style={styles.fill}>{content}</View>;
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
