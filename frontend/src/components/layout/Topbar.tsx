'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { ConnectionSelector } from '@/components/connections/ConnectionSelector';
import { Button } from '@/components/ui/Button';

export function Topbar() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-brand-300 bg-white px-6">
      <ConnectionSelector />
      <div className="flex items-center gap-4">
        <div className="text-right text-sm leading-tight">
          <p className="font-medium text-brand-900">{user?.username}</p>
          <p className="text-brand-700">{user?.role}</p>
        </div>
        <Button variant="primary" onClick={handleSignOut}>
          Sair
        </Button>
      </div>
    </header>
  );
}
