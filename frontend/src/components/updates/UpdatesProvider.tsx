'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { appVersion, compareVersions, mergeReleases, releases as bundledReleases } from '@/components/updates/releases';
import type { Release } from '@/components/updates/releases';
import { listGitHubReleases } from '@/services/githubReleases';
import { listSeenUpdates, markUpdatesSeen } from '@/services/updates';

interface UpdatesContextValue {
  loaded: boolean;
  releases: Release[];
  unreadVersions: string[];
  isAvailableUpdate: (version: string) => boolean;
  markInstalledSeen: () => Promise<void>;
}

const UpdatesContext = createContext<UpdatesContextValue | null>(null);

function isAvailableUpdate(version: string) {
  return compareVersions(version, appVersion) > 0;
}

export function UpdatesProvider({ children }: { children: ReactNode }) {
  const [seenVersions, setSeenVersions] = useState<string[] | null>(null);
  const [releases, setReleases] = useState<Release[]>(bundledReleases);

  useEffect(() => {
    listSeenUpdates()
      .then(setSeenVersions)
      // Without the seen list we cannot tell what is new, so nothing is flagged rather than everything.
      .catch(() => setSeenVersions(bundledReleases.map((release) => release.version)));

    // Offline or rate-limited installs keep working with the notes bundled in the build.
    listGitHubReleases()
      .then((remote) => setReleases(mergeReleases(bundledReleases, remote)))
      .catch(() => undefined);
  }, []);

  // Versions newer than the running build stay unread until the user updates; seeing them does not count.
  const unreadVersions = useMemo(
    () =>
      seenVersions === null
        ? []
        : releases
            .map((release) => release.version)
            .filter((version) => isAvailableUpdate(version) || !seenVersions.includes(version)),
    [releases, seenVersions],
  );

  const markInstalledSeen = useCallback(async () => {
    const versions = unreadVersions.filter((version) => !isAvailableUpdate(version));
    if (versions.length === 0) return;
    await markUpdatesSeen(versions);
    setSeenVersions((current) => [...(current ?? []), ...versions]);
  }, [unreadVersions]);

  const value = useMemo(
    () => ({ loaded: seenVersions !== null, releases, unreadVersions, isAvailableUpdate, markInstalledSeen }),
    [seenVersions, releases, unreadVersions, markInstalledSeen],
  );

  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

export function useUpdates() {
  const context = useContext(UpdatesContext);
  if (!context) throw new Error('useUpdates must be used within UpdatesProvider');
  return context;
}
