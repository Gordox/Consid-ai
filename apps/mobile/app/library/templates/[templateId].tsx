import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '../../../src/components/NotFound';
import { EditTemplate } from '../../../src/features/library/EditLibraryItem';
import { readIdParam } from '../../../src/features/routeParams';

export default function EditTemplateRoute() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const id = readIdParam(templateId);
  return id === null ? <NotFound /> : <EditTemplate templateId={id} />;
}
