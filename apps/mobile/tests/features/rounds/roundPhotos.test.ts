import {
  findOrphanPhotos,
  ORPHAN_MIN_AGE_MS,
  savePickedPhoto,
  type SavePhotoDeps,
} from '../../../src/features/rounds/roundPhotos';
import { toPickOutcome } from '../../../src/services/pickedPhoto';

function deps(overrides: Partial<SavePhotoDeps> = {}) {
  const events: string[] = [];
  let ids = 0;
  const base: SavePhotoDeps = {
    copyOriginal: async (uri: string, id: string) => {
      events.push(`copy ${uri}`);
      return `${id}.jpg`;
    },
    createNormalized: async (original: string, id: string) => {
      events.push(`normalize ${original}`);
      return { fileName: `${id}.jpg`, width: 3024, height: 4032 };
    },
    saveRow: async (photo) => {
      events.push(`row ${photo.fileName}`);
      return [];
    },
    deleteFile: (name) => {
      events.push(`delete ${name}`);
    },
    newId: () => {
      ids += 1;
      return ids === 1 ? 'orig' : 'norm';
    },
    now: () => 't',
    reportError: (error) => {
      events.push(`report ${String(error)}`);
    },
  };
  return { events, deps: { ...base, ...overrides } };
}

// The picker reports the size landscape; the normalised copy is upright, and its size wins.
const PICKED = { uri: 'file:///cache/picked.jpg', width: 4032, height: 3024 };

describe('savePickedPhoto', () => {
  it('copies, normalises, then writes the row with the normalised size', async () => {
    const { events, deps: d } = deps();
    const photo = await savePickedPhoto('after', PICKED, d);
    expect(events).toEqual(['copy file:///cache/picked.jpg', 'normalize orig.jpg', 'row norm.jpg']);
    expect(photo).toEqual({
      role: 'after',
      fileName: 'norm.jpg',
      originalFileName: 'orig.jpg',
      width: 3024,
      height: 4032,
      addedAtUtc: 't',
    });
  });

  it('removes the original copy when normalising fails, and rethrows', async () => {
    const { events, deps: d } = deps({
      createNormalized: async () => {
        throw new Error('decode failed');
      },
    });
    await expect(savePickedPhoto('after', PICKED, d)).rejects.toThrow('decode failed');
    expect(events).toEqual(['copy file:///cache/picked.jpg', 'delete orig.jpg']);
  });

  it('removes both new copies when the row cannot be written, and rethrows', async () => {
    const failure = new Error('database is locked');
    const { events, deps: d } = deps({
      saveRow: async () => {
        throw failure;
      },
    });
    await expect(savePickedPhoto('after', PICKED, d)).rejects.toBe(failure);
    expect(events.slice(-2)).toEqual(['delete norm.jpg', 'delete orig.jpg']);
  });

  it('deletes the replaced copies only after the new row is written', async () => {
    const { events, deps: d } = deps({
      saveRow: async (photo) => {
        events.push(`row ${photo.fileName}`);
        return ['old.jpg', 'old-original.jpg'];
      },
    });
    await savePickedPhoto('before', PICKED, d);
    expect(events.slice(-3)).toEqual(['row norm.jpg', 'delete old.jpg', 'delete old-original.jpg']);
  });

  it('keeps a saved photo when deleting the old copy fails', async () => {
    const { events, deps: d } = deps({
      saveRow: async () => ['old.jpg'],
      deleteFile: () => {
        throw new Error('io');
      },
    });
    await expect(savePickedPhoto('before', PICKED, d)).resolves.toMatchObject({
      fileName: 'norm.jpg',
    });
    expect(events.at(-1)).toBe('report Error: io');
  });

  it('never deletes anything when the copy itself fails', async () => {
    const { events, deps: d } = deps({
      copyOriginal: async () => {
        throw new Error('no space');
      },
    });
    await expect(savePickedPhoto('after', PICKED, d)).rejects.toThrow('no space');
    expect(events).toEqual([]);
  });
});

describe('findOrphanPhotos', () => {
  const NOW = 10 * ORPHAN_MIN_AGE_MS;
  const old = NOW - ORPHAN_MIN_AGE_MS;

  it('returns only old files that no row refers to', () => {
    expect(
      findOrphanPhotos(
        [
          { fileName: 'used.jpg', modifiedAtMs: 0 },
          { fileName: 'used-original.jpg', modifiedAtMs: 0 },
          { fileName: 'orphan.jpg', modifiedAtMs: old },
        ],
        new Set(['used.jpg', 'used-original.jpg']),
        NOW,
      ),
    ).toEqual(['orphan.jpg']);
  });

  it('keeps recent files, which may belong to a save that is still running', () => {
    expect(
      findOrphanPhotos([{ fileName: 'fresh.jpg', modifiedAtMs: old + 1 }], new Set(), NOW),
    ).toEqual([]);
  });

  it('keeps files whose age is unknown', () => {
    expect(findOrphanPhotos([{ fileName: 'x.jpg', modifiedAtMs: null }], new Set(), NOW)).toEqual(
      [],
    );
  });
});

describe('toPickOutcome', () => {
  it('reads a picked image', () => {
    expect(
      toPickOutcome({ canceled: false, assets: [{ uri: 'file:///a.jpg', width: 10, height: 20 }] }),
    ).toEqual({
      kind: 'picked',
      photo: { uri: 'file:///a.jpg', width: 10, height: 20 },
    });
  });

  it('separates a cancelled pick from a failure', () => {
    expect(toPickOutcome({ canceled: true, assets: null })).toEqual({ kind: 'cancelled' });
    expect(toPickOutcome({ canceled: false, assets: [] })).toEqual({ kind: 'failed' });
    expect(toPickOutcome({ canceled: false, assets: [{ uri: '', width: 1, height: 1 }] })).toEqual({
      kind: 'failed',
    });
    expect(toPickOutcome({ canceled: false, assets: [{ uri: 'x', width: 0, height: 1 }] })).toEqual(
      { kind: 'failed' },
    );
    expect(toPickOutcome(null)).toEqual({ kind: 'failed' });
  });
});
