import { validateProfileInput, validateTemplateInput } from '../../src/domain/library/library';
import {
  createProfile,
  createTemplate,
  getProfile,
  listProfiles,
  listTemplates,
  markUsed,
  setArchived,
  updateProfile,
  updateTemplate,
} from '../../src/persistence/libraryRepository';
import { MIGRATIONS } from '../../src/persistence/migrations';
import { getSession } from '../../src/persistence/sessionRepository';
import { openNodeSqlite } from '../support/nodeSqliteDatabase';
import { databaseWithDraft, SESSION_ID } from '../support/sqliteFixtures';

function profile(name: string, calibre = '9×19mm') {
  const result = validateProfileInput({
    firearmName: name,
    firearmType: 'pistol',
    calibreLabel: calibre,
  });
  if (!result.ok) throw new Error('fixture');
  return result.value;
}

function template(name: string, rounds = '') {
  const result = validateTemplateInput({
    name,
    distanceMetres: '25',
    plannedShotsPerRound: '5',
    plannedRounds: rounds,
  });
  if (!result.ok) throw new Error('fixture');
  return result.value;
}

describe('migration 7 on SQLite', () => {
  it('adds the two tables to a schema-6 database and keeps its sessions and rounds', async () => {
    const db = openNodeSqlite();
    for (const sql of MIGRATIONS.slice(0, 6)) await db.execAsync(sql);
    db.raw.exec(`INSERT INTO sessions VALUES ('${SESSION_ID}','2026-10-01T10:00:00.000Z',
      'Europe/Stockholm','Old pistol','pistol','old free text cal',25,5,NULL,NULL)`);
    db.raw.exec(`INSERT INTO rounds (id, session_id, sequence, state, created_at_utc, actual_shots,
      declared_misses, unresolved_shots, target_id, hit_diameter_mm)
      VALUES ('r1','${SESSION_ID}',1,'draft','t',5,0,0,'demo-synthetic-v1',9)`);

    const seventh = MIGRATIONS[6];
    if (seventh === undefined) throw new Error('migration 7 missing');
    await db.execAsync(seventh);

    const found = await getSession(db, SESSION_ID);
    expect(found !== null && 'session' in found && found.session.settings).toMatchObject({
      firearmName: 'Old pistol',
      calibreLabel: 'old free text cal',
    });
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM rounds').get()).toEqual({ n: 1 });
    expect(await listProfiles(db)).toEqual({ active: [], archived: [], unreadable: 0 });
  });

  it('refuses a stored 0 planned rounds in a template', async () => {
    const db = await databaseWithDraft();
    expect(() =>
      db.raw.exec(`INSERT INTO training_templates (id, name, distance_m, planned_shots_per_round,
        planned_rounds, created_at_utc, updated_at_utc) VALUES ('t','T',25,5,0,'t','t')`),
    ).toThrow(/CHECK/);
  });
});

describe('profiles and templates on SQLite', () => {
  it('editing or archiving a profile never changes a saved session', async () => {
    const db = await databaseWithDraft();
    const before = await getSession(db, SESSION_ID);
    await createProfile(db, { id: 'p1', nowUtc: 't1', values: profile('P1', '9 mm') });
    await updateProfile(db, 'p1', profile('Renamed', '.22 LR'), 't2');
    await setArchived(db, 'profile', 'p1', true, 't3');
    expect(await getSession(db, SESSION_ID)).toEqual(before);
    expect(await getProfile(db, 'p1')).toMatchObject({
      firearmName: 'Renamed',
      calibreLabel: '.22 LR',
      archivedAtUtc: 't3',
    });
  });

  it('lists active and archived separately and restores an archived item', async () => {
    const db = await databaseWithDraft();
    await createTemplate(db, { id: 't1', nowUtc: 't', values: template('Standard training') });
    await createTemplate(db, { id: 't2', nowUtc: 't', values: template('Match', '6') });
    await setArchived(db, 'template', 't2', true, 't3');
    let library = await listTemplates(db);
    expect(library.active.map((item) => item.id)).toEqual(['t1']);
    expect(library.archived.map((item) => item.id)).toEqual(['t2']);
    expect(library.active[0]?.plannedRounds).toBeNull();

    await setArchived(db, 'template', 't2', false, 't4');
    library = await listTemplates(db);
    expect(library.active.map((item) => item.id).sort()).toEqual(['t1', 't2']);
    expect(library.archived).toEqual([]);
  });

  it('records the last use and keeps it through edits', async () => {
    const db = await databaseWithDraft();
    await createTemplate(db, { id: 't1', nowUtc: 't', values: template('A') });
    await markUsed(db, 'template', 't1', '2026-10-28T10:00:00.000Z');
    await updateTemplate(db, 't1', template('A2', '3'), 't5');
    const [item] = (await listTemplates(db)).active;
    expect(item).toMatchObject({
      name: 'A2',
      plannedRounds: 3,
      lastUsedAtUtc: '2026-10-28T10:00:00.000Z',
    });
  });

  it('counts an unreadable row instead of showing it', async () => {
    const db = await databaseWithDraft();
    await createProfile(db, { id: 'p1', nowUtc: 't', values: profile('Good') });
    // Valid for the table's CHECK but not normalised: the domain rejects it.
    db.raw.exec(`INSERT INTO firearm_profiles (id, firearm_name, firearm_type, calibre_label,
      created_at_utc, updated_at_utc) VALUES ('p2',' padded ','pistol','9','t','t')`);
    const library = await listProfiles(db);
    expect(library.active.map((item) => item.id)).toEqual(['p1']);
    expect(library.unreadable).toBe(1);
  });
});
