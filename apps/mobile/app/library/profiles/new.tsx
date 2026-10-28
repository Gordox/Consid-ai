import { useLocalSearchParams } from 'expo-router';

import { EMPTY_PROFILE, ProfileForm } from '../../../src/features/library/LibraryForms';

// Opened from the session form with its current values, so a profile can be saved from them.
export default function NewProfileRoute() {
  const params = useLocalSearchParams<{
    firearmName?: string;
    firearmType?: string;
    calibreLabel?: string;
  }>();
  return (
    <ProfileForm
      archived={null}
      initial={{
        firearmName: params.firearmName ?? EMPTY_PROFILE.firearmName,
        firearmType: params.firearmType ?? EMPTY_PROFILE.firearmType,
        calibreLabel: params.calibreLabel ?? EMPTY_PROFILE.calibreLabel,
      }}
      profileId={null}
    />
  );
}
