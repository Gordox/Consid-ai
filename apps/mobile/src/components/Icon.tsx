import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { icons } from './tokens';

type IconProps = {
  // A per-icon import, e.g. `import TriangleAlert from 'lucide-react-native/icons/triangle-alert'`,
  // so only the icons the app uses are bundled.
  icon: LucideIcon;
  size: 'inline' | 'action' | 'feature';
  color: string;
  // Omit for decorative icons; they are hidden from screen readers.
  accessibilityLabel?: string;
};

export function Icon({ icon: LucideComponent, size, color, accessibilityLabel }: IconProps) {
  const glyph = (
    <LucideComponent size={icons[size]} color={color} strokeWidth={icons.strokeWidth} />
  );
  if (accessibilityLabel === undefined) {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {glyph}
      </View>
    );
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {glyph}
    </View>
  );
}
