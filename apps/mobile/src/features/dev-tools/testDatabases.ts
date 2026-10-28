import { DATABASE_NAME } from '../../persistence/database';
import type { DatabaseMode } from '../startup/databaseLifecycle';

// The only databases the developer checks may open, change or delete. The normal database is
// never on this list. See implementation/step-7-verification.md §4.1.
export const DEVICE_CHECK_DATABASE_NAME = 'target-practice-device-check.db';
export const UI_CHECK_DATABASE_NAME = 'target-practice-ui-check.db';

const TEST_DATABASE_NAMES: readonly string[] = [DEVICE_CHECK_DATABASE_NAME, UI_CHECK_DATABASE_NAME];

export class DevelopmentOnlyError extends Error {
  constructor() {
    super('Developer checks are only available in development builds');
    this.name = 'DevelopmentOnlyError';
  }
}

export class NotATestDatabaseError extends Error {
  constructor() {
    // The name is left out so a mistaken value is never echoed into logs.
    super('Developer checks may only use the allowed test databases');
    this.name = 'NotATestDatabaseError';
  }
}

// Every developer-check operation calls this first, not only the screen that offers it.
export function assertDevelopment(isDevelopment: boolean = __DEV__): void {
  if (!isDevelopment) {
    throw new DevelopmentOnlyError();
  }
}

// Exact match only: no trimming, case folding or paths.
export function assertTestDatabaseName(name: string): string {
  if (!TEST_DATABASE_NAMES.includes(name)) {
    throw new NotATestDatabaseError();
  }
  return name;
}

export function databaseNameForMode(mode: DatabaseMode, isDevelopment: boolean = __DEV__): string {
  if (mode === 'normal') {
    return DATABASE_NAME;
  }
  assertDevelopment(isDevelopment);
  return assertTestDatabaseName(UI_CHECK_DATABASE_NAME);
}

// Each database keeps its photo copies in its own folder, so the unused-copy cleanup of one
// database never sees files that another database refers to.
export const NORMAL_PHOTO_FOLDER = 'photos';
const UI_CHECK_PHOTO_FOLDER = 'photos-ui-check';

export function photoFolderForMode(mode: DatabaseMode, isDevelopment: boolean = __DEV__): string {
  if (mode === 'normal') {
    return NORMAL_PHOTO_FOLDER;
  }
  assertDevelopment(isDevelopment);
  return UI_CHECK_PHOTO_FOLDER;
}

export type DeleteTestDatabaseDeps = {
  open: (name: string) => Promise<{ closeAsync(): Promise<void> }>;
  deleteDatabase: (name: string) => Promise<void>;
  isDevelopment?: boolean;
};

// expo-sqlite throws when the file is missing and has no way to ask whether it exists, so the
// file is opened (which creates it if needed) and closed before it is deleted. Deleting a
// database that is still open elsewhere is refused by expo-sqlite itself.
export async function deleteTestDatabase(
  name: string,
  deps: DeleteTestDatabaseDeps,
): Promise<void> {
  assertDevelopment(deps.isDevelopment);
  const allowed = assertTestDatabaseName(name);
  const db = await deps.open(allowed);
  await db.closeAsync();
  await deps.deleteDatabase(allowed);
}
