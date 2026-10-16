'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { ConnectionSelector } from '@/components/connections/ConnectionSelector';
import { useTheme } from '@/components/layout/ThemeProvider';

export function Topbar() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  const initial = user?.username?.slice(0, 1).toUpperCase() ?? 'U';

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-line bg-panel">
      <div className="flex h-full w-48 shrink-0 items-center gap-2.5 border-r border-line px-5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cta font-mono text-[11px] font-bold text-cta-fg">
          DB
        </span>
        <span className="text-sm font-semibold tracking-tight text-ink">DBClient</span>
      </div>

      <div className="flex flex-1 items-center justify-between gap-4 px-5">
        <ConnectionSelector />

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-muted hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
              className="h-[17px] w-[17px]"
            >
              <path
                d="M12 3a9 9 0 1 0 9 9c0-.94-.76-1.7-1.7-1.7H17a2 2 0 0 1-2-2V6.7C15 4.66 13.66 3 12 3Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8.5" cy="10.5" r="1" fill="currentColor" />
              <circle cx="10.5" cy="7.5" r="1" fill="currentColor" />
              <circle cx="7.5" cy="14" r="1" fill="currentColor" />
            </svg>
          </button>

          <div className="flex items-center gap-2 rounded-lg border border-line bg-subtle px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-online" />
            <span className="text-xs font-medium text-ink">{user?.username}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary uppercase">
              {user?.role}
            </span>
          </div>

          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-cta text-[11px] font-semibold text-cta-fg"
          >
            {initial}
          </span>

          <button
            type="button"
            onClick={handleSignOut}
            className="cursor-pointer rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-muted hover:text-ink"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
