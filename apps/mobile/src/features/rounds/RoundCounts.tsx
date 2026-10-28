import Check from 'lucide-react-native/icons/check';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { Stepper } from '../../components/Stepper';
import { colors, radius, spacing, typography } from '../../components/tokens';
import { ACTUAL_SHOTS_RANGE, HIT_DIAMETER_MM_RANGE } from '../../domain/round/roundRules';
import type { RoundEvaluation } from '../../domain/round/roundEvaluation';
import type { DraftCounts } from '../../persistence/roundRepository';

type CountsProps = {
  counts: DraftCounts;
  onChange: (next: DraftCounts) => void;
  disabled: boolean;
};

export function ActualShots({ counts, onChange, disabled }: CountsProps) {
  return (
    <View style={styles.group}>
      <Stepper
        disabled={disabled}
        label="Actual shots"
        max={ACTUAL_SHOTS_RANGE.max}
        min={ACTUAL_SHOTS_RANGE.min}
        onChange={(value) => onChange({ ...counts, actualShots: value })}
        value={counts.actualShots}
      />
      <Text style={styles.supporting}>
        Starts at the planned shots. You can adjust this before confirmation.
      </Text>
    </View>
  );
}

// The diameter stays a stated assumption until the user confirms or changes it. It is never
// derived from the calibre text, which is shown only as a reminder.
export function HoleDiameterCard({
  counts,
  onChange,
  disabled,
  calibreLabel,
}: CountsProps & { calibreLabel: string }) {
  const assumed = counts.hitDiameterSource === 'assumed';
  const mm = counts.hitDiameterMm.toFixed(1);
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text accessibilityRole="header" style={styles.title}>
          Hole diameter
        </Text>
        <StatusBadge
          label={assumed ? 'Assumed' : 'Set by you'}
          tone={assumed ? 'warning' : 'success'}
        />
      </View>
      <Stepper
        disabled={disabled}
        label="Diameter"
        max={HIT_DIAMETER_MM_RANGE.max}
        min={HIT_DIAMETER_MM_RANGE.min}
        onChange={(value) =>
          onChange({ ...counts, hitDiameterMm: value, hitDiameterSource: 'userSet' })
        }
        step={0.5}
        value={counts.hitDiameterMm}
        valueText={`${mm} mm`}
      />
      <Text style={styles.supporting}>
        {assumed
          ? `${mm} mm is a default, not taken from your calibre${calibreLabel === '' ? '' : ` (${calibreLabel})`}. Check this value before using boundary scores.`
          : 'Set by you. New rounds in this session start with this diameter.'}
      </Text>
      {assumed ? (
        <Button
          disabled={disabled}
          icon={Check}
          label="Use this diameter"
          onPress={() => onChange({ ...counts, hitDiameterSource: 'userSet' })}
          variant="secondary"
        />
      ) : null}
      <Text style={styles.supporting}>
        A hole touching a ring line gets the higher score, so the diameter matters for hits near
        lines.
      </Text>
    </View>
  );
}

// components/20-shot-accounting.png: actual shots = accepted hits (with their multiplicity) +
// declared misses + unresolved shots. Suggestions are not counted until accepted.
export function ShotAccounting({
  counts,
  onChange,
  disabled,
  evaluation,
}: CountsProps & { evaluation: RoundEvaluation }) {
  // Balance and direction come from the domain's accounting of the same counts.
  const difference = Math.abs(counts.actualShots - evaluation.recordedShots);
  const shotsAre = difference === 1 ? 'shot is' : 'shots are';
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        Shot accounting
      </Text>
      <Stepper
        disabled={disabled}
        label="Actual shots"
        max={ACTUAL_SHOTS_RANGE.max}
        min={ACTUAL_SHOTS_RANGE.min}
        onChange={(value) => onChange({ ...counts, actualShots: value })}
        value={counts.actualShots}
      />
      <View accessible style={styles.row}>
        <Text style={styles.body}>Confirmed hits</Text>
        <Text style={styles.value}>{evaluation.hitShots}</Text>
      </View>
      <Stepper
        disabled={disabled}
        label="Declared misses"
        max={ACTUAL_SHOTS_RANGE.max}
        min={0}
        onChange={(value) => onChange({ ...counts, declaredMisses: value })}
        value={counts.declaredMisses}
      />
      <Stepper
        disabled={disabled}
        label="Unresolved"
        max={ACTUAL_SHOTS_RANGE.max}
        min={0}
        onChange={(value) => onChange({ ...counts, unresolvedShots: value })}
        value={counts.unresolvedShots}
      />
      <Text
        accessibilityLiveRegion="polite"
        style={
          evaluation.status === 'tooFew' || evaluation.status === 'tooMany'
            ? styles.unbalanced
            : styles.balanced
        }
      >
        {evaluation.status === 'tooFew'
          ? `${difference} of ${counts.actualShots} ${shotsAre} not accounted for. Mark the hits, or declare misses or unresolved shots.`
          : evaluation.status === 'tooMany'
            ? `${difference} more ${shotsAre} recorded than fired. Remove marks or lower the counts.`
            : `All ${counts.actualShots} shots accounted for.`}
      </Text>
      <Text style={styles.supporting}>
        {
          "Declare a miss only when you know the shot missed. Use unresolved when you can't tell where a shot went; it is not counted as 0."
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.label,
  },
  card: {
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.label,
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  value: {
    ...typography.section,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  supporting: {
    ...typography.body,
    color: colors.secondary,
  },
  balanced: {
    ...typography.label,
    color: colors.success,
  },
  unbalanced: {
    ...typography.label,
    color: colors.warning,
  },
});
