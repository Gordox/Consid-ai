import type { RoundPhoto } from '../../domain/round/round';
import type { AnalysisPhoto } from '../../services/analysis/analysisClient';

// What is uploaded for a round photo: always the normalised copy (upright, no metadata), never
// the unchanged original, which may contain the location. A photo saved before normalisation
// existed has no such copy and is not uploaded at all.
export function uploadablePhoto(
  photo: RoundPhoto,
  uriFor: (fileName: string) => string,
): AnalysisPhoto | null {
  if (photo.originalFileName === null) {
    return null;
  }
  return {
    uri: uriFor(photo.fileName),
    fileName: photo.fileName,
    width: photo.width,
    height: photo.height,
  };
}
