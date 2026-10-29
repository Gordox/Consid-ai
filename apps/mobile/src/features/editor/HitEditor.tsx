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
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  type HostInstance,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { Stepper } from '../../components/Stepper';
import { colors, radius, spacing, typography } from '../../components/tokens';
import { calibrationProblem } from '../../domain/round/calibrationCheck';
import type { Calibration, DraftRound, HitMark } from '../../domain/round/round';
import { type SuggestionBasis, suggestionBasis } from '../../domain/round/suggestionBasis';
import { evaluateDraft } from '../../domain/round/roundEvaluation';
import { SHOTS_PER_HOLE_RANGE } from '../../domain/round/roundRules';
import { findTarget } from '../../domain/target/targetDefinition';
import { DraftChangedError, saveDraftAnnotations } from '../../persistence/roundRepository';
import { newId } from '../../services/deviceContext';
import { createDraftWriteQueue } from '../rounds/draftWriteQueue';
import { RoundProgress } from '../rounds/RoundProgress';
import { useLeaveGuard } from '../useLeaveGuard';
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
import { type EditorTool, markerNumbers } from './editorInteraction';
import {
  createGestureController,
  type DragPreview,
  type MagnifierFocus,
} from './gestureController';
import {
  Magnifier,
  type MarkerAppearance,
  MarkerList,
  MarkerOverlay,
  markName,
  markStatus,
  PhotoLayer,
} from './PhotoMarkers';
import { holeRadiusInPhoto, ringOutlines } from './targetOverlay';
import { fitView, scaleOf, type Size, type ViewTransform, zoomAround } from './viewTransform';

const CALIBRATION_NAMES = ['Top', 'Right', 'Bottom', 'Left'] as const;
// The image area's share of the window height, with a floor. The page scrolls around it.
const CANVAS_SHARE = 0.58;
const MIN_CANVAS_HEIGHT = 280;

const PROBLEM_TEXT = {
  tooClose: 'Two points are on top of each other. Drag the highlighted point to its own place.',
  wrongOrder:
    'The points do not go round the target in order: top, right, bottom, left. Drag each one to its crossing, or reset and place them again.',
} as const;

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Editor error:', error instanceof Error ? error.name : typeof error);
  }
}

const LEAVE_TEXTS = {
  stillSaving: {
    title: 'Still saving your changes',
    body: 'Saving is taking longer than usual. If you leave, the latest change may or may not be saved.',
  },
  notSaved: {
    title: "Your last change wasn't saved",
    body: 'Leave anyway? The round keeps what was saved before it.',
  },
} as const;

const TOOL_BADGE: Record<EditorTool, string> = {
  calibrate: 'Align mode',
  add: 'Add hit mode',
  pan: 'Select and pan mode',
};

// Screens 07 (align target), 10 (review hits) and 11 (manual editor). Geometry stays in the
// normalised photo's pixels; the view transform, previews, magnifier and touch areas are display
// only. Edits are saved once per gesture, when the finger lifts.
export function HitEditor({
  draft,
  attemptCalibrations,
  lostChanges,
  onConflict,
  analysisRunning,
  cancellingAnalysis,
  onCancelAnalysis,
}: {
  draft: DraftRound;
  // The calibration each analysis attempt of the round was sent with.
  attemptCalibrations: ReadonlyMap<string, Calibration | null>;
  // Changes lost to the last conflict, shown once the editor has been reloaded.
  lostChanges: number;
  // The draft changed elsewhere; the screen reads it again and remounts the editor.
  onConflict: (lostChanges: number) => void;
  // While an analysis of this round runs the photo is read-only: its answer replaces suggestions.
  analysisRunning: boolean;
  cancellingAnalysis: boolean;
  onCancelAnalysis: () => void;
}) {
  const { db } = useSessionStore();
  const photos = usePhotoStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [magnifier, setMagnifier] = useState<MagnifierFocus | null>(null);
  const [touching, setTouching] = useState(false);
  const [sizeMismatch, setSizeMismatch] = useState(false);

  const canvasRef = useRef<HostInstance>(null);
  const [gestures] = useState(() => createGestureController(newId));
  // Each committed edit is one snapshot, written at the revision of the previous write. If the
  // draft changed elsewhere the queue stops and the editor is reloaded (draftWriteQueue.ts).
  const [writes] = useState(() =>
    createDraftWriteQueue<Annotations>({
      initialRevision: draft.revision,
      write: (annotations, expectedRevision) =>
        saveDraftAnnotations(
          db,
          draft.id,
          expectedRevision,
          calibrationOf(annotations),
          annotations.marks,
        ),
      isConflict: (error) => error instanceof DraftChangedError,
      reportError: reportDevError,
    }),
  );
  const writeStatus = useSyncExternalStore(writes.subscribe, writes.status);
  const saving = writeStatus.pending > 0;
  const saveError = writeStatus.failed;
  const conflicted = writeStatus.lostChanges > 0;
  const editable = !analysisRunning && !conflicted;
  const savedAnnotations = useRef<Annotations>({
    calibrationPoints: state.calibrationPoints,
    marks: state.marks,
  });

  // Touches are converted with the canvas's page position, which changes when the page scrolls
  // or the layout changes; it is measured again then, never assumed from a status bar height.
  const measureCanvas = useCallback(() => {
    canvasRef.current?.measure((_x, _y, _width, _height, pageX, pageY) =>
      gestures.setOrigin({ x: pageX, y: pageY }),
    );
  }, [gestures]);

  // While the photo is read-only only selection reaches the reducer, as in the inspection.
  const gestureDispatch = useCallback(
    (action: EditorAction) => {
      if (editable || action.type === 'select') dispatch(action);
    },
    [editable],
  );
  useEffect(() => {
    gestures.update(
      {
        view,
        canvas,
        image,
        tool: editable ? tool : 'pan',
        marks: state.marks,
        selectedId: state.selectedId,
        calibrationPoints: state.calibrationPoints,
        readOnly: !editable,
      },
      { dispatch: gestureDispatch, setView, setDragPreview: setPreview, setMagnifier },
    );
  }, [
    gestures,
    view,
    canvas,
    image,
    tool,
    editable,
    gestureDispatch,
    state.marks,
    state.selectedId,
    state.calibrationPoints,
  ]);

  // Saves calibration and marks after every committed edit, in order. Selection, previews and
  // view changes are not saved.
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
    writes.enqueue(annotations);
  }, [writes, state.calibrationPoints, state.marks]);

  // Once every queued write has finished, a stopped queue hands over to the screen, which reads
  // the draft again. The snapshots made from the outdated draft are never written.
  const reportedConflict = useRef(false);
  useEffect(() => {
    if (!conflicted || reportedConflict.current) return;
    reportedConflict.current = true;
    void writes.settled().then(() => onConflict(writes.status().lostChanges));
  }, [conflicted, writes, onConflict]);

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

  // What is on screen includes the point or mark being dragged, so the rings follow the finger.
  const livePoints =
    preview?.kind === 'calibration'
      ? state.calibrationPoints.map((point, index) =>
          index === preview.index ? preview.point : point,
        )
      : state.calibrationPoints;
  const liveProblem = calibrationProblem(livePoints, image);
  const liveCalibration =
    liveProblem === null ? calibrationOf({ calibrationPoints: livePoints, marks: [] }) : null;
  const outlines =
    liveCalibration !== null && target !== null ? ringOutlines(liveCalibration, target) : null;
  const liveMarks: readonly HitMark[] =
    preview?.kind === 'mark'
      ? state.marks.map((mark) =>
          mark.id === preview.id ? { ...mark, position: preview.point } : mark,
        )
      : state.marks;

  const calibration = calibrationOf(state);
  const problem = calibrationProblem(state.calibrationPoints, image);
  // Pending suggestions keep their photo positions when the alignment changes, but the search
  // that found them used the earlier alignment; they are marked and the user can analyse again.
  const basisOf = (mark: HitMark) =>
    suggestionBasis(mark, (id) => attemptCalibrations.get(id), calibration);
  const appearance = (mark: HitMark): MarkerAppearance =>
    mark.accepted
      ? 'counted'
      : basisOf(mark) === 'earlierAlignment'
        ? 'earlierSuggestion'
        : 'suggestion';
  const statusOf = (mark: HitMark): string =>
    mark.accepted
      ? markStatus(mark)
      : basisOf(mark) === 'earlierAlignment'
        ? 'suggestion from an earlier alignment, not counted'
        : basisOf(mark) === 'unrecorded'
          ? `${markStatus(mark)}; alignment used not recorded`
          : markStatus(mark);
  const earlierSuggestions = state.marks.filter(
    (mark) => !mark.accepted && basisOf(mark) === 'earlierAlignment',
  ).length;
  const evaluation = evaluateDraft({ ...draft, calibration, marks: state.marks }, target);
  const numbers = markerNumbers(state.marks);
  const selected = state.marks.find((mark) => mark.id === state.selectedId) ?? null;
  const pending = evaluation.pendingSuggestions;
  const send = (action: EditorAction) => {
    if (editable || action.type === 'select') dispatch(action);
  };
  const roundPath = `/sessions/${draft.sessionId}/rounds/${draft.id}`;
  const canvasHeight = Math.max(MIN_CANVAS_HEIGHT, windowHeight * CANVAS_SHARE);
  const aligned = calibration !== null && problem === null && outlines !== null;

  // Every way back waits for the queued writes; a failed last write must be acknowledged.
  const leave = useLeaveGuard(() => {
    const current = writes.status();
    if (current.pending > 0) return writes.settled();
    return current.failed ? Promise.resolve('failed') : null;
  }, LEAVE_TEXTS);
  const goBack = () => router.back();
  // Opening the review is not leaving, so it waits here for the writes it depends on.
  const reviewRound = async () => {
    if ((await writes.settled()) === 'saved') router.push(`${roundPath}/confirm`);
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

  const title = tool === 'calibrate' ? 'Align target' : pending > 0 ? 'Review hits' : 'Mark hits';
  const saveState = saveError ? 'Not saved' : saving ? 'Saving…' : 'Draft saved';
  const subtitle =
    tool === 'calibrate'
      ? `Round ${draft.sequence} · After photo · ${saveState}`
      : `Round ${draft.sequence} · ${saveState}`;
  const placed = state.calibrationPoints.length;
  const selectedPointName =
    state.selectedPoint === null ? undefined : CALIBRATION_NAMES[state.selectedPoint];

  const calibrateHeading =
    placed < 4
      ? `Point ${placed + 1} of 4: ${CALIBRATION_NAMES[placed] ?? 'Top'}`
      : selectedPointName !== undefined
        ? `${selectedPointName} point selected`
        : 'All four points placed';
  const calibrateHelp =
    placed < 4
      ? 'Touch where the outer scoring ring crosses the line of numbers. Drag before lifting to place it precisely.'
      : 'Drag any point to adjust it; the rings follow. Check that they match the printed rings.';
  const markHelp =
    tool === 'add'
      ? 'Touch the centre of each hole to add a hit. Drag a selected marker to move it.'
      : 'Drag to pan and pinch to zoom; nothing is added. Touch a marker to select it.';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={measureCanvas}
        onScroll={measureCanvas}
        onScrollEndDrag={measureCanvas}
        scrollEnabled={!touching}
        scrollEventThrottle={32}
        style={styles.fill}
      >
        <ScreenHeader onBack={goBack} subtitle={subtitle} title={title} />
        {after === null ? (
          <Banner body="Add an after photo on the round screen first." tone="error" />
        ) : (
          <>
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
            {lostChanges > 0 ? (
              <Banner
                body={`This round changed while you were editing, for example because new suggestions arrived. ${lostChanges === 1 ? 'Your last change was' : `Your last ${lostChanges} changes were`} not saved. The photo now shows the saved round; check it and redo what is missing.`}
                title="Round changed"
                tone="warning"
              />
            ) : null}
            {analysisRunning ? (
              <Banner
                body="Editing is paused until the analysis finishes or you cancel it. You can still zoom, pan and select markers."
                title="Analysis running"
                tone="info"
              >
                <Button
                  busy={cancellingAnalysis}
                  label={cancellingAnalysis ? 'Cancelling…' : 'Cancel analysis'}
                  onPress={onCancelAnalysis}
                  variant="secondary"
                />
              </Banner>
            ) : null}

            <RoundProgress
              current={tool === 'calibrate' ? 'align' : 'review'}
              draft={{ photos: draft.photos, calibration: aligned ? calibration : null }}
            />
            <View style={styles.instructions}>
              <View style={styles.statusRow}>
                <StatusBadge label={TOOL_BADGE[tool]} tone="accent" />
                {tool === 'calibrate' ? null : (
                  <Text style={styles.secondary}>
                    {pending > 0
                      ? `${numbers.size} accepted / ${pending} to review`
                      : `${state.marks.length} marked`}
                  </Text>
                )}
              </View>
              <Text accessibilityLiveRegion="polite" style={styles.heading}>
                {tool === 'calibrate' ? calibrateHeading : markHelp}
              </Text>
              {tool === 'calibrate' ? <Text style={styles.secondary}>{calibrateHelp}</Text> : null}
              {tool === 'calibrate' && liveProblem !== null ? (
                <Banner body={PROBLEM_TEXT[liveProblem]} title="Check the points" tone="warning" />
              ) : null}
            </View>

            <View
              ref={canvasRef}
              accessible
              accessibilityHint="Placing and moving points and markers needs touch. Markers can be reviewed in the list below."
              accessibilityLabel={`After photo with ${state.marks.length} ${state.marks.length === 1 ? 'marker' : 'markers'}`}
              onLayout={(event) => {
                const size = {
                  width: event.nativeEvent.layout.width,
                  height: event.nativeEvent.layout.height,
                };
                setCanvas(size);
                // A changed size (rotation, text size) fits the photo again in the new bounds.
                setView((current) =>
                  current === null ||
                  canvas === null ||
                  canvas.width !== size.width ||
                  canvas.height !== size.height
                    ? fitView(image, size)
                    : current,
                );
                measureCanvas();
              }}
              // The page must not scroll while a finger is on the photo.
              onTouchCancel={() => setTouching(false)}
              onTouchEnd={() => setTouching(false)}
              onTouchStart={() => setTouching(true)}
              style={[styles.canvas, { height: canvasHeight }]}
              {...gestures.panHandlers}
            >
              {view === null ? null : (
                <>
                  <PhotoLayer image={image} uri={photos.uri(after.fileName)} view={view} />
                  <MarkerOverlay
                    calibrationPoints={livePoints}
                    holeRadius={(position) =>
                      target === null
                        ? null
                        : (holeRadiusInPhoto(
                            liveCalibration,
                            target,
                            position,
                            draft.hitDiameterMm,
                          ) ?? 0) * scaleOf(view)
                    }
                    appearance={appearance}
                    marks={liveMarks}
                    numbers={numbers}
                    outlines={outlines}
                    selectedId={tool === 'calibrate' ? null : state.selectedId}
                    selectedPoint={tool === 'calibrate' ? state.selectedPoint : null}
                    view={view}
                  />
                  {magnifier === null || canvas === null ? null : (
                    <Magnifier
                      canvas={canvas}
                      finger={magnifier.finger}
                      focus={magnifier.image}
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
                disabled={!editable}
                icon={Crosshair}
                label="Align target"
                onPress={() => setTool('calibrate')}
                selected={tool === 'calibrate'}
              />
              <IconButton
                disabled={!aligned || !editable}
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
              <IconButton icon={ZoomIn} label="Zoom in" onPress={() => zoomBy(1.5)} />
              <IconButton icon={ZoomOut} label="Zoom out" onPress={() => zoomBy(1 / 1.5)} />
              <IconButton
                icon={Maximize}
                label="Fit photo"
                onPress={() => canvas !== null && setView(fitView(image, canvas))}
              />
            </View>

            {tool === 'calibrate' ? (
              <Text style={styles.caption}>
                The drawn rings come from the demo target definition. Aligning them does not verify
                the target or make scores real. Hits keep their place on the photo when you adjust
                the points; their scores are recalculated.
              </Text>
            ) : (
              <>
                {selected === null ? null : (
                  <Inspector
                    basis={selected.accepted ? 'current' : basisOf(selected)}
                    disabled={!editable}
                    diameterAssumed={draft.hitDiameterSource === 'assumed'}
                    diameterMm={draft.hitDiameterMm}
                    mark={selected}
                    name={markName(selected, numbers)}
                    onAccept={() => send({ type: 'acceptMark', id: selected.id })}
                    onDelete={() => send({ type: 'deleteMark', id: selected.id })}
                    onShots={(shots) => send({ type: 'setShots', id: selected.id, shots })}
                  />
                )}
                {earlierSuggestions > 0 ? (
                  <Banner
                    body={`${earlierSuggestions === 1 ? '1 suggestion was' : `${earlierSuggestions} suggestions were`} found with an earlier alignment (struck through). Their place on the photo is unchanged, but the search they came from no longer matches the target. Analyse again from the round screen, or review them yourself.`}
                    title="Alignment changed"
                    tone="warning"
                  />
                ) : null}
                <MarkerList
                  appearance={appearance}
                  status={statusOf}
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
              </>
            )}
          </>
        )}
      </ScrollView>

      {after === null ? null : (
        // Outside the scroll view, so it never covers the photo or the text above it.
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.small }]}>
          <View style={styles.secondaryRow}>
            <View style={styles.secondaryAction}>
              <Button
                disabled={state.history.length === 0 || !editable}
                icon={Undo2}
                label="Undo"
                onPress={() => send({ type: 'undo' })}
                variant="secondary"
              />
            </View>
            {tool === 'calibrate' ? (
              <View style={styles.secondaryAction}>
                <Button
                  disabled={placed === 0 || !editable}
                  icon={RotateCcw}
                  label="Reset"
                  onPress={() => send({ type: 'restartCalibration' })}
                  variant="secondary"
                />
              </View>
            ) : null}
          </View>
          {tool === 'calibrate' ? (
            <Button
              disabled={!aligned}
              icon={ChevronRight}
              label="Use alignment"
              onPress={goBack}
            />
          ) : (
            <>
              <Button
                disabled={pending > 0}
                icon={ChevronRight}
                label="Review round"
                onPress={() => void reviewRound()}
              />
              <Text style={styles.caption}>
                {pending > 0
                  ? `Accept or remove ${pending === 1 ? 'the remaining suggestion' : `the ${pending} remaining suggestions`} to continue.`
                  : roundStatusText(evaluation, draft.actualShots)}
              </Text>
            </>
          )}
        </View>
      )}
      {leave.dialog}
    </SafeAreaView>
  );
}

// components/19-hit-inspector.png, outside the photo. Removing a suggestion never records a
// miss; the shot accounting asks for misses and unresolved shots explicitly.
function Inspector({
  basis,
  mark,
  name,
  disabled,
  diameterMm,
  diameterAssumed,
  onAccept,
  onDelete,
  onShots,
}: {
  basis: SuggestionBasis;
  disabled: boolean;
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
      <View style={styles.statusRow}>
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
      {basis === 'earlierAlignment' ? (
        <Text style={styles.secondary}>
          Based on an earlier alignment. Its place on the photo is unchanged, but the search that
          found it used the old alignment. Analyse again to search with the new one.
        </Text>
      ) : null}
      {basis === 'unrecorded' && !mark.accepted ? (
        <Text style={styles.secondary}>
          The alignment this suggestion was found with isn&apos;t recorded.
        </Text>
      ) : null}
      {mark.accepted ? (
        <Stepper
          disabled={disabled}
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
      <View style={styles.secondaryRow}>
        {mark.accepted ? null : (
          <View style={styles.secondaryAction}>
            <Button disabled={disabled} icon={Check} label="Accept" onPress={onAccept} />
          </View>
        )}
        <View style={styles.secondaryAction}>
          <Button
            disabled={disabled}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  content: {
    gap: spacing.field,
    padding: spacing.inset,
  },
  instructions: {
    gap: spacing.label,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.label,
  },
  heading: {
    ...typography.label,
    color: colors.text,
  },
  canvas: {
    overflow: 'hidden',
    borderRadius: radius.card,
    backgroundColor: colors.elevated,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.label,
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
  footer: {
    gap: spacing.small,
    paddingHorizontal: spacing.inset,
    paddingTop: spacing.small,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  secondaryAction: {
    flexGrow: 1,
    flexBasis: 130,
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
  inspectorTitle: {
    ...typography.section,
    color: colors.text,
  },
});
