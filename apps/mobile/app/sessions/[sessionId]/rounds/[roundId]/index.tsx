import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '../../../../../src/components/NotFound';
import { RoundScreen } from '../../../../../src/features/rounds/RoundScreen';
import { readIdParam } from '../../../../../src/features/routeParams';

export default function RoundRoute() {
  const params = useLocalSearchParams<{ sessionId: string; roundId: string }>();
  const sessionId = readIdParam(params.sessionId);
  const roundId = readIdParam(params.roundId);
  return sessionId === null || roundId === null ? (
    <NotFound />
  ) : (
    <RoundScreen roundId={roundId} sessionId={sessionId} />
  );
}
