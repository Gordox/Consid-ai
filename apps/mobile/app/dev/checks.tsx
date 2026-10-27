import {
  DevChecksScreen,
  DevChecksUnavailable,
} from '../../src/features/dev-tools/DevChecksScreen';

// The route exists in every build; outside development it renders nothing that can run a check.
export default function DevChecksRoute() {
  return __DEV__ ? <DevChecksScreen /> : <DevChecksUnavailable />;
}
