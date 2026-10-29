import {
  type FirearmProfile,
  type FirearmProfileValues,
  type TrainingTemplate,
  type TrainingTemplateValues,
  validateProfileInput,
  validateTemplateInput,
} from '../domain/library/library';
import type { SessionDatabase } from './database';
import { readNullableNumber, readNullableString, readNumber, readString } from './roundRow';

// Firearm profiles and training templates. Rows are validated with the same domain rules when
// read; a row that fails is left in the table and only counted, never shown as valid data.

export type Library<T> = {
  readonly active: T[];
  readonly archived: T[];
  readonly unreadable: number;
};

function savedFields(row: unknown) {
  return {
    id: readString(row, 'id'),
    createdAtUtc: readString(row, 'created_at_utc'),
    updatedAtUtc: readString(row, 'updated_at_utc'),
    archivedAtUtc: readNullableString(row, 'archived_at_utc'),
    lastUsedAtUtc: readNullableString(row, 'last_used_at_utc'),
  };
}

function parseProfile(row: unknown): FirearmProfile | null {
  try {
    const stored = {
      firearmName: readString(row, 'firearm_name'),
      firearmType: readString(row, 'firearm_type'),
      calibreLabel: readString(row, 'calibre_label'),
    };
    const values = validateProfileInput(stored);
    // Stored text must already be normalised, as the app writes it.
    if (
      !values.ok ||
      values.value.firearmName !== stored.firearmName ||
      values.value.calibreLabel !== stored.calibreLabel
    ) {
      return null;
    }
    return { ...savedFields(row), ...values.value };
  } catch {
    return null;
  }
}

function parseTemplate(row: unknown): TrainingTemplate | null {
  try {
    const rounds = readNullableNumber(row, 'planned_rounds', Number.isInteger);
    const name = readString(row, 'name');
    const values = validateTemplateInput({
      name,
      distanceMetres: String(readNumber(row, 'distance_m', Number.isFinite)),
      plannedShotsPerRound: String(readNumber(row, 'planned_shots_per_round', Number.isInteger)),
      plannedRounds: rounds === null ? '' : String(rounds),
    });
    return values.ok && values.value.name === name
      ? { ...savedFields(row), ...values.value }
      : null;
  } catch {
    return null;
  }
}

function split<T extends { archivedAtUtc: string | null }>(parsed: (T | null)[]): Library<T> {
  const valid = parsed.filter((item): item is T => item !== null);
  return {
    active: valid.filter((item) => item.archivedAtUtc === null),
    archived: valid.filter((item) => item.archivedAtUtc !== null),
    unreadable: parsed.length - valid.length,
  };
}

const PROFILE_COLUMNS =
  'id, firearm_name, firearm_type, calibre_label, created_at_utc, updated_at_utc, archived_at_utc, last_used_at_utc';
const TEMPLATE_COLUMNS =
  'id, name, distance_m, planned_shots_per_round, planned_rounds, created_at_utc, updated_at_utc, archived_at_utc, last_used_at_utc';

export async function listProfiles(db: SessionDatabase): Promise<Library<FirearmProfile>> {
  const rows = await db.getAllAsync(
    `SELECT ${PROFILE_COLUMNS} FROM firearm_profiles ORDER BY firearm_name COLLATE NOCASE, id`,
    [],
  );
  return split(rows.map(parseProfile));
}

export async function listTemplates(db: SessionDatabase): Promise<Library<TrainingTemplate>> {
  const rows = await db.getAllAsync(
    `SELECT ${TEMPLATE_COLUMNS} FROM training_templates ORDER BY name COLLATE NOCASE, id`,
    [],
  );
  return split(rows.map(parseTemplate));
}

export async function getProfile(db: SessionDatabase, id: string): Promise<FirearmProfile | null> {
  const row = await db.getFirstAsync(
    `SELECT ${PROFILE_COLUMNS} FROM firearm_profiles WHERE id = ?`,
    [id],
  );
  return row === null || row === undefined ? null : parseProfile(row);
}

export async function getTemplate(
  db: SessionDatabase,
  id: string,
): Promise<TrainingTemplate | null> {
  const row = await db.getFirstAsync(
    `SELECT ${TEMPLATE_COLUMNS} FROM training_templates WHERE id = ?`,
    [id],
  );
  return row === null || row === undefined ? null : parseTemplate(row);
}

// Values must come from validateProfileInput / validateTemplateInput.
export async function createProfile(
  db: SessionDatabase,
  input: { id: string; nowUtc: string; values: FirearmProfileValues },
): Promise<void> {
  const { firearmName, firearmType, calibreLabel } = input.values;
  await db.runAsync(
    `INSERT INTO firearm_profiles (id, firearm_name, firearm_type, calibre_label, created_at_utc, updated_at_utc)
     VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    [input.id, firearmName, firearmType, calibreLabel, input.nowUtc, input.nowUtc],
  );
}

export async function updateProfile(
  db: SessionDatabase,
  id: string,
  values: FirearmProfileValues,
  nowUtc: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE firearm_profiles SET firearm_name = ?, firearm_type = ?, calibre_label = ?, updated_at_utc = ?
     WHERE id = ?`,
    [values.firearmName, values.firearmType, values.calibreLabel, nowUtc, id],
  );
}

export async function createTemplate(
  db: SessionDatabase,
  input: { id: string; nowUtc: string; values: TrainingTemplateValues },
): Promise<void> {
  const { name, distanceMetres, plannedShotsPerRound, plannedRounds } = input.values;
  await db.runAsync(
    `INSERT INTO training_templates (id, name, distance_m, planned_shots_per_round, planned_rounds, created_at_utc, updated_at_utc)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    [
      input.id,
      name,
      distanceMetres,
      plannedShotsPerRound,
      plannedRounds,
      input.nowUtc,
      input.nowUtc,
    ],
  );
}

export async function updateTemplate(
  db: SessionDatabase,
  id: string,
  values: TrainingTemplateValues,
  nowUtc: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE training_templates SET name = ?, distance_m = ?, planned_shots_per_round = ?, planned_rounds = ?,
       updated_at_utc = ? WHERE id = ?`,
    [
      values.name,
      values.distanceMetres,
      values.plannedShotsPerRound,
      values.plannedRounds,
      nowUtc,
      id,
    ],
  );
}

export type LibraryKind = 'profile' | 'template';

const TABLE: Record<LibraryKind, string> = {
  profile: 'firearm_profiles',
  template: 'training_templates',
};

// Archiving hides an item from new sessions; restoring brings it back. Nothing is deleted.
export async function setArchived(
  db: SessionDatabase,
  kind: LibraryKind,
  id: string,
  archived: boolean,
  nowUtc: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE ${TABLE[kind]} SET archived_at_utc = ?, updated_at_utc = ? WHERE id = ?`,
    [archived ? nowUtc : null, nowUtc, id],
  );
}

// Recorded after a session was created with this item, so the next form can start from it.
export async function markUsed(
  db: SessionDatabase,
  kind: LibraryKind,
  id: string,
  nowUtc: string,
): Promise<void> {
  await db.runAsync(`UPDATE ${TABLE[kind]} SET last_used_at_utc = ? WHERE id = ?`, [nowUtc, id]);
}
