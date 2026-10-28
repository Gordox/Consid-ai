import Undo2 from 'lucide-react-native/icons/undo-2';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { type HostInstance, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Polyline, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Stepper } from '../../components/Stepper';
import { colors, radius, spacing, typography } from '../../components/tokens';
import type { DraftRound, HitMark } from '../../domain/round/round';
import { evaluateDraft } from '../../domain/round/roundEvaluation';
import { SHOTS_PER_HOLE_RANGE } from '../../domain/round/roundRules';
import type { Point } from '../../domain/target/homography';
import { DEMO_TARGET_NOTICE, findTarget } from '../../domain/target/targetDefinition';
import { saveDraftAnnotations } from '../../persistence/roundRepository';
import { newId } from '../../services/deviceContext';
import { roundStatusText } from '../rounds/roundText';
import { formatPoints } from '../sessions/sessionProgressText';
import { usePhotoStore } from '../startup/photoStoreContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import {
  type Annotations,
  calibrationOf,
  type EditorAction,
  editorReducer,
  initialEditorState,
} from './annotationEditor';
import { createGestureController, type EditorMode } from './gestureController';
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
function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Editor error:', error instanceof Error ? error.name : typeof error);
  }
}

// Pending suggestions are dashed and uncertain ones also carry "?", so the state never relies
// on colour alone.
function markColor(mark: HitMark): string {
  if (mark.uncertain) return colors.warning;
  return mark.source === 'manual' ? colors.success : colors.info;
}

function markLabel(mark: HitMark): string {
  return `${mark.uncertain ? '?' : ''}${mark.shots > 1 ? `×${mark.shots}` : ''}`;
}

export function HitEditor({ draft }: { draft: DraftRound }) {
  const { db } = useSessionStore();
  const photos = usePhotoStore();
  const router = useRouter();
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
  const [mode, setMode] = useState<EditorMode>(draft.calibration === null ? 'calibrate' : 'mark');
  const [canvas, setCanvas] = useState<Size | null>(null);
  const [view, setView] = useState<ViewTransform | null>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; point: Point } | null>(null);
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
      { view, canvas, image, mode, marks: state.marks, selectedId: state.selectedId },
      { dispatch, setView, setDragPreview },
    );
  }, [gestures, view, canvas, image, mode, state.marks, state.selectedId]);

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
    writes.current = writes.current
      .then(() => saveDraftAnnotations(db, draft.id, calibrationOf(annotations), annotations.marks))
      .then(
        () => setSaveError(false),
        (error: unknown) => {
          reportDevError(error);
          setSaveError(true);
        },
      );
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
  const selected = state.marks.find((mark) => mark.id === state.selectedId) ?? null;
  const certainPending = state.marks.filter((mark) => !mark.accepted && !mark.uncertain).length;
  const send = (action: EditorAction) => dispatch(action);

  const done = async () => {
    await writes.current;
    router.back();
  };

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

  const instructions =
    mode === 'calibrate'
      ? calibration === null
        ? `Tap point ${state.calibrationPoints.length + 1} of 4: the ${
            CALIBRATION_NAMES[state.calibrationPoints.length] ?? 'top'
          } point where the outer ring crosses the line of numbers. Pinch or use + to zoom first.`
        : outlines === null
          ? 'These points do not form a valid outline. Restart calibration and tap them in order: top, right, bottom, left.'
          : 'Calibration set. Check that the drawn rings follow the printed rings, then switch to marking hits.'
      : 'Tap the centre of each hole to mark it. Tap a mark to select it, then drag it to move it.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <ScreenHeader onBack={() => void done()} title={`Round ${draft.sequence} hits`} />
      </View>
      {after === null ? (
        <Banner body="Add an after photo on the round screen first." tone="error" />
      ) : (
        <>
          <View
            ref={canvasRef}
            onLayout={(event) => {
              const size = {
                width: event.nativeEvent.layout.width,
                height: event.nativeEvent.layout.height,
              };
              setCanvas(size);
              setView((current) => current ?? fitView(image, size));
              // measure() reports page coordinates, the same system as touch pageX/pageY.
              // measureInWindow can differ by the status bar (step 7 measurements).
              canvasRef.current?.measure((_x, _y, _width, _height, pageX, pageY) =>
                gestures.setOrigin({ x: pageX, y: pageY }),
              );
            }}
            style={styles.canvas}
            {...gestures.panHandlers}
          >
            {view === null ? null : (
              <>
                <Image
                  accessibilityLabel="After photo"
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
                      strokeOpacity={0.8}
                      strokeWidth={1}
                    />
                  ))}
                  {state.calibrationPoints.map((point, index) => {
                    const screen = imageToScreen(view, point);
                    return (
                      <SvgText
                        key={`cal-${index}`}
                        fill={colors.accent}
                        fontSize={16}
                        fontWeight="bold"
                        textAnchor="middle"
                        x={screen.x}
                        y={screen.y + 6}
                      >
                        {`+${index + 1}`}
                      </SvgText>
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
                    const r = Math.max(6, (holeRadius ?? 0) * scaleOf(view));
                    const isSelected = mark.id === state.selectedId;
                    return (
                      <G key={mark.id}>
                        <Circle
                          cx={screen.x}
                          cy={screen.y}
                          fill="none"
                          r={r}
                          stroke={isSelected ? colors.accent : markColor(mark)}
                          strokeDasharray={mark.accepted ? undefined : '5 4'}
                          strokeWidth={isSelected ? 3 : 2}
                        />
                        {markLabel(mark) === '' ? null : (
                          <SvgText
                            fill={mark.uncertain ? colors.warning : colors.text}
                            fontSize={13}
                            fontWeight="bold"
                            x={screen.x + r + 3}
                            y={screen.y - r}
                          >
                            {markLabel(mark)}
                          </SvgText>
                        )}
                      </G>
                    );
                  })}
                </Svg>
              </>
            )}
          </View>

          <View style={styles.panel}>
            {sizeMismatch ? (
              <Banner
                body="This photo doesn't match its saved size, so marks wouldn't line up. Take or choose the photo again on the round screen."
                tone="error"
              />
            ) : null}
            {saveError ? (
              <Banner
                body="Couldn't save the latest change. Make another change to try again."
                tone="error"
              />
            ) : null}
            <View style={styles.row}>
              <Button
                label="Calibrate"
                onPress={() => setMode('calibrate')}
                variant={mode === 'calibrate' ? 'primary' : 'secondary'}
              />
              <Button
                disabled={calibration === null}
                label="Mark hits"
                onPress={() => setMode('mark')}
                variant={mode === 'mark' ? 'primary' : 'secondary'}
              />
            </View>
            <Text style={styles.instructions}>{instructions}</Text>
            <View style={styles.row}>
              <Button label="−" onPress={() => zoomBy(1 / 1.5)} variant="secondary" />
              <Button
                label="Fit"
                onPress={() => canvas !== null && setView(fitView(image, canvas))}
                variant="secondary"
              />
              <Button label="+" onPress={() => zoomBy(1.5)} variant="secondary" />
              <Button
                disabled={state.history.length === 0}
                icon={Undo2}
                label="Undo"
                onPress={() => send({ type: 'undo' })}
                variant="secondary"
              />
            </View>
            {mode === 'calibrate' && state.calibrationPoints.length > 0 ? (
              <Button
                label="Restart calibration"
                onPress={() => send({ type: 'restartCalibration' })}
                variant="secondary"
              />
            ) : null}
            {mode === 'mark' && certainPending > 0 ? (
              <Button
                label={
                  certainPending === 1
                    ? 'Accept 1 suggestion'
                    : `Accept ${certainPending} suggestions`
                }
                onPress={() => send({ type: 'acceptCertainSuggestions' })}
                variant="secondary"
              />
            ) : null}
            {mode === 'mark' && selected !== null ? (
              <View style={styles.selected}>
                {selected.accepted ? null : (
                  <Text style={selected.uncertain ? styles.warning : styles.instructions}>
                    {selected.uncertain
                      ? '? Uncertain suggestion: it may be a tear, sticker edge or several holes. Check it against the photo.'
                      : 'Suggestion, not counted yet. Accept it if it is a real new hole.'}
                  </Text>
                )}
                {selected.accepted ? null : (
                  <Button
                    label="Accept hit"
                    onPress={() => send({ type: 'acceptMark', id: selected.id })}
                  />
                )}
                <Stepper
                  label="Shots in this hole"
                  max={SHOTS_PER_HOLE_RANGE.max}
                  min={SHOTS_PER_HOLE_RANGE.min}
                  onChange={(shots) => send({ type: 'setShots', id: selected.id, shots })}
                  value={selected.shots}
                />
                <Button
                  label="Delete mark"
                  onPress={() => send({ type: 'deleteMark', id: selected.id })}
                  variant="destructive"
                />
              </View>
            ) : null}
            <Text style={styles.summary}>
              {evaluation.hitShots === 1 ? '1 hit shot' : `${evaluation.hitShots} hit shots`}
              {evaluation.pendingSuggestions > 0
                ? ` + ${evaluation.pendingSuggestions} to review`
                : ''}{' '}
              · {draft.actualShots} fired
              {evaluation.score === null
                ? ''
                : ` · ${formatPoints(evaluation.score.subtotal, evaluation.status === 'complete')}`}
            </Text>
            <Text style={styles.supporting}>{roundStatusText(evaluation, draft.actualShots)}</Text>
            {target?.isDemo === true ? (
              <Text style={styles.notice}>{DEMO_TARGET_NOTICE}</Text>
            ) : null}
            <Text style={styles.supporting}>
              Solid: counted hits (green yours, blue accepted suggestions). Dashed: suggestions not
              counted yet. ?: uncertain.
            </Text>
            <Button label="Done" onPress={() => void done()} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.inset,
    paddingTop: spacing.small,
  },
  canvas: {
    flex: 1,
    minHeight: 260,
    marginVertical: spacing.small,
    overflow: 'hidden',
    backgroundColor: colors.elevated,
  },
  panel: {
    gap: spacing.small,
    paddingHorizontal: spacing.inset,
    paddingBottom: spacing.small,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  instructions: {
    ...typography.body,
    color: colors.text,
  },
  selected: {
    gap: spacing.small,
    padding: spacing.small,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  warning: {
    ...typography.label,
    color: colors.warning,
  },
  summary: {
    ...typography.label,
    color: colors.text,
  },
  supporting: {
    ...typography.caption,
    color: colors.secondary,
  },
  notice: {
    ...typography.caption,
    color: colors.warning,
  },
});
