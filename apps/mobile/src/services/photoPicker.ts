import {
  getMediaLibraryPermissionsAsync,
  getPendingResultAsync,
  type ImagePickerOptions,
  launchImageLibraryAsync,
} from 'expo-image-picker';

import { type PickOutcome, toPickOutcome } from './pickedPhoto';

// Full quality without editing, so hole edges stay sharp; location metadata is not requested.
const OPTIONS: ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 1,
  exif: false,
};

function reportDevError(error: unknown): void {
  if (__DEV__) {
    console.warn('Photo picker error:', error instanceof Error ? error.name : typeof error);
  }
}

// The system photo picker needs no library permission on current Android versions. Where the
// library is protected by a permission (older Android, iOS) a refusal surfaces as a failed launch;
// the stored permission then tells a denial apart from any other failure.
export async function choosePhoto(): Promise<PickOutcome> {
  try {
    return toPickOutcome(await launchImageLibraryAsync(OPTIONS));
  } catch (error) {
    reportDevError(error);
    try {
      const permission = await getMediaLibraryPermissionsAsync();
      if (!permission.granted && permission.status === 'denied') {
        return { kind: 'permissionDenied', canAskAgain: permission.canAskAgain };
      }
    } catch (permissionError) {
      reportDevError(permissionError);
    }
    return { kind: 'failed' };
  }
}

// Photos are taken with the in-app camera (features/camera); this module only opens the
// system photo library.

// The result of a pick that was open when Android ended the app, delivered once on the next
// start. Null when there is none (and always on iOS).
export async function takePendingPickerResult(): Promise<unknown> {
  return getPendingResultAsync();
}
