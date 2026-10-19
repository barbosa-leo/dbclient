'use client';

import { useSyncExternalStore } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';

function useMediaQuery(query: string, serverSnapshot: boolean): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverSnapshot,
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY, true);
}
