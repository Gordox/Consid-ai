import type { PhotoRole } from '../domain/round/round';
import type { SessionDatabase } from './database';
import { InvalidRoundDataError, readString } from './roundRow';

// The camera or library pick that was open when the app last left the foreground. Android may
// end the app while the picker is open; the photo is then delivered on the next start and this
// record says which round and role it belongs to. There is at most one at a time.
export type PendingPhotoPick = {
  readonly roundId: string;
  readonly role: PhotoRole;
  readonly startedAtUtc: string;
};

export async function recordPendingPick(
  db: SessionDatabase,
  pick: PendingPhotoPick,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO pending_photo_picks (slot, round_id, role, started_at_utc) VALUES (1, ?, ?, ?)
     ON CONFLICT (slot) DO UPDATE SET round_id = excluded.round_id, role = excluded.role,
       started_at_utc = excluded.started_at_utc`,
    [pick.roundId, pick.role, pick.startedAtUtc],
  );
}

export async function readPendingPick(db: SessionDatabase): Promise<PendingPhotoPick | null> {
  const row = await db.getFirstAsync(
    'SELECT round_id, role, started_at_utc FROM pending_photo_picks WHERE slot = 1',
    [],
  );
  if (row === null || row === undefined) {
    return null;
  }
  const role = readString(row, 'role');
  if (role !== 'before' && role !== 'after') {
    throw new InvalidRoundDataError('role');
  }
  return {
    roundId: readString(row, 'round_id'),
    role,
    startedAtUtc: readString(row, 'started_at_utc'),
  };
}

export async function clearPendingPick(db: SessionDatabase): Promise<void> {
  await db.runAsync('DELETE FROM pending_photo_picks WHERE slot = 1', []);
}
