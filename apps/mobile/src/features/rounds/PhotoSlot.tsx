import Camera from 'lucide-react-native/icons/camera';
import ImageIcon from 'lucide-react-native/icons/image';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, spacing, typography } from '../../components/tokens';
import type { RoundPhoto } from '../../domain/round/round';
import { usePhotoStore } from '../startup/photoStoreContext';

type PhotoSlotProps = {
  title: string;
  required: boolean;
  // Shown under an empty slot, e.g. when the photo is taken.
  hint: string;
  photo: RoundPhoto | null;
  missing: boolean;
  editable: boolean;
  busy: boolean;
  onTake?: () => void;
  onChoose?: () => void;
  onRemove?: () => void;
  // The main photo of the step: its camera action is the primary button.
  primary?: boolean;
  // Opens the photo full screen; the photo becomes a button when given.
  onInspect?: () => void;
};

function badgeFor(
  photo: RoundPhoto | null,
  missing: boolean,
  required: boolean,
): { label: string; tone: 'success' | 'error' | 'neutral' | 'warning' } {
  if (photo !== null) {
    return missing ? { label: 'Unavailable', tone: 'error' } : { label: 'Added', tone: 'success' };
  }
  return required ? { label: 'Required', tone: 'warning' } : { label: 'Optional', tone: 'neutral' };
}

// components/15-photo-card.png. The camera and library are the platform's own screens; picking
// nothing keeps the current photo.
export function PhotoSlot({
  title,
  required,
  hint,
  photo,
  missing,
  editable,
  busy,
  onTake,
  onChoose,
  onRemove,
  onInspect,
  primary = false,
}: PhotoSlotProps) {
  const photos = usePhotoStore();
  const badge = badgeFor(photo, missing, required);
  return (
    <View style={styles.slot}>
      <View style={styles.top}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <StatusBadge label={badge.label} tone={badge.tone} />
      </View>
      {photo === null || missing ? (
        <View style={styles.placeholder}>
          <Icon icon={ImageIcon} size="feature" color={missing ? colors.error : colors.muted} />
          <Text style={missing ? styles.missing : styles.hint}>
            {missing
              ? `Photo unavailable. ${editable ? 'Choose this photo again to continue. Your round is still a draft.' : 'The file is missing from this device.'}`
              : editable
                ? 'No photo yet'
                : hint}
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityHint={onInspect === undefined ? undefined : 'Opens the photo full screen'}
          accessibilityLabel={`${title} photo`}
          accessibilityRole={onInspect === undefined ? 'image' : 'button'}
          disabled={onInspect === undefined}
          onPress={onInspect}
        >
          <Image
            resizeMode="contain"
            source={{ uri: photos.uri(photo.fileName) }}
            style={[styles.image, { aspectRatio: photo.width / photo.height }]}
          />
        </Pressable>
      )}
      {editable && photo === null ? <Text style={styles.hint}>{hint}</Text> : null}
      {editable && onTake !== undefined && onChoose !== undefined ? (
        <>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                busy={busy}
                icon={Camera}
                label={photo === null ? 'Camera' : 'Retake'}
                onPress={onTake}
                variant={primary && photo === null ? 'primary' : 'secondary'}
              />
            </View>
            <View style={styles.action}>
              <Button
                busy={busy}
                icon={ImageIcon}
                label="Library"
                onPress={onChoose}
                variant="secondary"
              />
            </View>
          </View>
          {photo !== null && onRemove !== undefined ? (
            <Button
              busy={busy}
              label={`Remove ${title.toLowerCase()} photo`}
              onPress={onRemove}
              variant="secondary"
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.label,
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
  placeholder: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.label,
    padding: spacing.field,
    borderRadius: radius.control,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.inputBorder,
  },
  hint: {
    ...typography.body,
    color: colors.secondary,
    textAlign: 'center',
  },
  missing: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
  image: {
    width: '100%',
    maxHeight: 320,
    borderRadius: radius.small,
    backgroundColor: colors.elevated,
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
