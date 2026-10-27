import Plus from 'lucide-react-native/icons/plus';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, type TextInstance } from 'react-native';

import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { colors, spacing, typography } from '../src/components/tokens';

// Temporary placeholder until the session list in step 6. Returning here after a save does not
// prove that the session is stored; that is verified with the list in step 6 and in step 7.
export default function HomeScreen() {
  const router = useRouter();
  const titleRef = useRef<TextInstance>(null);

  // Screen reader focus starts on the title whenever this screen is shown, including after
  // Leave or Discard from the form.
  useFocusEffect(
    useCallback(() => {
      if (titleRef.current !== null) {
        AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
      }
    }, []),
  );

  return (
    <Screen>
      <Text ref={titleRef} accessibilityRole="header" style={styles.title}>
        Target Practice
      </Text>
      <Button icon={Plus} label="New session" onPress={() => router.push('/sessions/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.pageTitle,
    color: colors.text,
    marginBottom: spacing.group,
  },
});
