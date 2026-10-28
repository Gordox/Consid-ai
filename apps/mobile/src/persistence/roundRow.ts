import type {
  Calibration,
  ConfirmedResult,
  ConfirmedShot,
  HitMark,
  MarkSource,
  PhotoRole,
  RoundPhoto,
} from '../domain/round/round';
import { isActualShots, isHitDiameterMm, isShotsPerHole } from '../domain/round/roundRules';
import type { Point } from '../domain/target/homography';

// Thrown when a stored round value is not what this app writes. Names the column only.
export class InvalidRoundDataError extends Error {
  constructor(readonly column: string) {
    super(`Stored round data is invalid (${column})`);
    this.name = 'InvalidRoundDataError';
  }
}

function field(row: unknown, column: string): unknown {
  if (
    typeof row !== 'object' ||
    row === null ||
    !Object.prototype.hasOwnProperty.call(row, column)
  ) {
    throw new InvalidRoundDataError(column);
  }
  return Reflect.get(row, column);
}

export function readString(row: unknown, column: string): string {
  const value = field(row, column);
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidRoundDataError(column);
  }
  return value;
}

export function readNullableString(row: unknown, column: string): string | null {
  const value = field(row, column);
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new InvalidRoundDataError(column);
  }
  return value;
}

export function readNumber(
  row: unknown,
  column: string,
  isValid: (value: number) => boolean,
): number {
  const value = field(row, column);
  if (typeof value !== 'number' || !isValid(value)) {
    throw new InvalidRoundDataError(column);
  }
  return value;
}

export function readNullableNumber(
  row: unknown,
  column: string,
  isValid: (value: number) => boolean,
): number | null {
  const value = field(row, column);
  return value === null ? null : readNumber(row, column, isValid);
}

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);
const isCount = (value: number): boolean => isActualShots(value);

function parseJson(text: string, column: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidRoundDataError(column);
  }
}

// Values inside JSON columns report the JSON column, not the inner key.
function readPoint(value: unknown, column: string): Point {
  return { x: readJsonNumber(value, 'x', column), y: readJsonNumber(value, 'y', column) };
}

function readJsonNumber(value: unknown, key: string, column: string): number {
  if (typeof value !== 'object' || value === null) {
    throw new InvalidRoundDataError(column);
  }
  const raw: unknown = Reflect.get(value, key);
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new InvalidRoundDataError(column);
  }
  return raw;
}

export function serializeCalibration(calibration: Calibration): string {
  return JSON.stringify({ points: calibration.map((point) => ({ x: point.x, y: point.y })) });
}

export function parseCalibration(text: string | null): Calibration | null {
  if (text === null) {
    return null;
  }
  const column = 'calibration_json';
  const parsed = parseJson(text, column);
  const points: unknown =
    typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'points') : null;
  if (!Array.isArray(points) || points.length !== 4) {
    throw new InvalidRoundDataError(column);
  }
  const [a, b, c, d] = points.map((point: unknown) => readPoint(point, column));
  if (a === undefined || b === undefined || c === undefined || d === undefined) {
    throw new InvalidRoundDataError(column);
  }
  return [a, b, c, d];
}

const MARK_SOURCES: readonly MarkSource[] = ['manual', 'suggested', 'suggestedEdited'];
const PHOTO_ROLES: readonly PhotoRole[] = ['before', 'after'];

function isMarkSource(value: string): value is MarkSource {
  return (MARK_SOURCES as readonly string[]).includes(value);
}

export function isPhotoRole(value: string): value is PhotoRole {
  return (PHOTO_ROLES as readonly string[]).includes(value);
}

export function parseMarkRow(row: unknown): HitMark {
  const source = readString(row, 'source');
  if (!isMarkSource(source)) {
    throw new InvalidRoundDataError('source');
  }
  const uncertain = readNumber(row, 'uncertain', (value) => value === 0 || value === 1);
  return {
    id: readString(row, 'id'),
    position: { x: readNumber(row, 'x', isFiniteNumber), y: readNumber(row, 'y', isFiniteNumber) },
    shots: readNumber(row, 'shots', isShotsPerHole),
    source,
    uncertain: uncertain === 1,
    candidateId: readNullableString(row, 'candidate_id'),
  };
}

export function parsePhotoRow(row: unknown): RoundPhoto {
  const role = readString(row, 'role');
  if (!isPhotoRole(role)) {
    throw new InvalidRoundDataError('role');
  }
  const isPositiveInteger = (value: number) => Number.isInteger(value) && value > 0;
  return {
    role,
    fileName: readString(row, 'file_name'),
    originalFileName: readNullableString(row, 'original_file_name'),
    width: readNumber(row, 'width', isPositiveInteger),
    height: readNumber(row, 'height', isPositiveInteger),
    addedAtUtc: readString(row, 'added_at_utc'),
  };
}

export function serializeConfirmedResult(result: ConfirmedResult): string {
  return JSON.stringify(result);
}

function readShot(value: unknown, column: string): ConfirmedShot {
  if (typeof value !== 'object' || value === null) {
    throw new InvalidRoundDataError(column);
  }
  const markId: unknown = Reflect.get(value, 'markId');
  const shots: unknown = Reflect.get(value, 'shots');
  const shotValue: unknown = Reflect.get(value, 'value');
  if (
    typeof markId !== 'string' ||
    typeof shots !== 'number' ||
    !isShotsPerHole(shots) ||
    typeof shotValue !== 'number' ||
    !Number.isInteger(shotValue) ||
    shotValue < 0
  ) {
    throw new InvalidRoundDataError(column);
  }
  return {
    markId,
    shots,
    value: shotValue,
    centreMm: readPoint(Reflect.get(value, 'centreMm'), column),
  };
}

export function parseConfirmedResult(text: string): ConfirmedResult {
  const column = 'confirmed_json';
  const parsed = parseJson(text, column);
  const get = (key: string): unknown =>
    typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, key) : undefined;
  const status = get('status');
  const total = get('total');
  const shots = get('shots');
  const numbers = {
    hitDiameterMm: get('hitDiameterMm'),
    actualShots: get('actualShots'),
    declaredMisses: get('declaredMisses'),
    unresolvedShots: get('unresolvedShots'),
    subtotal: get('subtotal'),
  };
  const targetId = get('targetId');
  const scoringRule = get('scoringRule');
  if (
    typeof targetId !== 'string' ||
    typeof scoringRule !== 'string' ||
    (status !== 'complete' && status !== 'incomplete') ||
    typeof numbers.hitDiameterMm !== 'number' ||
    !isHitDiameterMm(numbers.hitDiameterMm) ||
    typeof numbers.actualShots !== 'number' ||
    !isCount(numbers.actualShots) ||
    typeof numbers.declaredMisses !== 'number' ||
    !isCount(numbers.declaredMisses) ||
    typeof numbers.unresolvedShots !== 'number' ||
    !isCount(numbers.unresolvedShots) ||
    typeof numbers.subtotal !== 'number' ||
    !Number.isInteger(numbers.subtotal) ||
    !(total === null || (typeof total === 'number' && Number.isInteger(total))) ||
    !Array.isArray(shots)
  ) {
    throw new InvalidRoundDataError(column);
  }
  return {
    targetId,
    scoringRule,
    status,
    hitDiameterMm: numbers.hitDiameterMm,
    actualShots: numbers.actualShots,
    declaredMisses: numbers.declaredMisses,
    unresolvedShots: numbers.unresolvedShots,
    subtotal: numbers.subtotal,
    total,
    shots: shots.map((shot: unknown) => readShot(shot, column)),
  };
}
