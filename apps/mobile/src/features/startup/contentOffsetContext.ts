import { createContext, useContext } from 'react';

// Distance from the top of DatabaseGate's root view to the top of the screen content, e.g.
// below the development test-mode banner. 0 when nothing is drawn above the screens.
// Assumes the root view starts at the top of the screen; see
// docs/bugs/keyboard-covers-lower-form-fields.md (E2).
export const ContentOffsetContext = createContext(0);

export function useContentOffsetY(): number {
  return useContext(ContentOffsetContext);
}
