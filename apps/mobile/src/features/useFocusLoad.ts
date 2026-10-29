import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

export type LoadState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: unknown }
  | { readonly status: 'loaded'; readonly data: T };

// Reads when the screen gains focus and on reload(). A read that finishes after a newer one
// started, or after the screen lost focus, is ignored. Earlier data stays visible while
// reloading, and a failed read is never shown as empty data.
export function useFocusLoad<T>(load: () => Promise<T>): {
  state: LoadState<T>;
  reload: () => void;
} {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const generation = useRef(0);

  const run = useCallback(() => {
    generation.current += 1;
    const wanted = generation.current;
    load().then(
      (data) => {
        if (wanted === generation.current) {
          setState({ status: 'loaded', data });
        }
      },
      (error: unknown) => {
        if (wanted === generation.current) {
          setState({ status: 'failed', error });
        }
      },
    );
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      run();
      return () => {
        generation.current += 1;
      };
    }, [run]),
  );

  return { state, reload: run };
}
