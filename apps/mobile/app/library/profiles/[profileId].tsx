import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '../../../src/components/NotFound';
import { EditProfile } from '../../../src/features/library/EditLibraryItem';
import { readIdParam } from '../../../src/features/routeParams';

export default function EditProfileRoute() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const id = readIdParam(profileId);
  return id === null ? <NotFound /> : <EditProfile profileId={id} />;
}
