import ImageIcon from 'lucide-react-native/icons/image';
import X from 'lucide-react-native/icons/x';
import Zap from 'lucide-react-native/icons/zap';
import ZapOff from 'lucide-react-native/icons/zap-off';
import { type CameraView as CameraViewType, CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../components/tokens';
import type { PhotoRole } from '../../domain/round/round';
import { clearPendingPick, recordPendingPick } from '../../persistence/pendingPhotoPick';
import {
  DraftChangedError,
  RoundNotEditableError,
  RoundNotFoundError,
} from '../../persistence/roundRepository';
import { nowUtcIso } from '../../services/deviceContext';
import { choosePhoto } from '../../services/photoPicker';
import type { SaveOutcome } from '../leaveGuard';
import { libraryPickMessage, pickLibraryPhoto } from '../rounds/libraryPick';
import { createActionGuard } from '../rounds/nextRound';
import { photoSaveDeps } from '../rounds/photoActions';
import { savePickedPhoto } from '../rounds/roundPhotos';
import { useLeaveGuard } from '../useLeaveGuard';
import { usePhotoStore } from '../startup/photoStoreContext';
import { useSessionStore } from '../startup/sessionStoreContext';
import { guideLayout } from './cameraGuide';

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Camera error:', error instanceof Error ? error.name : typeof error);
  }
}

const ROLE_TITLE: Record<PhotoRole, string> = { after: 'After photo', before: 'Before photo' };

// The guide on top of the live preview. It is an ordinary view, so it is not in the photo's
// pixels; it does not detect the target or judge focus, angle or size.
function Guide({ width, height }: { width: number; height: number }) {
  const { circle, frame } = guideLayout(width, height);
  const corner = 28;
  const corners = [
    { left: frame.x, top: frame.y, borderLeftWidth: 2, borderTopWidth: 2 },
    { left: frame.x + frame.width - corner, top: frame.y, borderRightWidth: 2, borderTopWidth: 2 },
    {
      left: frame.x,
      top: frame.y + frame.height - corner,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
    },
    {
      left: frame.x + frame.width - corner,
      top: frame.y + frame.height - corner,
      borderRightWidth: 2,
      borderBottomWidth: 2,
    },
  ];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      <View
        style={[
          styles.circle,
          { left: circle.x, top: circle.y, width: circle.diameter, height: circle.diameter },
        ]}
      />
      <View style={[styles.cross, { left: width / 2 - 10, top: height / 2 }]} />
      <View style={[styles.crossVertical, { left: width / 2, top: height / 2 - 10 }]} />
      {corners.map((style, index) => (
        <View key={index} style={[styles.corner, { width: corner, height: corner }, style]} />
      ))}
    </View>
  );
}

const LEAVE_TEXTS = {
  stillSaving: {
    title: 'Still saving the photo',
    body: 'Saving is taking longer than usual. If you leave, the photo may still be added to the round when it finishes.',
  },
  notSaved: {
    title: "The photo wasn't saved",
    body: 'Leave without the photo? Your round is unchanged.',
  },
} as const;

// Errors after which the camera file is certainly not needed: the photo was refused by the round.
function isDefiniteRefusal(error: unknown): boolean {
  return (
    error instanceof DraftChangedError ||
    error instanceof RoundNotEditableError ||
    error instanceof RoundNotFoundError
  );
}

export function CameraCapture({
  sessionId,
  roundId,
  role,
  draftRevision,
}: {
  sessionId: string;
  roundId: string;
  role: PhotoRole;
  // The draft the user saw when opening the camera; a photo is added only to that state.
  draftRevision: number;
}) {
  const { db } = useSessionStore();
  const photos = usePhotoStore();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraViewType>(null);
  const guard = useRef(createActionGuard());
  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState({ width: 0, height: 0 });

  // The camera runs only while this screen is shown and the app is in the foreground.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state !== 'active') setTorch(false);
    });
    return () => subscription.remove();
  }, []);

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace(`/sessions/${sessionId}/rounds/${roundId}`);
  // The save in progress, read when the user tries to leave (useLeaveGuard).
  const saving = useRef<Promise<SaveOutcome> | null>(null);
  const leave = useLeaveGuard(() => saving.current, LEAVE_TEXTS);
  // After a saved photo the camera closes, unless the user already left: one navigation at most,
  // and never away from a newer screen.
  const close = () => leave.complete(goBack);

  // Runs one save and records it for the leave guard.
  async function track(work: Promise<SaveOutcome>): Promise<SaveOutcome> {
    saving.current = work;
    try {
      return await work;
    } finally {
      saving.current = null;
    }
  }

  async function capture(): Promise<void> {
    if (!ready || !guard.current.tryEnter()) return;
    setBusy(true);
    setMessage(null);
    let pictureUri: string | null = null;
    try {
      // skipProcessing stays off so the photo is rotated upright before it is saved.
      const picture = await camera.current?.takePictureAsync({ quality: 1, exif: false });
      if (picture === undefined) throw new Error('No picture');
      pictureUri = picture.uri;
      const taken = { uri: picture.uri, width: picture.width, height: picture.height };
      // Saved through the same path as library photos: an unchanged copy, then the upright
      // copy without metadata that marks and analysis use. Nothing changes if saving fails.
      let refusal: unknown = null;
      const outcome = await track(
        savePickedPhoto(
          role,
          taken,
          photoSaveDeps(db, photos, roundId, draftRevision, reportDevError),
        ).then(
          () => 'saved' as const,
          (error: unknown) => {
            refusal = error;
            return 'failed' as const;
          },
        ),
      );
      // The camera's own file is deleted only when its copies are saved, or when the round
      // refused the photo for good; after any other failure it is kept.
      if (outcome === 'saved' || isDefiniteRefusal(refusal)) {
        try {
          photos.deleteCameraTemporary(pictureUri);
        } catch (error) {
          reportDevError(error);
        }
      }
      if (outcome === 'saved') {
        close();
        return;
      }
      reportDevError(refusal);
      setMessage(
        refusal instanceof DraftChangedError
          ? "The round changed while the photo was being saved, so it wasn't added. Go back and check the round."
          : refusal instanceof RoundNotEditableError || refusal instanceof RoundNotFoundError
            ? "This round is no longer in progress, so the photo wasn't added."
            : "Couldn't save the photo. Nothing was changed. Try again.",
      );
      guard.current.release();
    } catch (error) {
      reportDevError(error);
      setMessage(
        pictureUri === null
          ? "Couldn't take the photo. Try again, or choose one from the library."
          : "Couldn't save the photo. Nothing was changed. Try again.",
      );
      guard.current.release();
    } finally {
      setBusy(false);
    }
  }

  // The same pending record and recovery as the round screen's library button (libraryPick.ts).
  async function chooseFromLibrary(): Promise<void> {
    if (!guard.current.tryEnter()) return;
    setBusy(true);
    setMessage(null);
    const outcome = await track(
      pickLibraryPhoto(
        {
          recordPending: (pick) => recordPendingPick(db, pick),
          clearPending: () => clearPendingPick(db),
          choose: choosePhoto,
          save: async (picked) => {
            await savePickedPhoto(
              role,
              picked,
              photoSaveDeps(db, photos, roundId, draftRevision, reportDevError),
            );
          },
          now: nowUtcIso,
          reportError: reportDevError,
        },
        { roundId, role, draftRevision },
      ).then((result) => {
        setMessage(libraryPickMessage(result));
        return result.kind === 'saved' ? 'saved' : 'failed';
      }),
    );
    setBusy(false);
    if (outcome === 'saved') {
      close();
    } else {
      guard.current.release();
    }
  }

  if (permission === null) {
    return <SafeAreaView style={styles.dark} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.stack}>
          <ScreenHeader onBack={goBack} title="Camera access" subtitle={ROLE_TITLE[role]} />
          <Banner
            body={
              permission.canAskAgain
                ? 'The camera is used only to photograph your target. Nothing is sent anywhere.'
                : 'Camera access is turned off for this app. Allow it in Settings, or choose a photo from the library.'
            }
            title="Allow camera access"
            tone="info"
          />
          {permission.canAskAgain ? (
            <Button label="Allow camera" onPress={() => void requestPermission()} />
          ) : (
            <Button label="Open settings" onPress={() => void Linking.openSettings()} />
          )}
          <Button
            busy={busy}
            icon={ImageIcon}
            label="Use library instead"
            onPress={() => void chooseFromLibrary()}
            variant="secondary"
          />
          {message === null ? null : <Banner body={message} tone="error" />}
        </View>
        {leave.dialog}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.dark}>
      <View style={styles.topBar}>
        <IconButton icon={X} label="Close camera" onPress={goBack} />
        <Text accessibilityRole="header" style={styles.title}>
          {ROLE_TITLE[role]}
        </Text>
        <IconButton
          icon={torch ? Zap : ZapOff}
          label={torch ? 'Turn light off' : 'Turn light on'}
          onPress={() => setTorch((on) => !on)}
          selected={torch}
        />
      </View>
      <View
        onLayout={(event) =>
          setPreview({
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          })
        }
        style={styles.preview}
      >
        <CameraView
          ref={camera}
          active={focused && foreground}
          enableTorch={torch}
          facing="back"
          onCameraReady={() => setReady(true)}
          onMountError={() =>
            setMessage("The camera couldn't start. Choose a photo from the library.")
          }
          style={StyleSheet.absoluteFill}
        />
        <Guide height={preview.height} width={preview.width} />
      </View>
      <View style={styles.bottom}>
        <Text style={styles.guideText}>
          Guide only: put the target in the circle, keep the whole sheet in view and hold the phone
          straight in front of it. It is not used for scoring or alignment, and it does not check
          focus or angle.
        </Text>
        {message === null ? null : <Banner body={message} tone="error" />}
        <View style={styles.controls}>
          <IconButton
            icon={ImageIcon}
            label="Choose from library"
            onPress={() => void chooseFromLibrary()}
          />
          <Pressable
            accessibilityLabel="Take photo"
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready || busy, busy }}
            disabled={!ready || busy}
            onPress={() => void capture()}
            style={({ pressed }) => [
              styles.shutter,
              !ready || busy ? styles.shutterDisabled : null,
              pressed ? styles.shutterPressed : null,
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.controlSpacer} />
        </View>
        {busy ? (
          <Text accessibilityLiveRegion="polite" style={styles.guideText}>
            Saving photo…
          </Text>
        ) : null}
      </View>
      {leave.dialog}
    </SafeAreaView>
  );
}

const SHUTTER = 72;

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stack: {
    gap: spacing.field,
    padding: spacing.inset,
  },
  dark: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingHorizontal: spacing.field,
    paddingVertical: spacing.label,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.section,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  preview: {
    flex: 1,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.focus,
  },
  cross: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: colors.focus,
  },
  crossVertical: {
    position: 'absolute',
    width: 2,
    height: 20,
    backgroundColor: colors.focus,
  },
  corner: {
    position: 'absolute',
    borderColor: colors.text,
  },
  bottom: {
    gap: spacing.small,
    padding: spacing.field,
    backgroundColor: colors.background,
  },
  guideText: {
    ...typography.caption,
    color: colors.secondary,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlSpacer: {
    width: 48,
  },
  shutter: {
    width: SHUTTER,
    height: SHUTTER,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colors.text,
  },
  shutterDisabled: {
    borderColor: colors.disabledText,
  },
  shutterPressed: {
    opacity: 0.8,
  },
  shutterInner: {
    width: SHUTTER - 16,
    height: SHUTTER - 16,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
