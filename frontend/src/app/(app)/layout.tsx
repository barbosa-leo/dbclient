'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { LocalSessionEnded } from '@/components/auth/LocalSessionEnded';
import { ConnectionsProvider, useConnections } from '@/components/connections/ConnectionsProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

function AppWorkspace({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLocal } = useAuth();
  const { environments, loading, contextRevision } = useConnections();

  useEffect(() => {
    if (loading) return;

    if (environments.length === 0) {
      const canManageUsers = user?.role === 'admin' && !isLocal;
      const isAllowed = pathname.startsWith('/connections') || (canManageUsers && pathname.startsWith('/users'));
      if (!isAllowed) {
        router.replace('/connections');
      }
    }
  }, [loading, environments.length, pathname, router, user?.role, isLocal]);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <div key={contextRevision} className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <Topbar onOpenMenu={() => setMobileNavOpen(true)} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileNavOpen} onMobileClose={closeMobileNav} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col p-3 sm:p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading, isLocal } = useAuth();

  useEffect(() => {
    if (!loading && !user && !isLocal) router.replace('/login');
  }, [loading, user, isLocal, router]);

  if (loading) return null;
  if (!user) return isLocal ? <LocalSessionEnded /> : null;
  if (user.mustChangePassword) return <ChangePasswordForm />;

  return (
    <ConnectionsProvider>
      <AppWorkspace>{children}</AppWorkspace>
    </ConnectionsProvider>
  );
}

