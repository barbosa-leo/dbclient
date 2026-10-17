'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { ConnectionsProvider, useConnections } from '@/components/connections/ConnectionsProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

function AppWorkspace({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { environments, loading, contextRevision } = useConnections();

  useEffect(() => {
    if (!loading && environments.length === 0 && pathname !== '/connections') {
      router.replace('/connections');
    }
  }, [loading, environments.length, pathname, router]);

  return (
    <div key={contextRevision} className="flex h-screen flex-col overflow-hidden bg-canvas">
      <Topbar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;
  if (user.mustChangePassword) return <ChangePasswordForm />;

  return (
    <ConnectionsProvider>
      <AppWorkspace>{children}</AppWorkspace>
    </ConnectionsProvider>
  );
}

