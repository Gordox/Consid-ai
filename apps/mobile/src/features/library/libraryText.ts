import type { FirearmProfile, TrainingTemplate } from '../../domain/library/library';
import { formatPlannedRounds } from '../sessions/formatSession';
import { FIREARM_TYPE_LABELS } from '../sessions/firearmTypeLabels';

export function profileSummary(profile: FirearmProfile): string {
  return `${FIREARM_TYPE_LABELS[profile.firearmType]} · ${profile.calibreLabel}`;
}

// "25 m · 5 shots / round · Not planned": null rounds are never shown as 0.
export function templateSummary(template: TrainingTemplate): string {
  const shots =
    template.plannedShotsPerRound === 1
      ? '1 shot / round'
      : `${template.plannedShotsPerRound} shots / round`;
  return `${template.distanceMetres} m · ${shots} · ${formatPlannedRounds(template.plannedRounds)}`;
}
