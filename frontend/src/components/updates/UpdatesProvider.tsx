'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { releases } from '@/components/updates/releases';
import { listSeenUpdates, markUpdatesSeen } from '@/services/updates';

interface UpdatesContextValue {
  loaded: boolean;
  unreadVersions: string[];
  markAllSeen: () => Promise<void>;
}

const UpdatesContext = createContext<UpdatesContextValue | null>(null);

export function UpdatesProvider({ children }: { children: ReactNode }) {
  const [seenVersions, setSeenVersions] = useState<string[] | null>(null);

  useEffect(() => {
    listSeenUpdates()
      .then(setSeenVersions)
      // Without the seen list we cannot tell what is new, so nothing is flagged rather than everything.
      .catch(() => setSeenVersions(releases.map((release) => release.version)));
  }, []);

  const unreadVersions = useMemo(
    () =>
      seenVersions === null
        ? []
        : releases.map((release) => release.version).filter((version) => !seenVersions.includes(version)),
    [seenVersions],
  );

  const markAllSeen = useCallback(async () => {
    if (unreadVersions.length === 0) return;
    await markUpdatesSeen(unreadVersions);
    setSeenVersions((current) => [...(current ?? []), ...unreadVersions]);
  }, [unreadVersions]);

  const value = useMemo(
    () => ({ loaded: seenVersions !== null, unreadVersions, markAllSeen }),
    [seenVersions, unreadVersions, markAllSeen],
  );

  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

export function useUpdates() {
  const context = useContext(UpdatesContext);
  if (!context) throw new Error('useUpdates must be used within UpdatesProvider');
  return context;
}
