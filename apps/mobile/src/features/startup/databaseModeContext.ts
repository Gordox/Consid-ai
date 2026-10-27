import { createContext, useContext } from 'react';

import type { DatabaseMode } from './databaseLifecycle';

export type DatabaseModeControl = {
  readonly mode: DatabaseMode;
  // Throws outside development when asked for the test database.
  switchMode(mode: DatabaseMode): void;
};

export const DatabaseModeContext = createContext<DatabaseModeControl | null>(null);

// Only valid below DatabaseGate.
export function useDatabaseMode(): DatabaseModeControl {
  const control = useContext(DatabaseModeContext);
  if (control === null) {
    throw new Error('useDatabaseMode must be used below DatabaseGate');
  }
  return control;
}
