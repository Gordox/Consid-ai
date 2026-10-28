import {
  LATEST_SCHEMA_VERSION,
  migrateDatabase,
  MIGRATIONS,
} from '../../src/persistence/migrations';
import { openNodeSqlite } from '../support/nodeSqliteDatabase';

function columns(db: ReturnType<typeof openNodeSqlite>, table: string): string[] {
  return db.raw
    .prepare(`SELECT name FROM pragma_table_info('${table}')`)
    .all()
    .map((row) => String(row.name));
}

// Runs the real migration SQL; WAL cannot be enabled in memory, so the runner's journal check is
// bypassed here by executing the migrations directly in order.
async function migrateTo(db: ReturnType<typeof openNodeSqlite>, version: number): Promise<void> {
  for (const sql of MIGRATIONS.slice(0, version)) {
    await db.execAsync(sql);
  }
}

describe('migrations on SQLite', () => {
  it('creates the latest schema from an empty database', async () => {
    const db = openNodeSqlite();
    await migrateTo(db, LATEST_SCHEMA_VERSION);
    expect(columns(db, 'round_photos')).toContain('original_file_name');
    expect(columns(db, 'pending_photo_picks')).toEqual([
      'slot',
      'round_id',
      'role',
      'started_at_utc',
    ]);
  });

  it('keeps sessions, rounds and photos saved at schema 2', async () => {
    const db = openNodeSqlite();
    await migrateTo(db, 2);
    db.raw.exec(`INSERT INTO sessions VALUES ('s1','2026-10-01T10:00:00.000Z','Europe/Stockholm',
      'P1','pistol','9 mm',25,5,NULL,NULL)`);
    db.raw.exec(`INSERT INTO rounds (id, session_id, sequence, state, created_at_utc, actual_shots,
      declared_misses, unresolved_shots, target_id, hit_diameter_mm)
      VALUES ('r1','s1',1,'draft','t',5,0,0,'demo-synthetic-v1',9)`);
    db.raw.exec(`INSERT INTO round_photos (round_id, role, file_name, width, height, added_at_utc)
      VALUES ('r1','after','a.jpg',3024,4032,'t')`);

    for (const sql of MIGRATIONS.slice(2)) {
      await db.execAsync(sql);
    }

    expect(db.raw.prepare('SELECT firearm_name FROM sessions').all()).toHaveLength(1);
    expect(db.raw.prepare('SELECT * FROM round_photos').get()).toMatchObject({
      file_name: 'a.jpg',
      original_file_name: null,
      width: 3024,
    });
  });

  it('allows only one pending photo pick', async () => {
    const db = openNodeSqlite();
    await migrateTo(db, LATEST_SCHEMA_VERSION);
    expect(() =>
      db.raw.exec("INSERT INTO pending_photo_picks VALUES (2, 'r', 'after', 't')"),
    ).toThrow(/CHECK/);
  });

  it('is applied by the runner when the journal mode is reported as WAL', async () => {
    const db = openNodeSqlite();
    const reportingWal = {
      ...db,
      getFirstAsync: async (source: string, params: never[]) =>
        source === 'PRAGMA journal_mode = WAL'
          ? { journal_mode: 'wal' }
          : db.getFirstAsync(source, params),
    };
    await migrateDatabase(reportingWal);
    expect(db.raw.prepare('PRAGMA user_version').get()).toEqual({
      user_version: LATEST_SCHEMA_VERSION,
    });
  });
});

describe('migration 4 on SQLite', () => {
  it('keeps marks and makes only untouched suggestions pending', async () => {
    const db = openNodeSqlite();
    for (const sql of MIGRATIONS.slice(0, 3)) {
      await db.execAsync(sql);
    }
    db.raw.exec(`INSERT INTO sessions VALUES ('s1','t','UTC','P','pistol','9 mm',25,5,NULL,NULL)`);
    db.raw.exec(`INSERT INTO rounds (id, session_id, sequence, state, created_at_utc, actual_shots,
      declared_misses, unresolved_shots, target_id, hit_diameter_mm)
      VALUES ('r1','s1',1,'draft','t',3,0,0,'demo-synthetic-v1',9)`);
    db.raw
      .exec(`INSERT INTO round_marks (id, round_id, ordinal, x, y, shots, source, uncertain, candidate_id)
      VALUES ('m','r1',0,1,1,1,'manual',0,NULL), ('s','r1',1,2,2,1,'suggested',1,'c1'),
             ('e','r1',2,3,3,1,'suggestedEdited',0,'c2')`);
    db.raw.exec(`INSERT INTO analysis_attempts (id, round_id, created_at_utc, source, status)
      VALUES ('a1','r1','t','demo','succeeded')`);

    await db.execAsync(MIGRATIONS[3] ?? '');

    expect(db.raw.prepare('SELECT id, accepted FROM round_marks ORDER BY ordinal').all()).toEqual([
      { id: 'm', accepted: 1 },
      { id: 's', accepted: 0 },
      { id: 'e', accepted: 1 },
    ]);
    expect(db.raw.prepare('SELECT after_file_name FROM analysis_attempts').get()).toEqual({
      after_file_name: null,
    });
  });
});
