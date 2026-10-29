import { pickLibraryPhoto, type LibraryPickOutcome } from '../../src/features/rounds/libraryPick';
import { recoverPendingPick } from '../../src/features/rounds/pendingPickRecovery';
import { photoSaveDeps } from '../../src/features/rounds/photoActions';
import { savePickedPhoto } from '../../src/features/rounds/roundPhotos';
import {
  clearPendingPick,
  readPendingPick,
  recordPendingPick,
} from '../../src/persistence/pendingPhotoPick';
import {
  discardDraftRound,
  DraftChangedError,
  getRound,
  saveDraftAnnotations,
  setDraftPhoto,
} from '../../src/persistence/roundRepository';
import type { PickOutcome } from '../../src/services/pickedPhoto';
import type { PhotoStore } from '../../src/services/photoStorage';
import { deferred, flushPromises, type Deferred } from '../support/async';
import {
  databaseWithDraft,
  draftRevision,
  ROUND_ID,
  storeConfirmedRound,
  TEST_CALIBRATION,
} from '../support/sqliteFixtures';

// Real SQLite and the app's save path; the photo folder is a set of names. A save can be held
// at the copy step, so another photo or edit can land while it is still running.

type Db = Awaited<ReturnType<typeof databaseWithDraft>>;

function folder(hold?: Deferred<void>): PhotoStore & { readonly files: Set<string> } {
  const files = new Set<string>();
  return {
    files,
    copyOriginal: async (_uri, name) => {
      if (hold !== undefined) await hold.promise;
      files.add(name);
    },
    createNormalized: async (_original, name) => {
      files.add(name);
      return { width: 3024, height: 4032 };
    },
    uri: (name) => name,
    exists: (name) => files.has(name),
    size: () => null,
    delete: (name) => {
      files.delete(name);
    },
    readHead: () => new Uint8Array(),
    uploadFile: () => new Blob(),
    deleteCameraTemporary: () => false,
  };
}

let ids = 0;
const PICKED = { uri: 'file:///cache/picked.jpg', width: 3024, height: 4032 };

function save(db: Db, store: PhotoStore, revision: number) {
  return savePickedPhoto('after', PICKED, {
    ...photoSaveDeps(db, store, ROUND_ID, revision, () => undefined),
    newId: () => `55555555-5555-4555-8555-${String((ids += 1)).padStart(12, '0')}`,
  });
}

const journal = (db: Db) => db.raw.prepare('SELECT file_name FROM photo_files').all();

describe('late photo saves on SQLite', () => {
  it('refuses an older photo that finishes after a newer one and deletes its copies', async () => {
    const db = await databaseWithDraft();
    const start = await draftRevision(db);
    const hold = deferred<void>();
    const slowStore = folder(hold);
    const slow = save(db, slowStore, start);
    await flushPromises();
    const fastStore = folder();
    const fast = await save(db, fastStore, start);
    hold.resolve();

    await expect(slow).rejects.toBeInstanceOf(DraftChangedError);
    const round = await getRound(db, ROUND_ID);
    expect(round?.photos.after?.fileName).toBe(fast.fileName);
    expect(slowStore.files.size).toBe(0);
    expect(journal(db)).toHaveLength(2);
  });

  it('refuses a photo that would clear marks made while it was saving', async () => {
    const db = await databaseWithDraft();
    await setDraftPhoto(db, ROUND_ID, { ...PICKED_ROW }, await draftRevision(db));
    const start = await draftRevision(db);
    const hold = deferred<void>();
    const pending = save(db, folder(hold), start);
    await flushPromises();
    await saveDraftAnnotations(db, ROUND_ID, start, TEST_CALIBRATION, []);
    hold.resolve();

    await expect(pending).rejects.toBeInstanceOf(DraftChangedError);
    const round = await getRound(db, ROUND_ID);
    expect(round?.state === 'draft' ? round.calibration : null).toEqual(TEST_CALIBRATION);
  });

  it('adds nothing to a round discarded or confirmed during the save', async () => {
    for (const close of ['discard', 'confirm'] as const) {
      const db = await databaseWithDraft();
      const hold = deferred<void>();
      const store = folder(hold);
      const pending = save(db, store, await draftRevision(db));
      await flushPromises();
      if (close === 'discard') {
        await discardDraftRound(db, ROUND_ID);
      } else {
        storeConfirmedRound(
          db,
          ROUND_ID,
          {
            subtotal: 0,
            status: 'complete',
            actualShots: 5,
            declaredMisses: 5,
            unresolvedShots: 0,
          },
          't',
        );
      }
      hold.resolve();
      await expect(pending).rejects.toThrow();
      expect(store.files.size).toBe(0);
      expect(db.raw.prepare('SELECT * FROM round_photos').all()).toEqual([]);
    }
  });
});

const PICKED_ROW = {
  role: 'after' as const,
  fileName: 'old.jpg',
  originalFileName: 'old.o.jpg',
  width: 3024,
  height: 4032,
  addedAtUtc: 't',
};

describe('pickLibraryPhoto on SQLite', () => {
  async function pick(db: Db, chosen: PickOutcome, revision?: number) {
    const store = folder();
    const seenPending: unknown[] = [];
    const outcome: LibraryPickOutcome = await pickLibraryPhoto(
      {
        recordPending: (record) => recordPendingPick(db, record),
        clearPending: () => clearPendingPick(db),
        choose: async () => {
          seenPending.push(await readPendingPick(db));
          return chosen;
        },
        save: async (photo) => {
          await savePickedPhoto('after', photo, {
            ...photoSaveDeps(db, store, ROUND_ID, revision ?? 0, () => undefined),
            newId: () => `66666666-6666-4666-8666-${String((ids += 1)).padStart(12, '0')}`,
          });
        },
        now: () => 't',
        reportError: () => undefined,
      },
      { roundId: ROUND_ID, role: 'after', draftRevision: revision ?? (await draftRevision(db)) },
    );
    return { outcome, seenPending, store };
  }

  it('records the round, role and revision while the picker is open, then clears it', async () => {
    const db = await databaseWithDraft();
    const revision = await draftRevision(db);
    const { outcome, seenPending } = await pick(db, { kind: 'picked', photo: PICKED }, revision);
    expect(outcome).toEqual({ kind: 'saved' });
    expect(seenPending).toEqual([
      { roundId: ROUND_ID, role: 'after', startedAtUtc: 't', draftRevision: revision },
    ]);
    await expect(readPendingPick(db)).resolves.toBeNull();
  });

  it('clears the record and passes on cancel, failure and a denied permission', async () => {
    for (const chosen of [
      { kind: 'cancelled' },
      { kind: 'failed' },
      { kind: 'permissionDenied', canAskAgain: false },
    ] as const) {
      const db = await databaseWithDraft();
      const { outcome } = await pick(db, chosen);
      expect(outcome).toEqual(chosen);
      await expect(readPendingPick(db)).resolves.toBeNull();
    }
  });

  it('reports a round that changed since the picker opened, adding nothing', async () => {
    const db = await databaseWithDraft();
    const opened = await draftRevision(db);
    await setDraftPhoto(db, ROUND_ID, PICKED_ROW, opened);
    const { outcome, store } = await pick(db, { kind: 'picked', photo: PICKED }, opened);
    expect(outcome).toEqual({ kind: 'changed' });
    expect(store.files.size).toBe(0);
    expect((await getRound(db, ROUND_ID))?.photos.after?.fileName).toBe('old.jpg');
  });
});

describe('recovering a pick after a restart on SQLite', () => {
  it('does not add the photo when the round changed after the pick started', async () => {
    const db = await databaseWithDraft();
    const started = await draftRevision(db);
    await recordPendingPick(db, {
      roundId: ROUND_ID,
      role: 'after',
      startedAtUtc: 't',
      draftRevision: started,
    });
    await setDraftPhoto(db, ROUND_ID, PICKED_ROW, started);
    const store = folder();
    const outcome = await recoverPendingPick({
      readPending: () => readPendingPick(db),
      takePendingResult: async () => ({ canceled: false, assets: [PICKED] }),
      savePhoto: async (record, photo) => {
        await savePickedPhoto(record.role, photo, {
          ...photoSaveDeps(db, store, record.roundId, record.draftRevision, () => undefined),
          newId: () => `77777777-7777-4777-8777-${String((ids += 1)).padStart(12, '0')}`,
        });
      },
      clearPending: () => clearPendingPick(db),
      reportError: () => undefined,
    });
    expect(outcome).toMatchObject({ kind: 'notSaved', reason: 'roundChanged' });
    expect(store.files.size).toBe(0);
    await expect(readPendingPick(db)).resolves.toBeNull();
  });
});
