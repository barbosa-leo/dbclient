'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ReleaseNotes } from '@/components/updates/ReleaseNotes';
import { releases } from '@/components/updates/releases';
import { useUpdates } from '@/components/updates/UpdatesProvider';

export default function UpdatesPage() {
  const { loaded, unreadVersions, markAllSeen } = useUpdates();
  // Snapshot taken before marking as seen, so the unread highlight stays visible during this visit.
  const [unreadOnArrival, setUnreadOnArrival] = useState<string[] | null>(null);

  useEffect(() => {
    if (!loaded || unreadOnArrival !== null) return;
    setUnreadOnArrival(unreadVersions);
    markAllSeen().catch(() => undefined);
  }, [loaded, unreadOnArrival, unreadVersions, markAllSeen]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Novidades" description="O que mudou em cada versão do DBClient." badge="" />

      <div className="flex max-w-3xl flex-col gap-3">
        {releases.map((release, index) => (
          <ReleaseNotes
            key={release.version}
            release={release}
            latest={index === 0}
            unread={unreadOnArrival?.includes(release.version) ?? false}
          />
        ))}
      </div>
    </div>
  );
}
