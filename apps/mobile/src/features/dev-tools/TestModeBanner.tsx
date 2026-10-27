import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '../../components/Banner';
import { colors, spacing } from '../../components/tokens';

// Shown above every screen while the UI check database is open, including the startup error
// screen, so test data is never mistaken for the user's sessions.
export function TestModeBanner() {
  return (
    <SafeAreaView edges={['top']} style={styles.area}>
      <Banner
        body="UI check database. Test data only. A full restart returns to your sessions."
        title="Test mode"
        tone="info"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  area: {
    paddingHorizontal: spacing.inset,
    paddingBottom: spacing.small,
    backgroundColor: colors.background,
  },
});
