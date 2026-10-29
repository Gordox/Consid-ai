import { createContext, useContext } from 'react';

import type { PhotoStore } from '../../services/photoStorage';

export const PhotoStoreContext = createContext<PhotoStore | null>(null);

// Only valid below DatabaseGate, which provides the photo folder of the open database.
export function usePhotoStore(): PhotoStore {
  const store = useContext(PhotoStoreContext);
  if (store === null) {
    throw new Error('usePhotoStore must be used below DatabaseGate');
  }
  return store;
}
