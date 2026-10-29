import type { RoundPhoto } from '../../src/domain/round/round';
import {
  clearPendingPick,
  readPendingPick,
  recordPendingPick,
} from '../../src/persistence/pendingPhotoPick';
import {
  discardDraftRound,
  getRound,
  listReferencedPhotoFiles,
  removeDraftPhoto,
  RoundNotEditableError,
  setDraftPhoto,
} from '../../src/persistence/roundRepository';
import { databaseWithDraft, ROUND_ID, draftRevision } from '../support/sqliteFixtures';

const after = (fileName: string, originalFileName: string | null): RoundPhoto => ({
  role: 'after',
  fileName,
  originalFileName,
  width: 3024,
  height: 4032,
  addedAtUtc: '2026-10-28T10:00:00.000Z',
});

describe('round photos on SQLite', () => {
  it('stores both copies and returns both when the photo is replaced', async () => {
    const db = await databaseWithDraft();
    await expect(
      setDraftPhoto(db, ROUND_ID, after('n1.jpg', 'o1.jpg'), await draftRevision(db)),
    ).resolves.toEqual([]);
    await expect(
      setDraftPhoto(db, ROUND_ID, after('n2.jpg', 'o2.jpg'), await draftRevision(db)),
    ).resolves.toEqual(['n1.jpg', 'o1.jpg']);
    const round = await getRound(db, ROUND_ID);
    expect(round?.photos.after).toMatchObject({ fileName: 'n2.jpg', originalFileName: 'o2.jpg' });
    expect(await listReferencedPhotoFiles(db)).toEqual(new Set(['n2.jpg', 'o2.jpg']));
  });

  it('returns only the single copy of a photo saved before schema 3', async () => {
    const db = await databaseWithDraft();
    await setDraftPhoto(db, ROUND_ID, after('legacy.jpg', null), await draftRevision(db));
    await expect(removeDraftPhoto(db, ROUND_ID, 'after', await draftRevision(db))).resolves.toEqual(
      ['legacy.jpg'],
    );
    expect(await listReferencedPhotoFiles(db)).toEqual(new Set());
  });

  it('returns every copy when a draft is discarded', async () => {
    const db = await databaseWithDraft();
    await setDraftPhoto(db, ROUND_ID, after('n.jpg', 'o.jpg'), await draftRevision(db));
    await setDraftPhoto(
      db,
      ROUND_ID,
      { ...after('b.jpg', 'bo.jpg'), role: 'before' },
      await draftRevision(db),
    );
    const files = await discardDraftRound(db, ROUND_ID);
    expect([...files].sort()).toEqual(['b.jpg', 'bo.jpg', 'n.jpg', 'o.jpg']);
  });

  it('refuses a photo for a confirmed round and leaves its rows unchanged', async () => {
    const db = await databaseWithDraft();
    await setDraftPhoto(db, ROUND_ID, after('n.jpg', 'o.jpg'), await draftRevision(db));
    db.raw.exec(`UPDATE rounds SET state = 'confirmed' WHERE id = '${ROUND_ID}'`);
    await expect(
      setDraftPhoto(db, ROUND_ID, after('x.jpg', 'y.jpg'), await draftRevision(db)),
    ).rejects.toBeInstanceOf(RoundNotEditableError);
    expect(await listReferencedPhotoFiles(db)).toEqual(new Set(['n.jpg', 'o.jpg']));
  });
});

describe('pending photo pick on SQLite', () => {
  it('keeps one record, replaced by the latest pick, until cleared', async () => {
    const db = await databaseWithDraft();
    await expect(readPendingPick(db)).resolves.toBeNull();
    await recordPendingPick(db, {
      roundId: ROUND_ID,
      role: 'before',
      startedAtUtc: 't1',
      draftRevision: null,
    });
    await recordPendingPick(db, {
      roundId: ROUND_ID,
      role: 'after',
      startedAtUtc: 't2',
      draftRevision: 3,
    });
    await expect(readPendingPick(db)).resolves.toEqual({
      roundId: ROUND_ID,
      role: 'after',
      startedAtUtc: 't2',
      draftRevision: 3,
    });
    await clearPendingPick(db);
    await expect(readPendingPick(db)).resolves.toBeNull();
  });
});
