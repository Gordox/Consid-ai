import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '../../../../../src/components/NotFound';
import { EditorScreen } from '../../../../../src/features/editor/EditorScreen';
import { readIdParam } from '../../../../../src/features/routeParams';

export default function EditorRoute() {
  const params = useLocalSearchParams<{ sessionId: string; roundId: string }>();
  const sessionId = readIdParam(params.sessionId);
  const roundId = readIdParam(params.roundId);
  return sessionId === null || roundId === null ? (
    <NotFound />
  ) : (
    <EditorScreen roundId={roundId} sessionId={sessionId} />
  );
}
