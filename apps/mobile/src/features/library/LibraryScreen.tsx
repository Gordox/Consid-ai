import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Plus from 'lucide-react-native/icons/plus';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, sizes, spacing, typography } from '../../components/tokens';
import { listProfiles, listTemplates } from '../../persistence/libraryRepository';
import { createActionGuard } from '../rounds/nextRound';
import { useSessionStore } from '../startup/sessionStoreContext';
import { useFocusLoad } from '../useFocusLoad';
import { profileSummary, templateSummary } from './libraryText';

function Row({
  title,
  detail,
  archived,
  onPress,
}: {
  title: string;
  detail: string;
  archived: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Opens it to edit, archive or restore"
      accessibilityLabel={`${title}, ${detail}${archived ? ', archived' : ''}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.secondary}>{detail}</Text>
        {archived ? <StatusBadge label="Archived" tone="neutral" /> : null}
      </View>
      <Icon icon={ChevronRight} size="feature" color={colors.secondary} />
    </Pressable>
  );
}

// Firearm profiles and training templates: two separate kinds of saved starting points.
// Archived items are listed separately and can be restored; nothing is deleted.
export function LibraryScreen() {
  const { db } = useSessionStore();
  const router = useRouter();
  const load = useCallback(
    async () => ({ profiles: await listProfiles(db), templates: await listTemplates(db) }),
    [db],
  );
  const { state, reload } = useFocusLoad(load);
  const guard = useRef(createActionGuard());
  useFocusEffect(
    useCallback(() => {
      guard.current.release();
    }, []),
  );
  const open = (path: string) => {
    if (guard.current.tryEnter()) router.push(path);
  };
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen scroll>
      <View style={styles.stack}>
        <ScreenHeader
          onBack={goBack}
          subtitle="Starting points for new sessions. Sessions keep their own copy."
          title="Profiles and templates"
        />
        {state.status === 'loading' ? (
          <Text accessibilityLiveRegion="polite" style={styles.secondary}>
            Loading…
          </Text>
        ) : null}
        {state.status === 'failed' ? (
          <>
            <Banner body="Nothing was changed. Try again." title="Couldn't load" tone="error" />
            <Button label="Try again" onPress={reload} />
          </>
        ) : null}
        {state.status === 'loaded' ? (
          <>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Firearm profiles
              </Text>
              <Text style={styles.secondary}>Name, firearm type and calibre.</Text>
              {state.data.profiles.active.length === 0 ? (
                <Text style={styles.secondary}>No profiles yet.</Text>
              ) : null}
              {state.data.profiles.active.map((profile) => (
                <Row
                  key={profile.id}
                  archived={false}
                  detail={profileSummary(profile)}
                  onPress={() => open(`/library/profiles/${profile.id}`)}
                  title={profile.firearmName}
                />
              ))}
              <Button
                icon={Plus}
                label="New profile"
                onPress={() => open('/library/profiles/new')}
                variant="secondary"
              />
            </View>

            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Training templates
              </Text>
              <Text style={styles.secondary}>Distance, shots per round and planned rounds.</Text>
              {state.data.templates.active.length === 0 ? (
                <Text style={styles.secondary}>No templates yet.</Text>
              ) : null}
              {state.data.templates.active.map((template) => (
                <Row
                  key={template.id}
                  archived={false}
                  detail={templateSummary(template)}
                  onPress={() => open(`/library/templates/${template.id}`)}
                  title={template.name}
                />
              ))}
              <Button
                icon={Plus}
                label="New template"
                onPress={() => open('/library/templates/new')}
                variant="secondary"
              />
            </View>

            {state.data.profiles.archived.length + state.data.templates.archived.length ===
            0 ? null : (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  Archived
                </Text>
                <Text style={styles.secondary}>
                  Not offered for new sessions. Open one to restore it.
                </Text>
                {state.data.profiles.archived.map((profile) => (
                  <Row
                    key={profile.id}
                    archived
                    detail={profileSummary(profile)}
                    onPress={() => open(`/library/profiles/${profile.id}`)}
                    title={profile.firearmName}
                  />
                ))}
                {state.data.templates.archived.map((template) => (
                  <Row
                    key={template.id}
                    archived
                    detail={templateSummary(template)}
                    onPress={() => open(`/library/templates/${template.id}`)}
                    title={template.name}
                  />
                ))}
              </View>
            )}
            {state.data.profiles.unreadable + state.data.templates.unreadable > 0 ? (
              <Banner
                body="Some saved profiles or templates couldn't be read and are not shown. They are kept."
                title="Unreadable items"
                tone="warning"
              />
            ) : null}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.group,
  },
  section: {
    gap: spacing.small,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.text,
  },
  secondary: {
    ...typography.body,
    color: colors.secondary,
  },
  row: {
    minHeight: sizes.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.elevated,
  },
  rowText: {
    flex: 1,
    gap: spacing.fine,
  },
  rowTitle: {
    ...typography.section,
    color: colors.text,
  },
});
