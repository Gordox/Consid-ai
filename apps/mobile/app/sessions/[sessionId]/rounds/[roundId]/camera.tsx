import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '../../../../../src/components/NotFound';
import { CameraCapture } from '../../../../../src/features/camera/CameraCapture';
import { readIdParam } from '../../../../../src/features/routeParams';

export default function CameraRoute() {
  const params = useLocalSearchParams<{
    sessionId: string;
    roundId: string;
    role?: string;
    rev?: string;
  }>();
  const sessionId = readIdParam(params.sessionId);
  const roundId = readIdParam(params.roundId);
  const role = params.role === 'before' ? 'before' : params.role === 'after' ? 'after' : null;
  // The draft revision the round screen showed; a photo is only added to that state.
  const revision =
    typeof params.rev === 'string' && /^\d{1,9}$/.test(params.rev) ? Number(params.rev) : null;
  return sessionId === null || roundId === null || role === null || revision === null ? (
    <NotFound />
  ) : (
    <CameraCapture draftRevision={revision} role={role} roundId={roundId} sessionId={sessionId} />
  );
}
