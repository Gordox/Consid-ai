import { savePickedPhoto, type SavePhotoDeps } from '../../../src/features/rounds/roundPhotos';
import { toPickOutcome } from '../../../src/services/pickedPhoto';

function deps(overrides: Partial<SavePhotoDeps> = {}) {
  const events: string[] = [];
  const base: SavePhotoDeps = {
    copyIntoApp: async (uri, id) => {
      events.push(`copy ${uri}`);
      return `${id}.jpg`;
    },
    saveRow: async (photo) => {
      events.push(`row ${photo.fileName}`);
      return null;
    },
    deleteFile: (name) => {
      events.push(`delete ${name}`);
    },
    newId: () => 'new',
    now: () => 't',
    reportError: (error) => {
      events.push(`report ${String(error)}`);
    },
  };
  return { events, deps: { ...base, ...overrides } };
}

const PICKED = { uri: 'file:///cache/picked.jpg', width: 4000, height: 3000 };

describe('savePickedPhoto', () => {
  it('copies before writing the row and keeps the picked size', async () => {
    const { events, deps: d } = deps();
    const photo = await savePickedPhoto('after', PICKED, d);
    expect(events).toEqual(['copy file:///cache/picked.jpg', 'row new.jpg']);
    expect(photo).toEqual({
      role: 'after',
      fileName: 'new.jpg',
      width: 4000,
      height: 3000,
      addedAtUtc: 't',
    });
  });

  it('removes the new copy when the row cannot be written, and rethrows', async () => {
    const failure = new Error('database is locked');
    const { events, deps: d } = deps({
      saveRow: async () => {
        throw failure;
      },
    });
    await expect(savePickedPhoto('after', PICKED, d)).rejects.toBe(failure);
    expect(events).toEqual(['copy file:///cache/picked.jpg', 'delete new.jpg']);
  });

  it('deletes the replaced copy only after the new row is written', async () => {
    const { events, deps: d } = deps({
      saveRow: async (photo) => {
        events.push(`row ${photo.fileName}`);
        return 'old.jpg';
      },
    });
    await savePickedPhoto('before', PICKED, d);
    expect(events.slice(-2)).toEqual(['row new.jpg', 'delete old.jpg']);
  });

  it('keeps a saved photo when deleting the old copy fails', async () => {
    const { events, deps: d } = deps({
      saveRow: async () => 'old.jpg',
      deleteFile: () => {
        throw new Error('io');
      },
    });
    await expect(savePickedPhoto('before', PICKED, d)).resolves.toMatchObject({
      fileName: 'new.jpg',
    });
    expect(events.at(-1)).toBe('report Error: io');
  });

  it('never deletes anything when the copy itself fails', async () => {
    const { events, deps: d } = deps({
      copyIntoApp: async () => {
        throw new Error('no space');
      },
    });
    await expect(savePickedPhoto('after', PICKED, d)).rejects.toThrow('no space');
    expect(events).toEqual([]);
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
