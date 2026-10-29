import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '../src/components/tokens';
import { PhotoRecovery } from '../src/features/rounds/PhotoRecovery';
import { DatabaseGate } from '../src/features/startup/DatabaseGate';

// Dark only (decision A6).
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <DatabaseGate>
        <PhotoRecovery />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </DatabaseGate>
    </ThemeProvider>
  );
}
