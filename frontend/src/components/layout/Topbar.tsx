'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { ConnectionSelector } from '@/components/connections/ConnectionSelector';
import { useTheme } from '@/components/layout/ThemeProvider';
import { UnreadDot } from '@/components/updates/UnreadDot';
import { useUpdates } from '@/components/updates/UpdatesProvider';

interface TopbarProps {
  onOpenMenu: () => void;
}

export function Topbar({ onOpenMenu }: TopbarProps) {
  const { user, isLocal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadVersions } = useUpdates();

  const initial = user?.name?.slice(0, 1).toUpperCase() ?? 'U';

  return (
    <header className="sticky top-0 z-20 flex shrink-0 flex-wrap items-center border-b border-line bg-panel lg:h-14 lg:flex-nowrap">
      <div className="flex h-12 flex-1 items-center gap-2 px-3 lg:h-full lg:w-48 lg:flex-none lg:shrink-0 lg:gap-2.5 lg:border-r lg:border-line lg:px-5">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-muted hover:text-ink lg:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="h-5 w-5">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
          {unreadVersions.length > 0 && <UnreadDot className="absolute top-2 right-2" />}
        </button>
        <img
          src="/logo.png"
          alt="DBClient logo"
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-md object-contain"
        />
        <span className="text-sm font-semibold tracking-tight text-ink">DBClient</span>
      </div>

      <div className="order-last flex basis-full items-center border-t border-line px-3 py-2 lg:order-none lg:basis-auto lg:flex-1 lg:border-t-0 lg:px-5 lg:py-0">
        <ConnectionSelector />
      </div>

      <div className="flex h-12 items-center gap-2.5 px-3 lg:h-full lg:px-5">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-muted hover:text-ink lg:h-8 lg:w-8"
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

        <div
          title={user?.email}
          className="hidden items-center gap-2 rounded-lg border border-line bg-subtle px-2.5 py-1 lg:flex"
        >
          <span className="h-2 w-2 rounded-full bg-online" />
          <span className="text-xs font-medium text-ink">{user?.name}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary uppercase">
            {isLocal ? 'local' : user?.role}
          </span>
        </div>

        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-cta text-[11px] font-semibold text-cta-fg"
        >
          {initial}
        </span>
      </div>
    </header>
  );
}
