import { StyleSheet, Text } from 'react-native';

import { Screen } from '../src/components/Screen';
import { colors, typography } from '../src/components/tokens';

// Temporary placeholder until the session list in step 6.
// "New session" is added in step 5d, once the form route exists.
export default function HomeScreen() {
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Target Practice
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.pageTitle,
    color: colors.text,
  },
});
