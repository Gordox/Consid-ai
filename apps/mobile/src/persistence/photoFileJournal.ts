import type { SessionDatabase } from './database';
import { readString } from './roundRow';

// The photo files this database created. A file is recorded before it is written and forgotten
// after it is deleted, so the journal is the only list cleanup may delete from.

const REFERENCED = `EXISTS (SELECT 1 FROM round_photos p
  WHERE p.file_name = photo_files.file_name OR p.original_file_name = photo_files.file_name)`;

export async function recordPhotoFile(
  db: SessionDatabase,
  fileName: string,
  createdAtUtc: string,
): Promise<void> {
  await db.runAsync('INSERT INTO photo_files (file_name, created_at_utc) VALUES (?, ?)', [
    fileName,
    createdAtUtc,
  ]);
}

export async function isPhotoFileReferenced(
  db: SessionDatabase,
  fileName: string,
): Promise<boolean> {
  const row = await db.getFirstAsync(
    'SELECT 1 AS used FROM round_photos WHERE file_name = ? OR original_file_name = ? LIMIT 1',
    [fileName, fileName],
  );
  return row !== null && row !== undefined;
}

// Removes the record only while no row refers to the file.
export async function forgetPhotoFile(db: SessionDatabase, fileName: string): Promise<void> {
  await db.runAsync(`DELETE FROM photo_files WHERE file_name = ? AND NOT ${REFERENCED}`, [
    fileName,
  ]);
}

// Recorded files that no row refers to and that were recorded at or before the cutoff. Newer
// files may belong to a save that is still running.
export async function listAbandonedPhotoFiles(
  db: SessionDatabase,
  cutoffUtc: string,
): Promise<string[]> {
  const rows = await db.getAllAsync(
    `SELECT file_name FROM photo_files WHERE created_at_utc <= ? AND NOT ${REFERENCED}
     ORDER BY created_at_utc`,
    [cutoffUtc],
  );
  return rows.map((row) => readString(row, 'file_name'));
}
