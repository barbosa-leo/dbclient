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
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-brand-300/45 bg-white/80 px-8 shadow-sm backdrop-blur-md">
      <ConnectionSelector />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 rounded-full border border-brand-300/50 bg-brand-50/60 px-3.5 py-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_8px_#477cd1]" />
          <span className="text-xs font-semibold text-brand-900">{user?.username}</span>
          <span className="rounded-full bg-brand-900 px-2 py-0.5 font-display text-[10px] font-semibold tracking-wider text-brand-50 uppercase">
            {user?.role}
          </span>
        </div>
        <Button variant="secondary" onClick={handleSignOut}>
          Sair
        </Button>
      </div>
    </header>
  );
}
