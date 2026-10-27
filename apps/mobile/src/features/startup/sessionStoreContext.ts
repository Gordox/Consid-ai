import { createContext, useContext } from 'react';

import type { SessionStore } from './databaseLifecycle';

export const SessionStoreContext = createContext<SessionStore | null>(null);

// Only valid below DatabaseGate, which renders its children once the database is ready.
export function useSessionStore(): SessionStore {
  const store = useContext(SessionStoreContext);
  if (store === null) {
    throw new Error('useSessionStore must be used below DatabaseGate');
  }
  return store;
}
