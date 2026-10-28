import type { AnalysisConfig } from './analysisConfig';
import { type AnalysisResult, parseAnalysisResponse } from './analysisContract';

export type AnalysisRequest = {
  readonly roundId: string;
  readonly attemptId: string;
  readonly targetId: string;
  readonly after: AnalysisPhoto;
  readonly before: AnalysisPhoto | null;
};

export type AnalysisPhoto = {
  readonly uri: string;
  readonly fileName: string;
  readonly width: number;
  readonly height: number;
};

export type AnalysisError =
  | 'fileTooLarge'
  | 'network'
  | 'timeout'
  | 'rejected' // 4xx other than rate limiting: the request or images were not accepted
  | 'rateLimited'
  | 'serverError'
  | 'invalidResponse'
  | 'stale'
  | 'imageMismatch';

export type AnalysisClientDeps = {
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  // Size in bytes of an app photo file, or null when it cannot be read.
  readonly fileSize: (photo: AnalysisPhoto) => number | null;
  readonly timeoutMs: number;
};

// Matches the service limit in contracts/analysis.openapi.yaml.
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const ANALYSIS_TIMEOUT_MS = 60_000;

function mimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'heic':
      return 'image/heic';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

// React Native's FormData uploads a local file from { uri, name, type } without reading it into
// JS, but its TypeScript types only describe the web Blob overload. This is the one place that
// bridges the two; the object is built here from validated app values only.
type NativeFormFile = { readonly uri: string; readonly name: string; readonly type: string };

function asFormValue(file: NativeFormFile): Blob {
  return file as unknown as Blob;
}

function appendPhoto(form: FormData, field: string, photo: AnalysisPhoto): void {
  form.append(
    field,
    asFormValue({ uri: photo.uri, name: photo.fileName, type: mimeType(photo.fileName) }),
  );
}

// Sends the photos only when called, which happens only after the user taps Analyze.
export async function requestAnalysis(
  config: AnalysisConfig,
  request: AnalysisRequest,
  deps: AnalysisClientDeps,
): Promise<{ ok: true; value: AnalysisResult } | { ok: false; error: AnalysisError }> {
  for (const photo of [request.after, request.before]) {
    if (photo === null) continue;
    const size = deps.fileSize(photo);
    if (size === null || size > MAX_PHOTO_BYTES) {
      return { ok: false, error: 'fileTooLarge' };
    }
  }

  const form = new FormData();
  form.append('roundId', request.roundId);
  form.append('attemptId', request.attemptId);
  form.append('mode', request.before === null ? 'single' : 'paired');
  form.append('targetId', request.targetId);
  appendPhoto(form, 'after', request.after);
  if (request.before !== null) {
    appendPhoto(form, 'before', request.before);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  let response: Response;
  try {
    response = await deps.fetch(`${config.baseUrl}/v1/analyses`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { ok: false, error: controller.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) return { ok: false, error: 'rateLimited' };
  if (response.status >= 500) return { ok: false, error: 'serverError' };
  if (response.status !== 200) return { ok: false, error: 'rejected' };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: 'invalidResponse' };
  }
  const parsed = parseAnalysisResponse(body, {
    roundId: request.roundId,
    attemptId: request.attemptId,
    imageWidth: request.after.width,
    imageHeight: request.after.height,
  });
  return parsed.ok ? parsed : { ok: false, error: parsed.error };
}
