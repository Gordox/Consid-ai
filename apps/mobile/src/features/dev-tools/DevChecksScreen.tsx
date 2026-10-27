import { deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, spacing, typography } from '../../components/tokens';
import { useDatabaseMode } from '../startup/databaseModeContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import { deleteTestDatabase, UI_CHECK_DATABASE_NAME } from './testDatabases';

type CleanupResult = { readonly ok: true } | { readonly ok: false; readonly errorName: string };

// Error class only: messages could contain paths or values.
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

// Development-only screen (app/dev/checks.tsx checks __DEV__ before rendering it).
export function DevChecksScreen() {
  const router = useRouter();
  const { mode, switchMode } = useDatabaseMode();
  const { coordinator } = useSessionStore();
  const saveState = useSyncExternalStore(coordinator.subscribe, coordinator.getState);
  const [cleanup, setCleanup] = useState<CleanupResult | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const saving = saveState.status === 'saving';

  const deleteUiCheckDatabase = async () => {
    setCleaning(true);
    setCleanup(null);
    try {
      await deleteTestDatabase(UI_CHECK_DATABASE_NAME, {
        open: (name) => openDatabaseAsync(name),
        deleteDatabase: (name) => deleteDatabaseAsync(name),
      });
      setCleanup({ ok: true });
    } catch (error) {
      setCleanup({ ok: false, errorName: errorName(error) });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader onBack={() => router.back()} title="Developer checks" />
      <Text style={styles.body}>
        Development builds only. Checks change only the test databases, never your sessions.
      </Text>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Database
        </Text>
        <Text style={styles.body}>
          {mode === 'test'
            ? 'UI check database is open. Test data only.'
            : 'Normal database is open. These are your sessions.'}
        </Text>
        {saving ? (
          <Banner
            body="A save is in progress. Switch when it has finished."
            title="Can't switch yet"
            tone="info"
          />
        ) : null}
        <Button
          disabled={saving}
          label={mode === 'test' ? 'Return to normal database' : 'Use UI check database'}
          onPress={() => switchMode(mode === 'test' ? 'normal' : 'test')}
          variant="secondary"
        />
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Cleanup
        </Text>
        <Text style={styles.body}>
          {mode === 'test'
            ? 'Return to the normal database before deleting the UI check database.'
            : 'Deletes the UI check database and its test data.'}
        </Text>
        <Button
          busy={cleaning}
          disabled={mode === 'test'}
          label="Delete UI check database"
          onPress={() => void deleteUiCheckDatabase()}
          variant="secondary"
        />
        {cleanup === null ? null : cleanup.ok ? (
          <Banner body="UI check database deleted." tone="info" />
        ) : (
          <Banner
            body={`The UI check database may still exist (${cleanup.errorName}).`}
            title="Couldn't delete"
            tone="error"
          />
        )}
      </View>
    </Screen>
  );
}

export function DevChecksUnavailable() {
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Not available
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.small,
    paddingTop: spacing.field,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.secondary,
  },
});
