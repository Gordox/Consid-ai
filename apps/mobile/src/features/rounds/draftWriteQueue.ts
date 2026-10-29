// Writes a screen's snapshots of a draft (its counts, or its calibration and marks) one after
// another, each based on the revision the previous write produced. Every snapshot is the whole
// state, so a later one also carries the changes of an earlier one that failed.
//
// When a write finds that something else changed the draft (DraftChangedError), the queue stops
// for good: that snapshot and every one queued after it were made from the outdated draft, and
// writing them with the new revision would overwrite the newer work. The screen reads the draft
// again and starts a new queue; the dropped snapshots are counted so it can say how many changes
// were lost.

export type WriteOutcome = 'saved' | 'failed' | 'changed';

export type DraftWriteStatus = {
  // Snapshots queued or being written.
  readonly pending: number;
  // The latest finished write failed and no later one has succeeded yet.
  readonly failed: boolean;
  // Snapshots dropped because the draft changed; non-zero once the queue has stopped.
  readonly lostChanges: number;
};

export type DraftWriteQueue<T> = {
  // False when the queue has stopped after a change; the snapshot is counted as lost.
  enqueue(snapshot: T): boolean;
  // Settles when every snapshot queued so far has been written, has failed or was dropped.
  settled(): Promise<WriteOutcome>;
  // The revision the next write is based on: the draft's, advanced by this queue's own writes.
  revision(): number;
  status(): DraftWriteStatus;
  subscribe(listener: () => void): () => void;
};

export function createDraftWriteQueue<T>(deps: {
  readonly initialRevision: number;
  // Writes the snapshot if the draft is at expectedRevision and returns the new revision.
  readonly write: (snapshot: T, expectedRevision: number) => Promise<number>;
  readonly isConflict: (error: unknown) => boolean;
  readonly reportError: (error: unknown) => void;
}): DraftWriteQueue<T> {
  let revision = deps.initialRevision;
  let chain: Promise<void> = Promise.resolve();
  let status: DraftWriteStatus = { pending: 0, failed: false, lostChanges: 0 };
  const listeners = new Set<() => void>();
  const stopped = () => status.lostChanges > 0;

  function update(next: Partial<DraftWriteStatus>): void {
    status = { ...status, ...next };
    for (const listener of [...listeners]) listener();
  }

  return {
    enqueue(snapshot) {
      if (stopped()) {
        update({ lostChanges: status.lostChanges + 1 });
        return false;
      }
      update({ pending: status.pending + 1 });
      chain = chain.then(async () => {
        if (stopped()) {
          update({ pending: status.pending - 1, lostChanges: status.lostChanges + 1 });
          return;
        }
        try {
          revision = await deps.write(snapshot, revision);
          update({ pending: status.pending - 1, failed: false });
        } catch (error) {
          if (deps.isConflict(error)) {
            update({ pending: status.pending - 1, lostChanges: status.lostChanges + 1 });
          } else {
            deps.reportError(error);
            update({ pending: status.pending - 1, failed: true });
          }
        }
      });
      return true;
    },

    settled: () => chain.then(() => (stopped() ? 'changed' : status.failed ? 'failed' : 'saved')),

    revision: () => revision,

    status: () => status,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
