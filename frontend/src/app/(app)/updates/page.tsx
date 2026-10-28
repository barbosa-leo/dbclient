'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { DesktopUpdateNotice } from '@/components/updates/DesktopUpdateNotice';
import { ImageUpdateNotice } from '@/components/updates/ImageUpdateNotice';
import { ReleaseNotes } from '@/components/updates/ReleaseNotes';
import { appVersion } from '@/components/updates/releases';
import { useUpdates } from '@/components/updates/UpdatesProvider';

export default function UpdatesPage() {
  const { isLocal } = useAuth();
  const { loaded, releases, unreadVersions, isAvailableUpdate, markInstalledSeen } = useUpdates();
  const latestAvailable = releases.find((release) => isAvailableUpdate(release.version));
  // Snapshot taken before marking as seen, so the unread highlight stays visible during this visit.
  const [unreadOnArrival, setUnreadOnArrival] = useState<string[] | null>(null);

  useEffect(() => {
    if (!loaded) return;
    setUnreadOnArrival((current) => current ?? unreadVersions);
    markInstalledSeen().catch(() => undefined);
  }, [loaded, unreadVersions, markInstalledSeen]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Novidades"
        description={`O que mudou em cada versão do DBClient. Você está usando a v${appVersion}.`}
        badge=""
      />

      {latestAvailable &&
        (isLocal ? (
          <DesktopUpdateNotice latestVersion={latestAvailable.version} />
        ) : (
          <ImageUpdateNotice latestVersion={latestAvailable.version} />
        ))}

      <div className="flex max-w-3xl flex-col gap-3">
        {releases.map((release) => (
          <ReleaseNotes
            key={release.version}
            release={release}
            installed={release.version === appVersion}
            available={isAvailableUpdate(release.version)}
            unread={
              (unreadOnArrival?.includes(release.version) ?? false) || unreadVersions.includes(release.version)
            }
          />
        ))}
      </div>
    </div>
  );
}
