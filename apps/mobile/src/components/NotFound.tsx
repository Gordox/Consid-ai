import { useRouter } from 'expo-router';

import { Banner } from './Banner';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';

// For links whose ids are malformed; nothing is read or written for them.
export function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        title="Not found"
      />
      <Banner body="This link doesn't point to a saved session or round." tone="error" />
    </Screen>
  );
}
