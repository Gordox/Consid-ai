import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { spacing } from '../../components/tokens';
import { profileFormValues, templateFormValues } from '../../domain/library/library';
import { getProfile, getTemplate } from '../../persistence/libraryRepository';
import { useSessionStore } from '../startup/sessionStoreContext';
import { useFocusLoad } from '../useFocusLoad';
import { ProfileForm, TemplateForm } from './LibraryForms';

function Missing({
  title,
  failed,
  onRetry,
}: {
  title: string;
  failed: boolean;
  onRetry: () => void;
}) {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.stack}>
        <ScreenHeader
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/library'))}
          title={title}
        />
        {failed ? (
          <>
            <Banner body="Nothing was changed. Try again." title="Couldn't open it" tone="error" />
            <Button label="Try again" onPress={onRetry} />
          </>
        ) : (
          <Banner body="It doesn't exist or can't be read. Nothing was changed." tone="error" />
        )}
      </View>
    </Screen>
  );
}

export function EditProfile({ profileId }: { profileId: string }) {
  const { db } = useSessionStore();
  const load = useCallback(() => getProfile(db, profileId), [db, profileId]);
  const { state, reload } = useFocusLoad(load);
  if (state.status === 'loaded' && state.data !== null) {
    return (
      <ProfileForm
        key={state.data.id}
        archived={state.data.archivedAtUtc !== null}
        initial={profileFormValues(state.data)}
        profileId={state.data.id}
      />
    );
  }
  if (state.status === 'loading') return <Screen>{null}</Screen>;
  return <Missing failed={state.status === 'failed'} onRetry={reload} title="Firearm profile" />;
}

export function EditTemplate({ templateId }: { templateId: string }) {
  const { db } = useSessionStore();
  const load = useCallback(() => getTemplate(db, templateId), [db, templateId]);
  const { state, reload } = useFocusLoad(load);
  if (state.status === 'loaded' && state.data !== null) {
    return (
      <TemplateForm
        key={state.data.id}
        archived={state.data.archivedAtUtc !== null}
        initial={{ name: state.data.name, ...templateFormValues(state.data) }}
        templateId={state.data.id}
      />
    );
  }
  if (state.status === 'loading') return <Screen>{null}</Screen>;
  return <Missing failed={state.status === 'failed'} onRetry={reload} title="Training template" />;
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.group,
  },
});
