import Camera from 'lucide-react-native/icons/camera';
import ImageIcon from 'lucide-react-native/icons/image';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { colors, radius, spacing, typography } from '../../components/tokens';
import type { RoundPhoto } from '../../domain/round/round';
import { usePhotoStore } from '../startup/photoStoreContext';

type PhotoSlotProps = {
  title: string;
  hint: string;
  photo: RoundPhoto | null;
  missing: boolean;
  editable: boolean;
  busy: boolean;
  onTake?: () => void;
  onChoose?: () => void;
  onRemove?: () => void;
};

export function PhotoSlot({
  title,
  hint,
  photo,
  missing,
  editable,
  busy,
  onTake,
  onChoose,
  onRemove,
}: PhotoSlotProps) {
  const photos = usePhotoStore();
  return (
    <View style={styles.slot}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {photo === null ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : missing ? (
        <Text style={styles.missing}>
          The photo file is missing from this device. {editable ? 'Take or choose it again.' : ''}
        </Text>
      ) : (
        <Image
          accessibilityLabel={`${title} photo`}
          resizeMode="contain"
          source={{ uri: photos.uri(photo.fileName) }}
          style={[styles.image, { aspectRatio: photo.width / photo.height }]}
        />
      )}
      {editable && onTake !== undefined && onChoose !== undefined ? (
        <View style={styles.actions}>
          <Button
            busy={busy}
            icon={Camera}
            label={photo === null ? 'Take photo' : 'Retake'}
            onPress={onTake}
            variant="secondary"
          />
          <Button
            busy={busy}
            icon={ImageIcon}
            label="Choose from library"
            onPress={onChoose}
            variant="secondary"
          />
          {photo !== null && onRemove !== undefined ? (
            <Button busy={busy} label="Remove photo" onPress={onRemove} variant="secondary" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
  hint: {
    ...typography.body,
    color: colors.secondary,
  },
  missing: {
    ...typography.body,
    color: colors.error,
  },
  image: {
    width: '100%',
    maxHeight: 320,
    borderRadius: radius.small,
    backgroundColor: colors.elevated,
  },
  actions: {
    gap: spacing.small,
  },
});
