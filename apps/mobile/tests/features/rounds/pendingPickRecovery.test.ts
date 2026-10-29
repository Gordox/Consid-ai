import {
  recoverPendingPick,
  type RecoveryDeps,
} from '../../../src/features/rounds/pendingPickRecovery';
import type { PendingPhotoPick } from '../../../src/persistence/pendingPhotoPick';
import { RoundNotEditableError } from '../../../src/persistence/roundRepository';

const PICK: PendingPhotoPick = {
  roundId: 'r1',
  role: 'after',
  startedAtUtc: 't',
  draftRevision: 2,
};
const DELIVERED = {
  canceled: false,
  assets: [{ uri: 'file:///cache/p.jpg', width: 4, height: 3 }],
};

function deps(overrides: Partial<RecoveryDeps> = {}) {
  const events: string[] = [];
  const base: RecoveryDeps = {
    readPending: async () => PICK,
    takePendingResult: async () => DELIVERED,
    savePhoto: async (pick, photo) => {
      events.push(`save ${pick.roundId} ${pick.role} ${photo.uri}`);
    },
    clearPending: async () => {
      events.push('clear');
    },
    reportError: () => {
      events.push('report');
    },
  };
  return { events, deps: { ...base, ...overrides } };
}

describe('recoverPendingPick', () => {
  it('does nothing, and asks Android for nothing, without a recorded pick', async () => {
    const take = jest.fn();
    const { events, deps: d } = deps({ readPending: async () => null, takePendingResult: take });
    await expect(recoverPendingPick(d)).resolves.toEqual({ kind: 'nothingPending' });
    expect(take).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('saves a delivered photo to the recorded round and role, then clears the record', async () => {
    const { events, deps: d } = deps();
    await expect(recoverPendingPick(d)).resolves.toEqual({ kind: 'saved', pick: PICK });
    expect(events).toEqual(['save r1 after file:///cache/p.jpg', 'clear']);
  });

  it('reports an interrupted pick when Android kept no result, and clears the record', async () => {
    const { events, deps: d } = deps({ takePendingResult: async () => null });
    await expect(recoverPendingPick(d)).resolves.toEqual({
      kind: 'notSaved',
      pick: PICK,
      reason: 'noPhoto',
    });
    expect(events).toEqual(['clear']);
  });

  it.each([
    ['a cancelled pick', { canceled: true, assets: null }],
    ['a picker error', { code: 'ERR', message: 'failed' }],
  ])('reports no photo for %s', async (_label, result) => {
    const { events, deps: d } = deps({ takePendingResult: async () => result });
    await expect(recoverPendingPick(d)).resolves.toEqual({
      kind: 'notSaved',
      pick: PICK,
      reason: 'noPhoto',
    });
    expect(events).toEqual(['clear']);
  });

  it('does not apply a photo to a round that is no longer a draft', async () => {
    const { events, deps: d } = deps({
      savePhoto: async () => {
        throw new RoundNotEditableError();
      },
    });
    await expect(recoverPendingPick(d)).resolves.toMatchObject({ reason: 'roundClosed' });
    expect(events).toEqual(['clear']);
  });

  it('reports a failed save and still clears, so the photo is never applied twice', async () => {
    const { events, deps: d } = deps({
      savePhoto: async () => {
        throw new Error('disk full');
      },
    });
    await expect(recoverPendingPick(d)).resolves.toMatchObject({ reason: 'saveFailed' });
    expect(events).toEqual(['report', 'clear']);
  });
});
