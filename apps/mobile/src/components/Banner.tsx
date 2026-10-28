import Check from 'lucide-react-native/icons/check';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import Info from 'lucide-react-native/icons/info';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import { type ReactNode, useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { colors, radius, spacing, typography } from './tokens';

export type BannerTone = 'error' | 'warning' | 'success' | 'info';

const TONE = {
  error: { color: colors.error, surface: colors.errorSurface, icon: CircleAlert },
  warning: { color: colors.warning, surface: colors.warningSurface, icon: TriangleAlert },
  success: { color: colors.success, surface: colors.successSurface, icon: Check },
  info: { color: colors.info, surface: colors.infoSurface, icon: Info },
} as const;

type BannerProps = {
  tone: BannerTone;
  title?: string;
  body: string;
  children?: ReactNode;
};

// Inline status with icon, title and text, never colour alone (components/11-banners.png).
// Announced once when it appears or its text changes; rerenders do not repeat it.
export function Banner({ tone, title, body, children }: BannerProps) {
  const announcement = title === undefined ? body : `${title}. ${body}`;
  const { color, surface, icon } = TONE[tone];

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, { borderColor: color, backgroundColor: surface }]}
    >
      <Icon icon={icon} size="feature" color={color} />
      <View style={styles.text}>
        {title === undefined ? null : <Text style={[styles.title, { color }]}>{title}</Text>}
        <Text style={styles.body}>{body}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    gap: spacing.label,
  },
  title: {
    ...typography.label,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
});
