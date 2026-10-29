import { useFocusEffect, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { SelectSheet } from '../../components/SelectSheet';
import { colors, radius, spacing, typography } from '../../components/tokens';
import {
  type FirearmProfile,
  lastUsedActive,
  type TrainingTemplate,
} from '../../domain/library/library';
import type { SessionField, SessionFormInput } from '../../domain/session/session';
import { listProfiles, listTemplates, markUsed } from '../../persistence/libraryRepository';
import { nowUtcIso } from '../../services/deviceContext';
import { createActionGuard } from '../rounds/nextRound';
import { useSessionStore } from '../startup/sessionStoreContext';
import type { SessionFormController } from './sessionFormController';
import {
  differsFromProfile,
  differsFromTemplate,
  newlyAdded,
  profileFields,
  templateFields,
} from './startingPoints';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Starting points error:', error instanceof Error ? error.name : typeof error);
  }
}

const NONE = 'none';

type Lists = { readonly profiles: FirearmProfile[]; readonly templates: TrainingTemplate[] };

// Firearm profile and training template choices for the session form. A choice only fills the
// form; the user may change any value for this session, and nothing is written back to the
// profile or template unless they save it as one explicitly.
export function useStartingPoints(
  controller: SessionFormController,
  input: SessionFormInput,
  locked: boolean,
): { section: ReactNode; markUsed: () => void } {
  const { db } = useSessionStore();
  const router = useRouter();
  const [lists, setLists] = useState<Lists | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const initialised = useRef(false);
  const creating = useRef<'profile' | 'template' | null>(null);
  const known = useRef({ profiles: new Set<string>(), templates: new Set<string>() });
  const chosen = useRef({ profileId, templateId });
  useEffect(() => {
    chosen.current = { profileId, templateId };
  }, [profileId, templateId]);
  const navigation = useRef(createActionGuard());

  const apply = useCallback(
    (fields: Partial<SessionFormInput>) => {
      for (const [field, value] of Object.entries(fields)) {
        controller.changeField(field as SessionField, value ?? '');
      }
    },
    [controller],
  );

  useFocusEffect(
    useCallback(() => {
      navigation.current.release();
      let active = true;
      Promise.all([listProfiles(db), listTemplates(db)]).then(
        ([profiles, templates]) => {
          if (!active) return;
          const next: Lists = { profiles: profiles.active, templates: templates.active };
          setLists(next);
          if (!initialised.current) {
            initialised.current = true;
            // Start from the last used active choices, shown in the selects, but only while the
            // form is untouched; typed values are never replaced.
            if (!controller.getView().form.dirty) {
              const profile = lastUsedActive(next.profiles);
              const template = lastUsedActive(next.templates);
              controller.prefill({
                ...(profile === null ? {} : profileFields(profile)),
                ...(template === null ? {} : templateFields(template)),
              });
              setProfileId(profile?.id ?? null);
              setTemplateId(template?.id ?? null);
            }
          } else if (creating.current === 'profile') {
            const added = newlyAdded(known.current.profiles, next.profiles);
            if (added !== null) {
              apply(profileFields(added));
              setProfileId(added.id);
            }
          } else if (creating.current === 'template') {
            const added = newlyAdded(known.current.templates, next.templates);
            if (added !== null) {
              apply(templateFields(added));
              setTemplateId(added.id);
            }
          }
          creating.current = null;
          known.current = {
            profiles: new Set(next.profiles.map((item) => item.id)),
            templates: new Set(next.templates.map((item) => item.id)),
          };
        },
        (error: unknown) => reportDevError(error),
      );
      return () => {
        active = false;
      };
    }, [db, controller, apply]),
  );

  const profile = lists?.profiles.find((item) => item.id === profileId) ?? null;
  const template = lists?.templates.find((item) => item.id === templateId) ?? null;

  const openCreate = (kind: 'profile' | 'template') => {
    if (!navigation.current.tryEnter()) return;
    creating.current = kind;
    router.push(
      kind === 'profile'
        ? {
            pathname: '/library/profiles/new',
            params: {
              firearmName: input.firearmName,
              firearmType: input.firearmType ?? '',
              calibreLabel: input.calibreLabel,
            },
          }
        : {
            pathname: '/library/templates/new',
            params: {
              distanceMetres: input.distanceMetres,
              plannedShotsPerRound: input.plannedShotsPerRound,
              plannedRounds: input.plannedRounds,
            },
          },
    );
  };

  const section =
    lists === null ? null : (
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          Start from
        </Text>
        <SelectSheet
          label="Firearm profile"
          locked={locked}
          onChange={(id) => {
            const picked = lists.profiles.find((item) => item.id === id) ?? null;
            if (picked !== null) apply(profileFields(picked));
            setProfileId(picked?.id ?? null);
          }}
          options={[
            { value: NONE, label: 'None: enter the details below' },
            ...lists.profiles.map((item) => ({ value: item.id, label: item.firearmName })),
          ]}
          placeholder="None: enter the details below"
          value={profileId ?? NONE}
        />
        {profile !== null && differsFromProfile(input, profile) ? (
          <Text accessibilityLiveRegion="polite" style={styles.changed}>
            Changed from {profile.firearmName} for this session only. The profile is not updated.
          </Text>
        ) : null}
        <SelectSheet
          label="Training template"
          locked={locked}
          onChange={(id) => {
            const picked = lists.templates.find((item) => item.id === id) ?? null;
            if (picked !== null) apply(templateFields(picked));
            setTemplateId(picked?.id ?? null);
          }}
          options={[
            { value: NONE, label: 'None: enter the details below' },
            ...lists.templates.map((item) => ({ value: item.id, label: item.name })),
          ]}
          placeholder="None: enter the details below"
          value={templateId ?? NONE}
        />
        {template !== null && differsFromTemplate(input, template) ? (
          <Text accessibilityLiveRegion="polite" style={styles.changed}>
            Changed from {template.name} for this session only. The template is not updated.
          </Text>
        ) : null}
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              disabled={locked}
              label="Save as profile"
              onPress={() => openCreate('profile')}
              variant="secondary"
            />
          </View>
          <View style={styles.action}>
            <Button
              disabled={locked}
              label="Save as template"
              onPress={() => openCreate('template')}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    );

  return {
    section,
    // After the session is saved; best effort, because it only affects the next suggestion.
    markUsed: () => {
      const now = nowUtcIso();
      const { profileId: usedProfile, templateId: usedTemplate } = chosen.current;
      if (usedProfile !== null) {
        markUsed(db, 'profile', usedProfile, now).catch(reportDevError);
      }
      if (usedTemplate !== null) {
        markUsed(db, 'template', usedTemplate, now).catch(reportDevError);
      }
    },
  };
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
  changed: {
    ...typography.caption,
    color: colors.info,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  action: {
    flexGrow: 1,
    flexBasis: 130,
  },
});
