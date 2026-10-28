import {
  type ImagePickerOptions,
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
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

// Asks for camera access only when the user chooses to take a photo.
export async function takePhoto(): Promise<PickOutcome> {
  try {
    const permission = await requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { kind: 'permissionDenied', canAskAgain: permission.canAskAgain };
    }
    return toPickOutcome(await launchCameraAsync(OPTIONS));
  } catch (error) {
    reportDevError(error);
    return { kind: 'failed' };
  }
}

// The system photo picker needs no library permission on current Android versions.
export async function choosePhoto(): Promise<PickOutcome> {
  try {
    return toPickOutcome(await launchImageLibraryAsync(OPTIONS));
  } catch (error) {
    reportDevError(error);
    return { kind: 'failed' };
  }
}
