import { useLocalSearchParams } from 'expo-router';

import { EMPTY_TEMPLATE, TemplateForm } from '../../../src/features/library/LibraryForms';

// Opened from the session form with its current values, so a template can be saved from them.
export default function NewTemplateRoute() {
  const params = useLocalSearchParams<{
    distanceMetres?: string;
    plannedShotsPerRound?: string;
    plannedRounds?: string;
  }>();
  return (
    <TemplateForm
      archived={null}
      initial={{
        name: EMPTY_TEMPLATE.name,
        distanceMetres: params.distanceMetres ?? EMPTY_TEMPLATE.distanceMetres,
        plannedShotsPerRound: params.plannedShotsPerRound ?? EMPTY_TEMPLATE.plannedShotsPerRound,
        plannedRounds: params.plannedRounds ?? EMPTY_TEMPLATE.plannedRounds,
      }}
      templateId={null}
    />
  );
}
