import { useRef } from 'react';
import { AccessibilityInfo, Modal, StyleSheet, Text, type TextInstance, View } from 'react-native';

import { Button } from './Button';
import { colors, radius, spacing, typography } from './tokens';
import { useReducedMotion } from './useReducedMotion';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  // 'destructive' for removing or discarding; 'primary' for a safe forward step.
  confirmVariant?: 'primary' | 'destructive';
  onCancel: () => void;
  onConfirm: () => void;
};

// components/21-dialogs.png. The safe choice comes first in reading order and is what Android
// Back selects. Focus moves to the title when the dialog opens; the caller restores focus after
// Cancel (Stay/Keep editing). The backdrop does not dismiss: every choice is a labelled button.
export function ConfirmDialog({
  visible,
  title,
  body,
  cancelLabel,
  confirmLabel,
  confirmVariant = 'destructive',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleRef = useRef<TextInstance>(null);
  const reducedMotion = useReducedMotion();

  function focusTitle(): void {
    if (titleRef.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }
  }

  return (
    <Modal
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
      onShow={focusTitle}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.scrim}>
        <View accessibilityViewIsModal style={styles.card}>
          <Text ref={titleRef} accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            <Button label={cancelLabel} onPress={onCancel} variant="secondary" />
            <Button label={confirmLabel} onPress={onConfirm} variant={confirmVariant} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.inset,
    backgroundColor: colors.scrim,
  },
  card: {
    gap: spacing.small,
    padding: spacing.group,
    borderRadius: radius.sheet,
    backgroundColor: colors.elevated,
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.secondary,
  },
  actions: {
    gap: spacing.small,
    paddingTop: spacing.label,
  },
});
