// Runtime validation of the analysis response (contracts/analysis.openapi.yaml). Nothing from
// the service is used before it passes here.

export type AnalysisStatus = 'succeeded' | 'unusableImage' | 'registrationFailed';

export type WarningCode =
  'blur' | 'glare' | 'shadow' | 'clipping' | 'partialTarget' | 'stickerEdges' | 'other';

export type AnalysisCandidate = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly confidence: number;
  readonly uncertain: boolean;
};

export type AnalysisResult = {
  readonly status: AnalysisStatus;
  readonly algorithmVersion: string;
  readonly candidates: readonly AnalysisCandidate[];
  readonly warnings: readonly WarningCode[];
};

export type ExpectedAnswer = {
  readonly roundId: string;
  readonly attemptId: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
};

export type ResponseProblem = 'invalidResponse' | 'stale' | 'imageMismatch';

const STATUSES: readonly AnalysisStatus[] = ['succeeded', 'unusableImage', 'registrationFailed'];
const WARNINGS: readonly WarningCode[] = [
  'blur',
  'glare',
  'shadow',
  'clipping',
  'partialTarget',
  'stickerEdges',
  'other',
];
const MAX_CANDIDATES = 100;
const MAX_WARNINGS = 20;

function isStatus(value: string): value is AnalysisStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function isWarningCode(value: string): value is WarningCode {
  return (WARNINGS as readonly string[]).includes(value);
}

function get(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

function parseCandidate(value: unknown, width: number, height: number): AnalysisCandidate | null {
  const id = get(value, 'id');
  const x = get(value, 'x');
  const y = get(value, 'y');
  const confidence = get(value, 'confidence');
  const uncertain = get(value, 'uncertain');
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    id.length > 64 ||
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0 ||
    x > width ||
    y > height ||
    typeof confidence !== 'number' ||
    !(confidence >= 0 && confidence <= 1) ||
    typeof uncertain !== 'boolean'
  ) {
    return null;
  }
  return { id, x, y, confidence, uncertain };
}

export function parseAnalysisResponse(
  body: unknown,
  expected: ExpectedAnswer,
): { ok: true; value: AnalysisResult } | { ok: false; error: ResponseProblem } {
  const invalid = { ok: false, error: 'invalidResponse' } as const;
  if (get(body, 'roundId') !== expected.roundId || get(body, 'attemptId') !== expected.attemptId) {
    return typeof get(body, 'attemptId') === 'string' ? { ok: false, error: 'stale' } : invalid;
  }
  const status = get(body, 'status');
  const algorithmVersion = get(body, 'algorithmVersion');
  const image = get(body, 'image');
  const candidates = get(body, 'candidates');
  const warnings = get(body, 'warnings');
  if (
    typeof status !== 'string' ||
    !isStatus(status) ||
    typeof algorithmVersion !== 'string' ||
    algorithmVersion.length === 0 ||
    algorithmVersion.length > 100 ||
    !Array.isArray(candidates) ||
    candidates.length > MAX_CANDIDATES ||
    !Array.isArray(warnings) ||
    warnings.length > MAX_WARNINGS
  ) {
    return invalid;
  }
  if (
    get(image, 'width') !== expected.imageWidth ||
    get(image, 'height') !== expected.imageHeight
  ) {
    return { ok: false, error: 'imageMismatch' };
  }
  const parsed: AnalysisCandidate[] = [];
  for (const candidate of candidates) {
    const value = parseCandidate(candidate, expected.imageWidth, expected.imageHeight);
    if (value === null || parsed.some((existing) => existing.id === value.id)) {
      return invalid;
    }
    parsed.push(value);
  }
  // A failed analysis must not look like "no hits found".
  if (status !== 'succeeded' && parsed.length > 0) {
    return invalid;
  }
  const warningCodes: WarningCode[] = [];
  for (const warning of warnings) {
    const code = get(warning, 'code');
    if (typeof code !== 'string' || !isWarningCode(code)) {
      return invalid;
    }
    warningCodes.push(code);
  }
  return {
    ok: true,
    value: { status, algorithmVersion, candidates: parsed, warnings: warningCodes },
  };
}
