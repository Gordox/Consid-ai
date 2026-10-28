import type { Point, Quad } from '../target/homography';
import type { AccountingStatus } from './shotAccounting';

export type PhotoRole = 'before' | 'after';

export type RoundPhoto = {
  readonly role: PhotoRole;
  // Generated name inside the app's own photo folder; never a picker or library URI. This is the
  // upright JPEG without metadata: its pixels are the coordinate system for marks, calibration
  // and analysis.
  readonly fileName: string;
  // The unmodified copy of the picked file, kept as the original. Null for photos saved before
  // schema 3, whose fileName is itself the unmodified copy and was never normalised.
  readonly originalFileName: string | null;
  readonly width: number;
  readonly height: number;
  readonly addedAtUtc: string;
};

export type RoundPhotos = { readonly before: RoundPhoto | null; readonly after: RoundPhoto | null };

// 'suggested' came from analysis unchanged; 'suggestedEdited' was a suggestion the user moved
// or resized; 'manual' was added by the user.
export type MarkSource = 'manual' | 'suggested' | 'suggestedEdited';

// A hole marked on the after photo, in its pixel coordinates (origin top left, y down).
export type HitMark = {
  readonly id: string;
  readonly position: Point;
  // Several shots through one hole are counted only when the user sets this explicitly.
  readonly shots: number;
  readonly source: MarkSource;
  // Analysis flagged the suggestion as uncertain and the user has not changed it.
  readonly uncertain: boolean;
  readonly candidateId: string | null;
};

// Calibration taps on the after photo, in order: top, right, bottom, left of the outer ring.
export type Calibration = Quad;

export type DraftRound = {
  readonly state: 'draft';
  readonly id: string;
  readonly sessionId: string;
  readonly sequence: number;
  readonly createdAtUtc: string;
  readonly actualShots: number;
  readonly declaredMisses: number;
  readonly unresolvedShots: number;
  readonly targetId: string;
  readonly hitDiameterMm: number;
  readonly calibration: Calibration | null;
  readonly photos: RoundPhotos;
  readonly marks: readonly HitMark[];
};

export type ConfirmedShot = {
  readonly markId: string;
  readonly shots: number;
  readonly centreMm: Point;
  readonly value: number;
};

// Fixed at confirmation; never recalculated when rules or targets change.
export type ConfirmedResult = {
  readonly targetId: string;
  readonly scoringRule: string;
  readonly hitDiameterMm: number;
  readonly actualShots: number;
  readonly declaredMisses: number;
  readonly unresolvedShots: number;
  readonly status: Extract<AccountingStatus, 'complete' | 'incomplete'>;
  readonly subtotal: number;
  readonly total: number | null;
  readonly shots: readonly ConfirmedShot[];
};

export type ConfirmedRound = {
  readonly state: 'confirmed';
  readonly id: string;
  readonly sessionId: string;
  readonly sequence: number;
  readonly createdAtUtc: string;
  readonly confirmedAtUtc: string;
  readonly result: ConfirmedResult;
  readonly photos: RoundPhotos;
};

export type Round = DraftRound | ConfirmedRound;
