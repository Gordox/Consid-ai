import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '../../../../../src/components/NotFound';
import { RoundConfirmScreen } from '../../../../../src/features/rounds/RoundConfirmScreen';
import { readIdParam } from '../../../../../src/features/routeParams';

export default function ConfirmRoute() {
  const params = useLocalSearchParams<{ sessionId: string; roundId: string }>();
  const sessionId = readIdParam(params.sessionId);
  const roundId = readIdParam(params.roundId);
  return sessionId === null || roundId === null ? (
    <NotFound />
  ) : (
    <RoundConfirmScreen roundId={roundId} sessionId={sessionId} />
  );
}
