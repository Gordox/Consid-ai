import {
  abandonedCutoffUtc,
  ABANDONED_MIN_AGE_MS,
  deleteUnreferencedPhotos,
  savePickedPhoto,
  type SavePhotoDeps,
} from '../../../src/features/rounds/roundPhotos';
import { toPickOutcome } from '../../../src/services/pickedPhoto';

const ORIGINAL = '00000000-0000-4000-8000-000000000001.jpg';
const NORMALIZED = '00000000-0000-4000-8000-000000000002.jpg';

function deps(overrides: Partial<SavePhotoDeps> = {}) {
  const events: string[] = [];
  let ids = 0;
  const base: SavePhotoDeps = {
    recordFile: async (name: string) => {
      events.push(`record ${name}`);
    },
    copyOriginal: async (uri: string, name: string) => {
      events.push(`copy ${uri} ${name}`);
    },
    createNormalized: async (original: string, name: string) => {
      events.push(`normalize ${original} ${name}`);
      return { width: 3024, height: 4032 };
    },
    saveRow: async (photo) => {
      events.push(`row ${photo.fileName}`);
      return [];
    },
    discardFiles: async (names: readonly string[]) => {
      events.push(`discard ${names.join(',')}`);
    },
    newId: () => {
      ids += 1;
      return `00000000-0000-4000-8000-00000000000${ids}`;
    },
    now: () => 't',
  };
  return { events, deps: { ...base, ...overrides } };
}

// The picker reports the size landscape; the normalised copy is upright, and its size wins.
const PICKED = { uri: 'file:///cache/picked.jpg', width: 4032, height: 3024 };

describe('savePickedPhoto', () => {
  it('records each file before writing it, then writes the row with the normalised size', async () => {
    const { events, deps: d } = deps();
    const photo = await savePickedPhoto('after', PICKED, d);
    expect(events).toEqual([
      `record ${ORIGINAL}`,
      `copy file:///cache/picked.jpg ${ORIGINAL}`,
      `record ${NORMALIZED}`,
      `normalize ${ORIGINAL} ${NORMALIZED}`,
      `row ${NORMALIZED}`,
      'discard ',
    ]);
    expect(photo).toEqual({
      role: 'after',
      fileName: NORMALIZED,
      originalFileName: ORIGINAL,
      width: 3024,
      height: 4032,
      addedAtUtc: 't',
    });
  });

  it('writes nothing when the journal cannot record the file', async () => {
    const { events, deps: d } = deps({
      recordFile: async () => {
        throw new Error('database is locked');
      },
    });
    await expect(savePickedPhoto('after', PICKED, d)).rejects.toThrow('database is locked');
    expect(events).toEqual(['discard ']);
  });

  it('discards the original copy when normalising fails, and rethrows', async () => {
    const { events, deps: d } = deps({
      createNormalized: async () => {
        throw new Error('decode failed');
      },
    });
    await expect(savePickedPhoto('after', PICKED, d)).rejects.toThrow('decode failed');
    expect(events.at(-1)).toBe(`discard ${ORIGINAL},${NORMALIZED}`);
  });

  it('discards both new copies when the row cannot be written, and rethrows', async () => {
    const failure = new Error('database is locked');
    const { events, deps: d } = deps({
      saveRow: async () => {
        throw failure;
      },
    });
    await expect(savePickedPhoto('after', PICKED, d)).rejects.toBe(failure);
    expect(events.at(-1)).toBe(`discard ${ORIGINAL},${NORMALIZED}`);
  });

  it('discards the replaced copies only after the new row is written', async () => {
    const { events, deps: d } = deps({
      saveRow: async (photo) => {
        events.push(`row ${photo.fileName}`);
        return ['old.jpg', 'old-original.jpg'];
      },
    });
    await savePickedPhoto('before', PICKED, d);
    expect(events.slice(-2)).toEqual([`row ${NORMALIZED}`, 'discard old.jpg,old-original.jpg']);
  });
});

describe('deleteUnreferencedPhotos', () => {
  function deleter(referenced: Set<string>, failing: Set<string> = new Set()) {
    const events: string[] = [];
    return {
      events,
      deps: {
        isReferenced: async (name: string) => referenced.has(name),
        deleteFile: (name: string) => {
          if (failing.has(name)) throw new Error('io');
          events.push(`delete ${name}`);
        },
        forget: async (name: string) => {
          events.push(`forget ${name}`);
        },
        reportError: () => {
          events.push('report');
        },
      },
    };
  }

  it('checks every file just before deleting it and never deletes a referenced one', async () => {
    const { events, deps: d } = deleter(new Set(['used.jpg']));
    await expect(deleteUnreferencedPhotos(['used.jpg', 'old.jpg'], d)).resolves.toEqual({
      deleted: ['old.jpg'],
      kept: ['used.jpg'],
    });
    expect(events).toEqual(['delete old.jpg', 'forget old.jpg']);
  });

  it('keeps the journal record when the file cannot be deleted, so cleanup retries', async () => {
    const { events, deps: d } = deleter(new Set(), new Set(['stuck.jpg']));
    await expect(deleteUnreferencedPhotos(['stuck.jpg'], d)).resolves.toEqual({
      deleted: [],
      kept: ['stuck.jpg'],
    });
    expect(events).toEqual(['report']);
  });
});

describe('abandonedCutoffUtc', () => {
  it('leaves the most recent files alone', () => {
    const now = Date.parse('2026-10-28T12:00:00.000Z');
    expect(abandonedCutoffUtc(now)).toBe(new Date(now - ABANDONED_MIN_AGE_MS).toISOString());
    expect(ABANDONED_MIN_AGE_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
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
