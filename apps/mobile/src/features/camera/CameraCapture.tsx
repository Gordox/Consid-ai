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
import { choosePhoto } from '../../services/photoPicker';
import { createActionGuard } from '../rounds/nextRound';
import { photoSaveDeps } from '../rounds/photoActions';
import { savePickedPhoto } from '../rounds/roundPhotos';
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

export function CameraCapture({
  sessionId,
  roundId,
  role,
}: {
  sessionId: string;
  roundId: string;
  role: PhotoRole;
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

  const close = () =>
    router.canGoBack() ? router.back() : router.replace(`/sessions/${sessionId}/rounds/${roundId}`);

  // Saves through the same path as library photos: an unchanged copy, then the upright copy
  // without metadata that marks and analysis use. Nothing changes if saving fails.
  async function save(picked: { uri: string; width: number; height: number }): Promise<void> {
    try {
      await savePickedPhoto(role, picked, photoSaveDeps(db, photos, roundId, reportDevError));
      close();
    } catch (error) {
      reportDevError(error);
      setMessage("Couldn't save the photo. Nothing was changed. Try again.");
      guard.current.release();
    }
  }

  async function capture(): Promise<void> {
    if (!ready || !guard.current.tryEnter()) return;
    setBusy(true);
    setMessage(null);
    try {
      // skipProcessing stays off so the photo is rotated upright before it is saved.
      const picture = await camera.current?.takePictureAsync({ quality: 1, exif: false });
      if (picture === undefined) throw new Error('No picture');
      await save({ uri: picture.uri, width: picture.width, height: picture.height });
    } catch (error) {
      reportDevError(error);
      setMessage("Couldn't take the photo. Try again, or choose one from the library.");
      guard.current.release();
    } finally {
      setBusy(false);
    }
  }

  async function chooseFromLibrary(): Promise<void> {
    if (!guard.current.tryEnter()) return;
    setBusy(true);
    setMessage(null);
    const outcome = await choosePhoto();
    if (outcome.kind === 'picked') {
      await save(outcome.photo);
    } else {
      if (outcome.kind === 'failed') setMessage("Couldn't use that photo. Try another one.");
      guard.current.release();
    }
    setBusy(false);
  }

  if (permission === null) {
    return <SafeAreaView style={styles.dark} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.stack}>
          <ScreenHeader onBack={close} title="Camera access" subtitle={ROLE_TITLE[role]} />
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.dark}>
      <View style={styles.topBar}>
        <IconButton icon={X} label="Cancel" onPress={close} />
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
