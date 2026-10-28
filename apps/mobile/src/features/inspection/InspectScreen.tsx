import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Maximize from 'lucide-react-native/icons/maximize';
import Pencil from 'lucide-react-native/icons/pencil';
import X from 'lucide-react-native/icons/x';
import ZoomIn from 'lucide-react-native/icons/zoom-in';
import ZoomOut from 'lucide-react-native/icons/zoom-out';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type HostInstance,
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
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, spacing, typography } from '../../components/tokens';
import { calibrationProblem } from '../../domain/round/calibrationCheck';
import { findTarget } from '../../domain/target/targetDefinition';
import type { EditorAction } from '../editor/annotationEditor';
import { markerNumbers } from '../editor/editorInteraction';
import { createGestureController } from '../editor/gestureController';
import { MarkerList, MarkerOverlay, markName, PhotoLayer } from '../editor/PhotoMarkers';
import { holeRadiusInPhoto, ringOutlines } from '../editor/targetOverlay';
import {
  fitView,
  scaleOf,
  type Size,
  type ViewTransform,
  zoomAround,
} from '../editor/viewTransform';
import { usePhotoStore } from '../startup/photoStoreContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import { useFocusLoad } from '../useFocusLoad';
import { type Inspection, loadInspection } from './inspection';

type Which = 'after' | 'before';

// Full-screen, read-only view of a round's photo: pinch, pan, zoom buttons, Fit, hit markers on
// or off, and a selected hit's details. Nothing here writes; a draft offers a separate Edit.
export function InspectScreen({
  sessionId,
  roundId,
  showHitsAtStart,
}: {
  sessionId: string;
  roundId: string;
  showHitsAtStart: boolean;
}) {
  const { db } = useSessionStore();
  const router = useRouter();
  const load = useCallback(() => loadInspection(db, sessionId, roundId), [db, sessionId, roundId]);
  const { state, reload } = useFocusLoad(load);
  const close = () =>
    router.canGoBack() ? router.back() : router.replace(`/sessions/${sessionId}`);

  if (state.status === 'loaded' && state.data !== null && state.data.after !== null) {
    return (
      <Viewer
        inspection={state.data}
        key={state.data.roundId}
        onClose={close}
        onEdit={() => router.replace(`/sessions/${sessionId}/rounds/${roundId}/editor`)}
        showHitsAtStart={showHitsAtStart}
      />
    );
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.message}>
        <IconButton icon={X} label="Close" onPress={close} />
        {state.status === 'loading' ? <Text style={styles.secondary}>Loading photo…</Text> : null}
        {state.status === 'failed' ? (
          <>
            <Banner
              body="Nothing was changed. Try again."
              title="Couldn't open the photo"
              tone="error"
            />
            <Button label="Try again" onPress={reload} />
          </>
        ) : null}
        {state.status === 'loaded' ? (
          <Banner body="This round has no after photo to inspect." tone="info" />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Viewer({
  inspection,
  showHitsAtStart,
  onClose,
  onEdit,
}: {
  inspection: Inspection;
  showHitsAtStart: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const photos = usePhotoStore();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [which, setWhich] = useState<Which>('after');
  const [showHits, setShowHits] = useState(showHitsAtStart);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<Size | null>(null);
  const [view, setView] = useState<ViewTransform | null>(null);
  const canvasRef = useRef<HostInstance>(null);
  const [gestures] = useState(() => createGestureController(() => 'unused'));
  const photo =
    which === 'before' && inspection.before !== null ? inspection.before : inspection.after;
  const imageWidth = photo?.width ?? 1;
  const imageHeight = photo?.height ?? 1;
  const image: Size = useMemo(
    () => ({ width: imageWidth, height: imageHeight }),
    [imageWidth, imageHeight],
  );
  const target = findTarget(inspection.targetId);
  const numbers = markerNumbers(inspection.marks);
  // Marks and calibration belong to the after photo; the before photo is shown without them.
  const onAfter = which === 'after';
  const calibration =
    inspection.calibration !== null &&
    inspection.after !== null &&
    calibrationProblem(inspection.calibration, inspection.after) === null
      ? inspection.calibration
      : null;
  const outlines =
    calibration !== null && target !== null ? ringOutlines(calibration, target) : null;
  const selected = inspection.marks.find((mark) => mark.id === selectedId) ?? null;

  // Only selection reaches this screen; any other action is ignored, so a gesture can never
  // edit anything here.
  const dispatch = useCallback((action: EditorAction) => {
    if (action.type === 'select') setSelectedId(action.id);
  }, []);

  useEffect(() => {
    gestures.update(
      {
        view,
        canvas,
        image,
        tool: 'pan',
        marks: showHits && onAfter ? inspection.marks : [],
        selectedId,
        calibrationPoints: [],
        readOnly: true,
      },
      { dispatch, setView, setDragPreview: () => undefined, setMagnifier: () => undefined },
    );
  }, [gestures, view, canvas, image, showHits, onAfter, inspection.marks, selectedId, dispatch]);

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

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <IconButton icon={X} label="Close" onPress={onClose} />
        <View style={styles.titleGroup}>
          <Text accessibilityRole="header" style={styles.title}>
            Round {inspection.sequence} photo
          </Text>
          <StatusBadge
            label={inspection.confirmed ? 'Confirmed · read-only' : 'Draft · read-only'}
            tone={inspection.confirmed ? 'success' : 'warning'}
          />
        </View>
        <IconButton
          disabled={!onAfter}
          icon={showHits ? Eye : EyeOff}
          label={showHits ? 'Hide hits' : 'Show hits'}
          onPress={() => setShowHits((current) => !current)}
          selected={showHits && onAfter}
        />
      </View>

      <View
        ref={canvasRef}
        accessible
        accessibilityHint="Pinch to zoom and drag to pan. Hits are listed below."
        accessibilityLabel={`${onAfter ? 'After' : 'Before'} photo${showHits && onAfter ? `, ${inspection.marks.length} markers shown` : ''}`}
        onLayout={(event) => {
          const size = {
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          };
          setCanvas(size);
          setView(fitView(image, size));
          canvasRef.current?.measure((_x, _y, _w, _h, pageX, pageY) =>
            gestures.setOrigin({ x: pageX, y: pageY }),
          );
        }}
        style={[styles.canvas, { minHeight: windowHeight * 0.5 }]}
        {...gestures.panHandlers}
      >
        {view === null || photo === null ? null : (
          <>
            <PhotoLayer image={image} uri={photos.uri(photo.fileName)} view={view} />
            {showHits && onAfter ? (
              <MarkerOverlay
                calibrationPoints={[]}
                holeRadius={(position) =>
                  target === null
                    ? null
                    : (holeRadiusInPhoto(calibration, target, position, inspection.hitDiameterMm) ??
                        0) * scaleOf(view)
                }
                marks={inspection.marks}
                numbers={numbers}
                outlines={outlines}
                selectedId={selectedId}
                selectedPoint={null}
                view={view}
              />
            ) : null}
          </>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.panel, { paddingBottom: insets.bottom + spacing.field }]}
        style={styles.panelScroll}
      >
        <View style={styles.toolbar}>
          <IconButton icon={ZoomIn} label="Zoom in" onPress={() => zoomBy(1.5)} />
          <IconButton icon={ZoomOut} label="Zoom out" onPress={() => zoomBy(1 / 1.5)} />
          <IconButton
            icon={Maximize}
            label="Fit photo"
            onPress={() => canvas !== null && setView(fitView(image, canvas))}
          />
        </View>
        {inspection.before === null ? null : (
          <SegmentedControl
            label="Photo"
            onChange={(value) => {
              setSelectedId(null);
              setWhich(value);
              // The other photo has its own size, so it is fitted again.
              const next = value === 'before' ? inspection.before : inspection.after;
              if (next !== null && canvas !== null) {
                setView(fitView({ width: next.width, height: next.height }, canvas));
              }
            }}
            segments={[
              { value: 'after', label: 'After' },
              { value: 'before', label: 'Before' },
            ]}
            value={which}
          />
        )}
        {selected !== null && showHits && onAfter ? (
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              {markName(selected, numbers)}
            </Text>
            <Text style={styles.body}>{inspection.details.get(selected.id) ?? ''}</Text>
          </View>
        ) : null}
        {showHits && onAfter ? (
          <MarkerList
            detail={(mark) => inspection.details.get(mark.id) ?? null}
            marks={inspection.marks}
            numbers={numbers}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
        ) : null}
        {inspection.confirmed ? (
          <Text style={styles.caption}>{"Confirmed results can't be changed."}</Text>
        ) : (
          <Button icon={Pencil} label="Edit hits" onPress={onEdit} variant="secondary" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  message: {
    gap: spacing.field,
    padding: spacing.inset,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingHorizontal: spacing.field,
    paddingVertical: spacing.label,
  },
  titleGroup: {
    flex: 1,
    gap: spacing.fine,
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.elevated,
  },
  panelScroll: {
    flexGrow: 0,
    maxHeight: '40%',
  },
  panel: {
    gap: spacing.small,
    padding: spacing.field,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.label,
  },
  card: {
    gap: spacing.fine,
    padding: spacing.field,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.focus,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    ...typography.section,
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
});
