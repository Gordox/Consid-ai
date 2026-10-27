import CircleAlert from 'lucide-react-native/icons/circle-alert';
import { type ReactNode, useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, radius, spacing, typography } from './tokens';

type BannerProps = {
  tone: 'error' | 'info';
  title?: string;
  body: string;
  children?: ReactNode;
};

// Status message at the top of a form. Announced once when it appears or its text changes.
export function Banner({ tone, title, body, children }: BannerProps) {
  const announcement = title === undefined ? body : `${title}. ${body}`;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, tone === 'error' ? styles.error : styles.info]}
    >
      {title === undefined ? null : (
        <View style={styles.titleRow}>
          {tone === 'error' ? <Icon icon={CircleAlert} size="action" color={colors.error} /> : null}
          <Text style={[styles.title, tone === 'error' ? styles.errorTitle : null]}>{title}</Text>
        </View>
      )}
      <Text style={styles.body}>{body}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: spacing.label,
    padding: spacing.field,
    borderRadius: radius.control,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  error: {
    borderColor: colors.error,
  },
  info: {
    borderColor: colors.inputBorder,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.label,
  },
  title: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1,
  },
  errorTitle: {
    color: colors.error,
  },
  body: {
    ...typography.supporting,
    color: colors.secondary,
  },
});
