import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { colors, radius, sizes, spacing, typography } from '../../components/tokens';
import type { HitMark } from '../../domain/round/round';
import type { Point } from '../../domain/target/homography';
import { MAGNIFIER, magnifiedView, magnifierPosition } from './editorInteraction';
import { imageToScreen, scaleOf, type Size, type ViewTransform } from './viewTransform';

// Drawing shared by the editor and the read-only inspection: the photo, ring outlines,
// calibration points and hit markers, all mapped from photo pixels through the view transform.
// Nothing here writes; callers decide what a touch does.

// How a marker is drawn and named. Each kind differs by more than colour: a number, a dashed
// ring with '?', a struck-through dashed ring, or a neutral ring with '–'.
export type MarkerAppearance =
  // Counted: accepted in a draft, or part of a confirmed result.
  | 'counted'
  // A suggestion waiting for review.
  | 'suggestion'
  // A suggestion found with an alignment that has since been changed.
  | 'earlierSuggestion'
  // A mark of a confirmed round that is not in its stored result.
  | 'notInResult';

export const draftAppearance = (mark: HitMark): MarkerAppearance =>
  mark.accepted ? 'counted' : 'suggestion';

export function markName(mark: HitMark, numbers: ReadonlyMap<string, number>): string {
  const number = numbers.get(mark.id);
  return number === undefined ? 'Suggestion' : `Hit ${number}`;
}

export function markStatus(mark: HitMark): string {
  if (!mark.accepted) {
    return mark.uncertain ? 'uncertain suggestion, not counted' : 'suggestion, not counted';
  }
  const origin =
    mark.source === 'manual'
      ? 'marked by you'
      : mark.source === 'suggestedEdited'
        ? 'suggestion you moved'
        : 'accepted suggestion';
  return `${origin}${mark.shots > 1 ? `, ${mark.shots} shots in this hole` : ''}`;
}

export function PhotoLayer({
  uri,
  image,
  view,
}: {
  uri: string;
  image: Size;
  view: ViewTransform;
}) {
  return (
    <Image
      source={{ uri }}
      style={{
        position: 'absolute',
        left: view.offset.x,
        top: view.offset.y,
        width: image.width * scaleOf(view),
        height: image.height * scaleOf(view),
      }}
    />
  );
}

type OverlayProps = {
  view: ViewTransform;
  outlines: readonly (readonly Point[])[] | null;
  calibrationPoints: readonly Point[];
  selectedPoint: number | null;
  marks: readonly HitMark[];
  numbers: ReadonlyMap<string, number>;
  selectedId: string | null;
  // Screen radius of a hole at a photo position, or null when it cannot be computed.
  holeRadius: (position: Point) => number | null;
  appearance?: (mark: HitMark) => MarkerAppearance;
};

export function MarkerOverlay({
  view,
  outlines,
  calibrationPoints,
  selectedPoint,
  marks,
  numbers,
  selectedId,
  holeRadius,
  appearance = draftAppearance,
}: OverlayProps) {
  return (
    <Svg height="100%" pointerEvents="none" style={StyleSheet.absoluteFill} width="100%">
      {(outlines ?? []).map((outline, index) => (
        <Polyline
          key={`ring-${index}`}
          fill="none"
          points={[...outline, outline[0] ?? { x: 0, y: 0 }]
            .map((point) => {
              const screen = imageToScreen(view, point);
              return `${screen.x},${screen.y}`;
            })
            .join(' ')}
          stroke={colors.info}
          strokeOpacity={0.85}
          strokeWidth={1}
        />
      ))}
      {calibrationPoints.map((point, index) => {
        const screen = imageToScreen(view, point);
        const selected = index === selectedPoint;
        return (
          <G key={`cal-${index}`}>
            {selected ? (
              <Circle
                cx={screen.x}
                cy={screen.y}
                fill="none"
                r={16}
                stroke={colors.focus}
                strokeWidth={3}
              />
            ) : null}
            <Circle
              cx={screen.x}
              cy={screen.y}
              fill="none"
              r={9}
              stroke={colors.background}
              strokeWidth={4}
            />
            <Circle
              cx={screen.x}
              cy={screen.y}
              fill="none"
              r={9}
              stroke={colors.accent}
              strokeWidth={2}
            />
            <Line
              stroke={colors.accent}
              strokeWidth={1}
              x1={screen.x - 5}
              x2={screen.x + 5}
              y1={screen.y}
              y2={screen.y}
            />
            <Line
              stroke={colors.accent}
              strokeWidth={1}
              x1={screen.x}
              x2={screen.x}
              y1={screen.y - 5}
              y2={screen.y + 5}
            />
            <SvgText
              fill={colors.accent}
              fontSize={13}
              fontWeight="bold"
              stroke={colors.background}
              strokeWidth={0.5}
              x={screen.x + 13}
              y={screen.y - 11}
            >
              {`${index + 1}`}
            </SvgText>
          </G>
        );
      })}
      {marks.map((mark) => {
        const screen = imageToScreen(view, mark.position);
        // The drawn ring is the hole at its diameter; touch reach is separate.
        const r = Math.max(6, holeRadius(mark.position) ?? 0);
        const number = numbers.get(mark.id);
        const kind = appearance(mark);
        const counted = kind === 'counted';
        const ringColor = counted
          ? colors.accent
          : kind === 'notInResult'
            ? colors.secondary
            : colors.warning;
        const dash = counted ? undefined : kind === 'notInResult' ? '1 3' : '4 3';
        const badgeX = screen.x + r * 0.7 + 9;
        const badgeY = screen.y - r * 0.7 - 9;
        const symbol = counted ? `${number ?? ''}` : kind === 'notInResult' ? '–' : '?';
        return (
          <G key={mark.id}>
            {mark.id === selectedId ? (
              <Circle
                cx={screen.x}
                cy={screen.y}
                fill="none"
                r={r + 7}
                stroke={colors.focus}
                strokeWidth={3}
              />
            ) : null}
            <Circle
              cx={screen.x}
              cy={screen.y}
              fill="none"
              r={r}
              stroke={colors.background}
              strokeWidth={4}
            />
            <Circle
              cx={screen.x}
              cy={screen.y}
              fill="none"
              r={r}
              stroke={ringColor}
              strokeDasharray={dash}
              strokeWidth={2}
            />
            {kind === 'earlierSuggestion' ? (
              // Struck through: found with an alignment that has since changed.
              <Line
                stroke={colors.warning}
                strokeWidth={2}
                x1={screen.x - r * 0.75}
                x2={screen.x + r * 0.75}
                y1={screen.y + r * 0.75}
                y2={screen.y - r * 0.75}
              />
            ) : null}
            <Circle
              cx={badgeX}
              cy={badgeY}
              fill={counted ? colors.accent : colors.surface}
              r={10}
              stroke={counted ? colors.background : ringColor}
              strokeDasharray={counted ? undefined : '3 2'}
              strokeWidth={1.5}
            />
            <SvgText
              fill={counted ? colors.onAccent : ringColor}
              fontSize={12}
              fontWeight="bold"
              textAnchor="middle"
              x={badgeX}
              y={badgeY + 4}
            >
              {symbol}
            </SvgText>
            {mark.shots > 1 ? (
              <SvgText
                fill={colors.text}
                fontSize={11}
                fontWeight="bold"
                stroke={colors.background}
                strokeWidth={0.5}
                x={badgeX + 12}
                y={badgeY + 4}
              >
                {`×${mark.shots}`}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

// About 120 points, about 2× the photo around the edited point, placed away from the finger and
// inside the canvas. It ignores touches and is hidden from screen readers.
export function Magnifier({
  finger,
  focus,
  view,
  canvas,
  image,
  uri,
}: {
  finger: Point;
  focus: Point;
  view: ViewTransform;
  canvas: Size;
  image: Size;
  uri: string;
}) {
  const position = magnifierPosition(finger, canvas);
  const magnified = magnifiedView(view, focus);
  const centre = MAGNIFIER.size / 2;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.magnifier, { left: position.x, top: position.y }]}
    >
      <Image
        source={{ uri }}
        style={{
          position: 'absolute',
          left: magnified.offset.x,
          top: magnified.offset.y,
          width: image.width * magnified.scale,
          height: image.height * magnified.scale,
        }}
      />
      <Svg height={MAGNIFIER.size} width={MAGNIFIER.size}>
        <Line
          stroke={colors.background}
          strokeWidth={3}
          x1={centre}
          x2={centre}
          y1={centre - 14}
          y2={centre + 14}
        />
        <Line
          stroke={colors.background}
          strokeWidth={3}
          x1={centre - 14}
          x2={centre + 14}
          y1={centre}
          y2={centre}
        />
        <Line
          stroke={colors.accent}
          strokeWidth={1.5}
          x1={centre}
          x2={centre}
          y1={centre - 14}
          y2={centre + 14}
        />
        <Line
          stroke={colors.accent}
          strokeWidth={1.5}
          x1={centre - 14}
          x2={centre + 14}
          y1={centre}
          y2={centre}
        />
      </Svg>
    </View>
  );
}

// Every marker as a button, so markers can be found, selected and reviewed with a screen reader
// and overlapping markers can be told apart. Placement itself still needs touch.
export function MarkerList({
  marks,
  numbers,
  selectedId,
  onSelect,
  detail,
  status: statusOf = markStatus,
  appearance = draftAppearance,
}: {
  marks: readonly HitMark[];
  numbers: ReadonlyMap<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  // Extra text per marker, e.g. its score in the inspection view.
  detail?: (mark: HitMark) => string | null;
  // Replaces the default status line, e.g. for confirmed rounds or older suggestions.
  status?: (mark: HitMark) => string;
  appearance?: (mark: HitMark) => MarkerAppearance;
}) {
  if (marks.length === 0) {
    return <Text style={styles.secondary}>No markers yet.</Text>;
  }
  return (
    <View style={styles.list}>
      <Text accessibilityRole="header" style={styles.listTitle}>
        Markers
      </Text>
      {marks.map((mark) => {
        const isSelected = mark.id === selectedId;
        const name = markName(mark, numbers);
        const status = statusOf(mark);
        const counted = appearance(mark) === 'counted';
        const symbol = counted
          ? `${numbers.get(mark.id) ?? ''}`
          : appearance(mark) === 'notInResult'
            ? '–'
            : '?';
        const extra = detail?.(mark) ?? null;
        return (
          <Pressable
            key={mark.id}
            accessibilityLabel={[name, status, extra].filter((part) => part !== null).join(', ')}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(mark.id)}
            style={({ pressed }) => [
              styles.listRow,
              isSelected ? styles.listRowSelected : null,
              pressed ? styles.listRowPressed : null,
            ]}
          >
            <View
              style={[
                styles.listMarker,
                counted ? styles.listMarkerAccepted : styles.listMarkerPending,
              ]}
            >
              <Text style={counted ? styles.listNumber : styles.listQuestion}>{symbol}</Text>
            </View>
            <View style={styles.fill}>
              <Text style={styles.body}>{name}</Text>
              <Text style={styles.caption}>{status}</Text>
            </View>
            {extra === null ? null : <Text style={styles.extra}>{extra}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  secondary: {
    ...typography.body,
    color: colors.secondary,
  },
  caption: {
    ...typography.caption,
    color: colors.secondary,
  },
  extra: {
    ...typography.label,
    color: colors.text,
  },
  magnifier: {
    position: 'absolute',
    width: MAGNIFIER.size,
    height: MAGNIFIER.size,
    overflow: 'hidden',
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.focus,
    backgroundColor: colors.elevated,
  },
  list: {
    gap: spacing.label,
  },
  listTitle: {
    ...typography.label,
    color: colors.text,
  },
  listRow: {
    minHeight: sizes.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.label,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  listRowSelected: {
    borderWidth: 2,
    borderColor: colors.focus,
  },
  listRowPressed: {
    backgroundColor: colors.elevated,
  },
  listMarker: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  listMarkerAccepted: {
    backgroundColor: colors.accent,
  },
  listMarkerPending: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.warning,
    backgroundColor: colors.warningSurface,
  },
  listNumber: {
    ...typography.label,
    color: colors.onAccent,
  },
  listQuestion: {
    ...typography.label,
    color: colors.warning,
  },
});
