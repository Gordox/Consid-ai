import {
  type FirearmProfile,
  profileFormValues,
  templateFormValues,
  type TrainingTemplate,
  validateProfileInput,
  validateTemplateInput,
} from '../../domain/library/library';
import type { SessionFormInput } from '../../domain/session/session';

// How a chosen profile or template relates to the session form. Pure, so the "changed from"
// notice and the fill rules can be tested without rendering.

export function profileFields(profile: FirearmProfile): Partial<SessionFormInput> {
  return profileFormValues(profile);
}

export function templateFields(template: TrainingTemplate): Partial<SessionFormInput> {
  return templateFormValues(template);
}

// The form's firearm values differ from the profile, compared as the domain normalises them
// (so "Club pistol " is not a change). An invalid entry counts as changed.
export function differsFromProfile(input: SessionFormInput, profile: FirearmProfile): boolean {
  const current = validateProfileInput(input);
  return (
    !current.ok ||
    current.value.firearmName !== profile.firearmName ||
    current.value.firearmType !== profile.firearmType ||
    current.value.calibreLabel !== profile.calibreLabel
  );
}

export function differsFromTemplate(input: SessionFormInput, template: TrainingTemplate): boolean {
  const current = validateTemplateInput({ ...input, name: template.name });
  return (
    !current.ok ||
    current.value.distanceMetres !== template.distanceMetres ||
    current.value.plannedShotsPerRound !== template.plannedShotsPerRound ||
    current.value.plannedRounds !== template.plannedRounds
  );
}

// An id that appeared since the earlier list: the item just created from the form.
export function newlyAdded<T extends { id: string }>(
  before: ReadonlySet<string>,
  after: readonly T[],
): T | null {
  return after.find((item) => !before.has(item.id)) ?? null;
}
