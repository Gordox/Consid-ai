import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '../../../src/components/NotFound';
import { SessionDetail } from '../../../src/features/sessions/SessionDetail';
import { readIdParam } from '../../../src/features/routeParams';

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = readIdParam(sessionId);
  return id === null ? <NotFound /> : <SessionDetail sessionId={id} />;
}
