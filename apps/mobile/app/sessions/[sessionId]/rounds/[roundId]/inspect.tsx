import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '../../../../../src/components/NotFound';
import { InspectScreen } from '../../../../../src/features/inspection/InspectScreen';
import { readIdParam } from '../../../../../src/features/routeParams';

export default function InspectRoute() {
  const params = useLocalSearchParams<{ sessionId: string; roundId: string; hits?: string }>();
  const sessionId = readIdParam(params.sessionId);
  const roundId = readIdParam(params.roundId);
  return sessionId === null || roundId === null ? (
    <NotFound />
  ) : (
    <InspectScreen roundId={roundId} sessionId={sessionId} showHitsAtStart={params.hits === '1'} />
  );
}
