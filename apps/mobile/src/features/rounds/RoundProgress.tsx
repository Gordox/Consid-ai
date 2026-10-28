import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../components/tokens';
import type { DraftRound } from '../../domain/round/round';
import { PROGRESS_STEPS, type ProgressStep, progressStates } from './roundSteps';

const STATE_TEXT = { done: 'done', current: 'current step', todo: 'not done' } as const;

// components/16-progress.png: where the round is, read as one sentence. Information only, not
// navigation; a visited step is not marked done.
export function RoundProgress({
  draft,
  current,
}: {
  draft: Pick<DraftRound, 'photos' | 'calibration'>;
  current: ProgressStep;
}) {
  const states = progressStates(draft, current);
  const spoken = PROGRESS_STEPS.map(
    ({ step, label }, index) => `Step ${index + 1}, ${label}, ${STATE_TEXT[states[step]]}`,
  ).join('. ');
  return (
    <View accessible accessibilityLabel={spoken} style={styles.row}>
      {PROGRESS_STEPS.map(({ step, label }, index) => {
        const state = states[step];
        const color =
          state === 'current' ? colors.accent : state === 'done' ? colors.success : colors.muted;
        return (
          <View key={step} style={styles.step}>
            <Text style={[styles.label, { color }, state === 'current' ? styles.current : null]}>
              {`${index + 1} ${label}`}
            </Text>
            <View
              style={[
                styles.bar,
                { backgroundColor: state === 'todo' ? colors.border : color },
                state === 'current' ? styles.currentBar : null,
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.label,
  },
  step: {
    flex: 1,
    gap: spacing.label,
  },
  label: {
    ...typography.body,
  },
  current: {
    fontWeight: '600',
  },
  bar: {
    height: 2,
  },
  currentBar: {
    height: 3,
  },
});
