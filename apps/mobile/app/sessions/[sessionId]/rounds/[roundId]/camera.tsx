import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '../../../../../src/components/NotFound';
import { CameraCapture } from '../../../../../src/features/camera/CameraCapture';
import { readIdParam } from '../../../../../src/features/routeParams';

export default function CameraRoute() {
  const params = useLocalSearchParams<{ sessionId: string; roundId: string; role?: string }>();
  const sessionId = readIdParam(params.sessionId);
  const roundId = readIdParam(params.roundId);
  const role = params.role === 'before' ? 'before' : params.role === 'after' ? 'after' : null;
  return sessionId === null || roundId === null || role === null ? (
    <NotFound />
  ) : (
    <CameraCapture role={role} roundId={roundId} sessionId={sessionId} />
  );
}
