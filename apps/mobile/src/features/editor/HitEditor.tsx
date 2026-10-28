import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Crosshair from 'lucide-react-native/icons/crosshair';
import Maximize from 'lucide-react-native/icons/maximize';
import Move from 'lucide-react-native/icons/move';
import Plus from 'lucide-react-native/icons/plus';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Trash2 from 'lucide-react-native/icons/trash';
import Undo2 from 'lucide-react-native/icons/undo-2';
import ZoomIn from 'lucide-react-native/icons/zoom-in';
import ZoomOut from 'lucide-react-native/icons/zoom-out';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  type HostInstance,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { Stepper } from '../../components/Stepper';
import { colors, radius, sizes, spacing, typography } from '../../components/tokens';
import type { DraftRound, HitMark } from '../../domain/round/round';
import { evaluateDraft } from '../../domain/round/roundEvaluation';
import { SHOTS_PER_HOLE_RANGE } from '../../domain/round/roundRules';
import type { Point } from '../../domain/target/homography';
import { findTarget } from '../../domain/target/targetDefinition';
import { saveDraftAnnotations } from '../../persistence/roundRepository';
import { newId } from '../../services/deviceContext';
import { roundStatusText } from '../rounds/roundText';
import { formatShortScore } from '../sessions/sessionProgressText';
import { usePhotoStore } from '../startup/photoStoreContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import {
  type Annotations,
  calibrationOf,
  type EditorAction,
  editorReducer,
  initialEditorState,
} from './annotationEditor';
import {
  type EditorTool,
  MAGNIFIER,
  magnifiedView,
  magnifierPosition,
  markerNumbers,
} from './editorInteraction';
import { createGestureController, type MagnifierFocus } from './gestureController';
import { holeRadiusInPhoto, ringOutlines } from './targetOverlay';
import {
  fitView,
  imageToScreen,
  scaleOf,
  type Size,
  type ViewTransform,
  zoomAround,
} from './viewTransform';

const CALIBRATION_NAMES = ['top', 'right', 'bottom', 'left'] as const;
// The canvas takes this share of the window height; the controls scroll below it.
const CANVAS_SHARE = 0.5;
const MIN_CANVAS_HEIGHT = 260;

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Editor error:', error instanceof Error ? error.name : typeof error);
  }
}

function markName(mark: HitMark, numbers: ReadonlyMap<string, number>): string {
  const number = numbers.get(mark.id);
  return number === undefined ? 'Suggestion' : `Hit ${number}`;
}

function markStatus(mark: HitMark): string {
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

const TOOL_BADGE: Record<EditorTool, string> = {
  calibrate: 'Align mode',
  add: 'Add hit mode',
  pan: 'Select and pan mode',
};

// Screens 07 (align target), 10 (review hits) and 11 (manual editor). Geometry stays in the
// normalised photo's pixels; the view transform, magnifier and touch areas are display only.
export function HitEditor({ draft }: { draft: DraftRound }) {
  const { db } = useSessionStore();
  const photos = usePhotoStore();
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const target = findTarget(draft.targetId);
  const after = draft.photos.after;
  const imageWidth = after?.width ?? 1;
  const imageHeight = after?.height ?? 1;
  const image: Size = useMemo(
    () => ({ width: imageWidth, height: imageHeight }),
    [imageWidth, imageHeight],
  );

  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    initialEditorState(draft.calibration, draft.marks),
  );
  const [tool, setTool] = useState<EditorTool>(() =>
    draft.calibration === null ? 'calibrate' : draft.marks.some((m) => !m.accepted) ? 'pan' : 'add',
  );
  const [canvas, setCanvas] = useState<Size | null>(null);
  const [view, setView] = useState<ViewTransform | null>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; point: Point } | null>(null);
  const [magnifier, setMagnifier] = useState<MagnifierFocus | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [sizeMismatch, setSizeMismatch] = useState(false);

  const canvasRef = useRef<HostInstance>(null);
  const [gestures] = useState(() => createGestureController(newId));
  const writes = useRef<Promise<void>>(Promise.resolve());
  const savedAnnotations = useRef<Annotations>({
    calibrationPoints: state.calibrationPoints,
    marks: state.marks,
  });

  // The gesture controller reads the latest view and marks; dispatch and setters are stable.
  useEffect(() => {
    gestures.update(
      { view, canvas, image, tool, marks: state.marks, selectedId: state.selectedId },
      { dispatch, setView, setDragPreview, setMagnifier },
    );
  }, [gestures, view, canvas, image, tool, state.marks, state.selectedId]);

  // Saves calibration and marks after every edit, in order. Selection alone is not saved.
  useEffect(() => {
    const annotations: Annotations = {
      calibrationPoints: state.calibrationPoints,
      marks: state.marks,
    };
    if (
      annotations.calibrationPoints === savedAnnotations.current.calibrationPoints &&
      annotations.marks === savedAnnotations.current.marks
    ) {
      return;
    }
    savedAnnotations.current = annotations;
    setSaving(true);
    writes.current = writes.current
      .then(() => saveDraftAnnotations(db, draft.id, calibrationOf(annotations), annotations.marks))
      .then(
        () => setSaveError(false),
        (error: unknown) => {
          reportDevError(error);
          setSaveError(true);
        },
      )
      .finally(() => setSaving(false));
  }, [db, draft.id, state.calibrationPoints, state.marks]);

  // Marks are stored in the pixels of the normalised photo, whose size was recorded when it was
  // written. If the decoded file has any other size the marks would not line up, so marking is
  // blocked. Photos saved before normalisation existed only get their shape compared, because
  // the viewer applies their EXIF orientation itself.
  useEffect(() => {
    if (after === null) return;
    Image.getSize(
      photos.uri(after.fileName),
      (width, height) => {
        if (after.originalFileName !== null) {
          setSizeMismatch(width !== after.width || height !== after.height);
          return;
        }
        const stored = after.width / after.height;
        setSizeMismatch(Math.abs(width / height - stored) / stored > 0.02);
      },
      reportDevError,
    );
  }, [after, photos]);

  const calibration = calibrationOf(state);
  const evaluation = evaluateDraft({ ...draft, calibration, marks: state.marks }, target);
  const outlines =
    calibration !== null && target !== null ? ringOutlines(calibration, target) : null;
  const numbers = markerNumbers(state.marks);
  const selected = state.marks.find((mark) => mark.id === state.selectedId) ?? null;
  const pending = evaluation.pendingSuggestions;
  const send = (action: EditorAction) => dispatch(action);
  const roundPath = `/sessions/${draft.sessionId}/rounds/${draft.id}`;
  const canvasHeight = Math.max(MIN_CANVAS_HEIGHT, windowHeight * CANVAS_SHARE);

  const leave = async (next: () => void) => {
    await writes.current;
    next();
  };
  const goBack = () => void leave(() => router.back());

  const zoomBy = (factor: number) => {
    if (view === null || canvas === null) return;
    setView(
      zoomAround(
        view,
        view.zoom * factor,
        { x: canvas.width / 2, y: canvas.height / 2 },
        image,
        canvas,
      ),
    );
  };

  const title = tool === 'calibrate' ? 'Align target' : pending > 0 ? 'Review hits' : 'Mark hits';
  const subtitle = `Round ${draft.sequence} · ${saveError ? 'Not saved' : saving ? 'Saving…' : 'Draft saved'}`;
  const nextPoint = CALIBRATION_NAMES[state.calibrationPoints.length];

  const instructions =
    tool === 'calibrate'
      ? calibration === null
        ? `Point ${state.calibrationPoints.length + 1} of 4: touch the ${nextPoint ?? 'top'} point where the outer scoring ring crosses the line of numbers. Drag before lifting to place it precisely; zoom in first if needed.`
        : outlines === null
          ? 'These points do not form a valid outline. Restart and place them in order: top, right, bottom, left.'
          : 'Check that the drawn rings follow the printed rings. If they do not, restart the alignment.'
      : tool === 'add'
        ? 'Touch the centre of each hole to add a hit. Touching a marker selects it; drag a selected marker to move it.'
        : 'Drag to pan and pinch to zoom; nothing is added. Touch a marker to select it, again to step through overlapping markers.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <ScreenHeader onBack={goBack} subtitle={subtitle} title={title} />
      </View>
      {after === null ? (
        <View style={styles.header}>
          <Banner body="Add an after photo on the round screen first." tone="error" />
        </View>
      ) : (
        <>
          <View style={styles.statusRow}>
            <StatusBadge label={TOOL_BADGE[tool]} tone="accent" />
            <Text style={styles.secondary}>
              {pending > 0
                ? `${numbers.size} accepted / ${pending} to review`
                : `${state.marks.length} marked`}
            </Text>
          </View>
          <View
            ref={canvasRef}
            accessible
            accessibilityHint="Placing and moving markers needs touch. Review and remove markers in the list below."
            accessibilityLabel={`After photo with ${state.marks.length} ${state.marks.length === 1 ? 'marker' : 'markers'}`}
            onLayout={(event) => {
              const size = {
                width: event.nativeEvent.layout.width,
                height: event.nativeEvent.layout.height,
              };
              setCanvas(size);
              setView((current) => current ?? fitView(image, size));
              // measure() reports page coordinates, the same system as touch pageX/pageY, so
              // no status-bar or header offset is assumed (step 7 measurements).
              canvasRef.current?.measure((_x, _y, _width, _height, pageX, pageY) =>
                gestures.setOrigin({ x: pageX, y: pageY }),
              );
            }}
            style={[styles.canvas, { height: canvasHeight }]}
            {...gestures.panHandlers}
          >
            {view === null ? null : (
              <>
                <Image
                  source={{ uri: photos.uri(after.fileName) }}
                  style={{
                    position: 'absolute',
                    left: view.offset.x,
                    top: view.offset.y,
                    width: image.width * scaleOf(view),
                    height: image.height * scaleOf(view),
                  }}
                />
                <Svg
                  height="100%"
                  pointerEvents="none"
                  style={StyleSheet.absoluteFill}
                  width="100%"
                >
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
                  {state.calibrationPoints.map((point, index) => {
                    const screen = imageToScreen(view, point);
                    return (
                      <G key={`cal-${index}`}>
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
                        <SvgText
                          fill={colors.accent}
                          fontSize={13}
                          fontWeight="bold"
                          stroke={colors.background}
                          strokeWidth={0.5}
                          x={screen.x + 12}
                          y={screen.y - 10}
                        >
                          {`${index + 1}`}
                        </SvgText>
                      </G>
                    );
                  })}
                  {state.marks.map((mark) => {
                    const position =
                      dragPreview?.id === mark.id ? dragPreview.point : mark.position;
                    const screen = imageToScreen(view, position);
                    const holeRadius =
                      target === null
                        ? null
                        : holeRadiusInPhoto(calibration, target, position, draft.hitDiameterMm);
                    // The drawn ring is the hole at its diameter; touch reach is separate.
                    const r = Math.max(6, (holeRadius ?? 0) * scaleOf(view));
                    const number = numbers.get(mark.id);
                    const ringColor = mark.accepted ? colors.accent : colors.warning;
                    const badgeX = screen.x + r * 0.7 + 9;
                    const badgeY = screen.y - r * 0.7 - 9;
                    return (
                      <G key={mark.id}>
                        {mark.id === state.selectedId ? (
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
                          strokeDasharray={mark.accepted ? undefined : '4 3'}
                          strokeWidth={2}
                        />
                        <Circle
                          cx={badgeX}
                          cy={badgeY}
                          fill={mark.accepted ? colors.accent : colors.warningSurface}
                          r={10}
                          stroke={mark.accepted ? colors.background : colors.warning}
                          strokeDasharray={mark.accepted ? undefined : '3 2'}
                          strokeWidth={1.5}
                        />
                        <SvgText
                          fill={mark.accepted ? colors.onAccent : colors.warning}
                          fontSize={12}
                          fontWeight="bold"
                          textAnchor="middle"
                          x={badgeX}
                          y={badgeY + 4}
                        >
                          {number === undefined ? '?' : `${number}`}
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
                {magnifier === null || canvas === null ? null : (
                  <Magnifier
                    canvas={canvas}
                    focus={magnifier}
                    image={image}
                    uri={photos.uri(after.fileName)}
                    view={view}
                  />
                )}
              </>
            )}
          </View>

          <View style={styles.toolbar}>
            <IconButton
              disabled={calibration === null}
              icon={Plus}
              label="Add hits"
              onPress={() => setTool('add')}
              selected={tool === 'add'}
            />
            <IconButton
              icon={Move}
              label="Select and pan"
              onPress={() => setTool('pan')}
              selected={tool === 'pan'}
            />
            <IconButton
              icon={Crosshair}
              label="Align target"
              onPress={() => setTool('calibrate')}
              selected={tool === 'calibrate'}
            />
            <IconButton
              disabled={state.history.length === 0}
              icon={Undo2}
              label="Undo"
              onPress={() => send({ type: 'undo' })}
            />
            <IconButton icon={ZoomIn} label="Zoom in" onPress={() => zoomBy(1.5)} />
            <IconButton icon={ZoomOut} label="Zoom out" onPress={() => zoomBy(1 / 1.5)} />
            <IconButton
              icon={Maximize}
              label="Fit photo"
              onPress={() => canvas !== null && setView(fitView(image, canvas))}
            />
          </View>

          <ScrollView contentContainerStyle={styles.panel} style={styles.fill}>
            {sizeMismatch ? (
              <Banner
                body="This photo doesn't match its saved size, so marks wouldn't line up. Take or choose the photo again on the round screen."
                title="Photo unavailable for marking"
                tone="error"
              />
            ) : null}
            {saveError ? (
              <Banner
                body="Couldn't save the latest change. Make another change to try again."
                title="Not saved"
                tone="error"
              />
            ) : null}
            <Text accessibilityLiveRegion="polite" style={styles.instructions}>
              {instructions}
            </Text>

            {tool === 'calibrate' ? (
              <>
                {state.calibrationPoints.length > 0 ? (
                  <Button
                    icon={RotateCcw}
                    label="Restart alignment"
                    onPress={() => send({ type: 'restartCalibration' })}
                    variant="secondary"
                  />
                ) : null}
                <Text style={styles.caption}>
                  The drawn rings come from the demo target definition. Aligning them does not
                  verify the target or make scores real.
                </Text>
                <Button
                  disabled={calibration === null || outlines === null}
                  icon={ChevronRight}
                  label="Continue"
                  onPress={() => void leave(() => router.back())}
                />
              </>
            ) : (
              <>
                {selected === null ? null : (
                  <Inspector
                    diameterMm={draft.hitDiameterMm}
                    diameterAssumed={draft.hitDiameterSource === 'assumed'}
                    mark={selected}
                    name={markName(selected, numbers)}
                    onAccept={() => send({ type: 'acceptMark', id: selected.id })}
                    onDelete={() => send({ type: 'deleteMark', id: selected.id })}
                    onShots={(shots) => send({ type: 'setShots', id: selected.id, shots })}
                  />
                )}
                <MarkerList
                  marks={state.marks}
                  numbers={numbers}
                  onSelect={(id) => send({ type: 'select', id })}
                  selectedId={state.selectedId}
                />
                <Text style={styles.summary}>
                  {evaluation.hitShots === 1
                    ? '1 hit shot counted'
                    : `${evaluation.hitShots} hit shots counted`}
                  {pending > 0 ? ` · ${pending} to review` : ''} · {draft.actualShots} fired
                  {evaluation.score === null
                    ? ''
                    : ` · ${formatShortScore(evaluation.score.subtotal, evaluation.status === 'complete', target?.isDemo !== false)}`}
                </Text>
                <Button
                  disabled={pending > 0}
                  icon={ChevronRight}
                  label="Review round"
                  onPress={() => void leave(() => router.push(`${roundPath}/confirm`))}
                />
                <Text style={styles.caption}>
                  {pending > 0
                    ? `Accept or remove ${pending === 1 ? 'the remaining suggestion' : `the ${pending} remaining suggestions`} to continue.`
                    : roundStatusText(evaluation, draft.actualShots)}
                </Text>
              </>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

// About 120 points, about 2× the photo around the edited point, placed away from the finger and
// inside the canvas. It ignores touches and is hidden from screen readers.
function Magnifier({
  focus,
  view,
  canvas,
  image,
  uri,
}: {
  focus: MagnifierFocus;
  view: ViewTransform;
  canvas: Size;
  image: Size;
  uri: string;
}) {
  const position = magnifierPosition(focus.finger, canvas);
  const magnified = magnifiedView(view, focus.image);
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

// components/19-hit-inspector.png, outside the photo. Removing a suggestion never records a
// miss; the shot accounting asks for misses and unresolved shots explicitly.
function Inspector({
  mark,
  name,
  diameterMm,
  diameterAssumed,
  onAccept,
  onDelete,
  onShots,
}: {
  mark: HitMark;
  name: string;
  diameterMm: number;
  diameterAssumed: boolean;
  onAccept: () => void;
  onDelete: () => void;
  onShots: (shots: number) => void;
}) {
  return (
    <View style={[styles.inspector, mark.accepted ? null : styles.inspectorPending]}>
      <View style={styles.inspectorTop}>
        <Text accessibilityRole="header" style={styles.inspectorTitle}>
          {mark.accepted ? `${name} selected` : 'Suggested hit'}
        </Text>
        <StatusBadge
          label={mark.accepted ? 'Counted' : mark.uncertain ? 'Uncertain' : 'Not counted'}
          tone={mark.accepted ? 'success' : 'warning'}
        />
      </View>
      {mark.accepted ? null : (
        <Text style={styles.secondary}>
          {mark.uncertain
            ? '? It may be a tear, a sticker edge or several holes. Check the mark on your photo.'
            : 'Check the mark on your photo. Accept it only if it is a new hole.'}
        </Text>
      )}
      {mark.accepted ? (
        <Stepper
          label="Shots in this hole"
          max={SHOTS_PER_HOLE_RANGE.max}
          min={SHOTS_PER_HOLE_RANGE.min}
          onChange={onShots}
          value={mark.shots}
        />
      ) : null}
      <Text style={styles.secondary}>
        Hole diameter {diameterMm.toFixed(1)} mm ({diameterAssumed ? 'assumed' : 'set by you'}), the
        same for every hit in this round.
      </Text>
      <View style={styles.inspectorActions}>
        {mark.accepted ? null : (
          <View style={styles.inspectorAction}>
            <Button icon={Check} label="Accept" onPress={onAccept} />
          </View>
        )}
        <View style={styles.inspectorAction}>
          <Button
            icon={Trash2}
            label={mark.accepted ? 'Delete hit' : 'Remove'}
            onPress={onDelete}
            variant={mark.accepted ? 'destructive' : 'secondary'}
          />
        </View>
      </View>
      <Text style={styles.caption}>
        Drag a selected marker to move it. Pinch to zoom. Removing a marker does not record a miss.
      </Text>
    </View>
  );
}

// Every marker as a button, so suggestions can be found, selected and reviewed with a screen
// reader and overlapping markers can be told apart. Placement itself still needs touch.
function MarkerList({
  marks,
  numbers,
  selectedId,
  onSelect,
}: {
  marks: readonly HitMark[];
  numbers: ReadonlyMap<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
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
        const status = markStatus(mark);
        return (
          <Pressable
            key={mark.id}
            accessibilityLabel={`${name}, ${status}`}
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
                mark.accepted ? styles.listMarkerAccepted : styles.listMarkerPending,
              ]}
            >
              <Text style={mark.accepted ? styles.listNumber : styles.listQuestion}>
                {numbers.get(mark.id) ?? '?'}
              </Text>
            </View>
            <View style={styles.fill}>
              <Text style={styles.body}>{name}</Text>
              <Text style={styles.caption}>{status}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.inset,
    paddingTop: spacing.small,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.label,
    paddingHorizontal: spacing.inset,
    paddingTop: spacing.small,
  },
  canvas: {
    marginTop: spacing.small,
    marginHorizontal: spacing.inset,
    overflow: 'hidden',
    borderRadius: radius.card,
    backgroundColor: colors.elevated,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.label,
    paddingHorizontal: spacing.inset,
    paddingTop: spacing.small,
  },
  panel: {
    gap: spacing.small,
    padding: spacing.inset,
  },
  instructions: {
    ...typography.body,
    color: colors.text,
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
  summary: {
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
  inspector: {
    gap: spacing.small,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  inspectorPending: {
    borderColor: colors.accent,
  },
  inspectorTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.label,
  },
  inspectorTitle: {
    ...typography.section,
    color: colors.text,
  },
  inspectorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  inspectorAction: {
    flexGrow: 1,
    flexBasis: 130,
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
