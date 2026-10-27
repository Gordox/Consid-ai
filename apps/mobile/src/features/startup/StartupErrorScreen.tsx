import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { colors, spacing, typography } from '../../components/tokens';
import type { StartupErrorKind } from './databaseLifecycle';

// Copy approved in docs/design/ui-ux.md §7.7 (P4, U2, U3).
const TITLE = "Couldn't open saved sessions";
const BODY: Record<StartupErrorKind, string> = {
  other:
    "We couldn't open your saved sessions. Try again. If the problem continues, restart the app.",
  newerVersion:
    'Your saved sessions were created by a newer version of Target Practice. Update the app to open them. Nothing has been changed.',
};

type StartupErrorScreenProps = {
  errorKind: StartupErrorKind;
  onRetry: () => void;
};

// Only Retry is offered: no New session, and the database is never reset or deleted (A1, Q7).
export function StartupErrorScreen({ errorKind, onRetry }: StartupErrorScreenProps) {
  const body = BODY[errorKind];

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${TITLE}. ${body}`);
  }, [body]);

  return (
    <Screen scroll>
      <View style={styles.message}>
        <Icon icon={TriangleAlert} size="feature" color={colors.warning} />
        <Text accessibilityRole="header" style={styles.title}>
          {TITLE}
        </Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <Button label="Retry" onPress={onRetry} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    flexGrow: 1,
    gap: spacing.small,
    paddingBottom: spacing.group,
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.secondary,
  },
});
