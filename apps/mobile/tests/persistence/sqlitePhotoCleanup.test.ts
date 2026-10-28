import { cleanAbandonedPhotos, discardPhotos } from '../../src/features/rounds/photoActions';
import { recordPhotoFile } from '../../src/persistence/photoFileJournal';
import { MIGRATIONS } from '../../src/persistence/migrations';
import { setDraftPhoto } from '../../src/persistence/roundRepository';
import type { PhotoStore } from '../../src/services/photoStorage';
import { openNodeSqlite } from '../support/nodeSqliteDatabase';
import { databaseWithDraft, ROUND_ID } from '../support/sqliteFixtures';

// Real SQLite for rows and journal; the photo folder is a set of names.
function folder(names: string[]): PhotoStore & { readonly files: Set<string> } {
  const files = new Set(names);
  return {
    files,
    copyOriginal: async () => undefined,
    createNormalized: async () => ({ width: 1, height: 1 }),
    uri: (name) => name,
    exists: (name) => files.has(name),
    size: () => null,
    delete: (name) => {
      files.delete(name);
    },
    readHead: () => new Uint8Array(),
  };
}

const NOW = Date.parse('2026-10-28T12:00:00.000Z');
const OLD = '2026-10-28T10:00:00.000Z';
const FRESH = '2026-10-28T11:58:00.000Z';
const ignore = () => undefined;

const photo = (fileName: string, originalFileName: string) =>
  ({
    role: 'after',
    fileName,
    originalFileName,
    width: 3024,
    height: 4032,
    addedAtUtc: OLD,
  }) as const;

describe('abandoned photo cleanup on SQLite', () => {
  it('deletes only old, recorded, unreferenced copies', async () => {
    const db = await databaseWithDraft();
    await recordPhotoFile(db, 'used.jpg', OLD);
    await recordPhotoFile(db, 'used-original.jpg', OLD);
    await recordPhotoFile(db, 'abandoned.jpg', OLD);
    await recordPhotoFile(db, 'saving-now.jpg', FRESH);
    await setDraftPhoto(db, ROUND_ID, photo('used.jpg', 'used-original.jpg'));
    // Not in this database's journal: another database's, an older version's, or unknown.
    const store = folder([
      'used.jpg',
      'used-original.jpg',
      'abandoned.jpg',
      'saving-now.jpg',
      'not-recorded.jpg',
    ]);

    const outcome = await cleanAbandonedPhotos(db, store, NOW, ignore);

    expect(outcome.deleted).toEqual(['abandoned.jpg']);
    expect([...store.files].sort()).toEqual([
      'not-recorded.jpg',
      'saving-now.jpg',
      'used-original.jpg',
      'used.jpg',
    ]);
    expect(db.raw.prepare('SELECT file_name FROM photo_files ORDER BY file_name').all()).toEqual([
      { file_name: 'saving-now.jpg' },
      { file_name: 'used-original.jpg' },
      { file_name: 'used.jpg' },
    ]);
  });

  it('keeps a file a row refers to even when asked to delete it', async () => {
    const db = await databaseWithDraft();
    await recordPhotoFile(db, 'used.jpg', OLD);
    await setDraftPhoto(db, ROUND_ID, photo('used.jpg', 'used-original.jpg'));
    const store = folder(['used.jpg']);
    await expect(discardPhotos(db, store, ['used.jpg'], ignore)).resolves.toEqual({
      deleted: [],
      kept: ['used.jpg'],
    });
    expect(store.files.has('used.jpg')).toBe(true);
  });

  it('forgets a recorded file that was never written, without touching the folder', async () => {
    const db = await databaseWithDraft();
    await recordPhotoFile(db, 'never-written.jpg', OLD);
    const store = folder([]);
    await expect(cleanAbandonedPhotos(db, store, NOW, ignore)).resolves.toEqual({
      deleted: ['never-written.jpg'],
      kept: [],
    });
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM photo_files').get()).toEqual({ n: 0 });
  });
});

describe('migration 6 on SQLite', () => {
  it('records the files of existing photo rows', async () => {
    const db = openNodeSqlite();
    for (const sql of MIGRATIONS.slice(0, 5)) {
      await db.execAsync(sql);
    }
    db.raw.exec(`INSERT INTO sessions VALUES ('s1','t','UTC','P','pistol','9 mm',25,5,NULL,NULL)`);
    db.raw.exec(`INSERT INTO rounds (id, session_id, sequence, state, created_at_utc, actual_shots,
      declared_misses, unresolved_shots, target_id, hit_diameter_mm)
      VALUES ('r1','s1',1,'draft','t',3,0,0,'demo-synthetic-v1',9)`);
    db.raw.exec(`INSERT INTO round_photos (round_id, role, file_name, original_file_name, width,
      height, added_at_utc) VALUES ('r1','after','n.jpg','o.jpg',1,1,'t1'),
      ('r1','before','legacy.jpg',NULL,1,1,'t2')`);

    await db.execAsync(MIGRATIONS[5] ?? '');

    expect(db.raw.prepare('SELECT * FROM photo_files ORDER BY file_name').all()).toEqual([
      { file_name: 'legacy.jpg', created_at_utc: 't2' },
      { file_name: 'n.jpg', created_at_utc: 't1' },
      { file_name: 'o.jpg', created_at_utc: 't1' },
    ]);
  });
});
