'use client';

import Link from 'next/link';
import { Suspense, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { NavIcon } from '@/components/layout/NavIcon';
import { SidebarExplorer } from '@/components/layout/SidebarExplorer';
import type { NavSection } from '@/components/layout/navigation';

interface MobileNavDrawerProps {
  open: boolean;
  sections: NavSection[];
  pathname: string;
  onClose: () => void;
  onSignOut: () => void;
}

export function MobileNavDrawer({
  open,
  sections,
  pathname,
  onClose,
  onSignOut,
}: MobileNavDrawerProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  function closeOnLinkClick(event: ReactMouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('a')) onClose();
  }

  const showExplorer = pathname.startsWith('/explorer');

  return (
    <div
      className={`fixed inset-0 z-40 lg:hidden ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        className={`absolute inset-y-0 left-0 flex w-[85vw] max-w-sm flex-col border-r border-line bg-panel shadow-card-hover transition-transform duration-200 motion-reduce:transition-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <span className="text-sm font-semibold tracking-tight text-ink">DBClient</span>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onClose}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-muted hover:text-ink"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-4 w-4">
              <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3" onClick={closeOnLinkClick}>
          <nav className="flex flex-col gap-4">
            {sections.map((section) => (
              <div key={section.title} className="flex flex-col gap-1">
                <span className="px-2 text-[10px] font-semibold tracking-wider text-ink-muted uppercase">
                  {section.title}
                </span>
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-muted text-ink'
                          : 'text-ink-secondary hover:bg-muted/70 hover:text-ink'
                      }`}
                    >
                      <NavIcon name={item.icon} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {showExplorer && (
            <div className="mt-4 border-t border-line pt-4">
              <span className="mb-2 block px-2 text-[10px] font-semibold tracking-wider text-ink-muted uppercase">
                Explorar
              </span>
              <Suspense fallback={null}>
                <SidebarExplorer />
              </Suspense>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-line p-3">
          <button
            type="button"
            onClick={onSignOut}
            className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-secondary transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
              <path
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Sair
          </button>
        </div>
      </aside>
    </div>
  );
}
