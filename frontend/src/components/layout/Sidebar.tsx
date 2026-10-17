'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { SidebarExplorer } from '@/components/layout/SidebarExplorer';
import { navSections } from '@/components/layout/navigation';
import type { NavIconName } from '@/components/layout/navigation';

const MIN_EXPLORER_WIDTH_PCT = 20;
const MAX_EXPLORER_WIDTH_PCT = 35;

function clampExplorerWidthPct(value: number): number {
  return Math.min(MAX_EXPLORER_WIDTH_PCT, Math.max(MIN_EXPLORER_WIDTH_PCT, value));
}

function NavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case 'explorer':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'query':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m8 10 3 2.5L8 15" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 15h3" strokeLinecap="round" />
        </svg>
      );
    case 'scripts':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinejoin="round" />
          <path d="M14 3v5h5" strokeLinejoin="round" />
          <path d="M9 13h6M9 17h4" strokeLinecap="round" />
        </svg>
      );
    case 'dumps':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <path d="M12 3 4 7.5 12 12l8-4.5L12 3Z" strokeLinejoin="round" />
          <path d="M4 12.5 12 17l8-4.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 17 12 21.5 20 17" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'connections':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <rect x="3" y="4" width="18" height="6" rx="1.5" />
          <rect x="3" y="14" width="18" height="6" rx="1.5" />
          <circle cx="7" cy="7" r="1" fill="currentColor" />
          <circle cx="7" cy="17" r="1" fill="currentColor" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
          <circle cx="17" cy="9.5" r="2.5" />
          <path d="M16 14.8c2.2.3 4 1.8 4 4.2" strokeLinecap="round" />
        </svg>
      );
  }
}

function TooltipBadge({ label, category }: { label: string; category: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 flex -translate-y-1/2 translate-x-1 items-center gap-1.5 whitespace-nowrap rounded-lg bg-cta px-2.5 py-1.5 text-xs font-medium text-cta-fg opacity-0 shadow-card-hover transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
    >
      <span
        aria-hidden="true"
        className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-cta"
      />
      <span className="relative">{label}</span>
      <span className="relative rounded bg-cta-fg/15 px-1.5 py-0.2 text-[9px] font-semibold tracking-wider text-cta-fg/80 uppercase">
        {category}
      </span>
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [explorerDrawerOpen, setExplorerDrawerOpen] = useState(true);
  const [explorerWidthPct, setExplorerWidthPct] = useState(MIN_EXPLORER_WIDTH_PCT);
  const [resizing, setResizing] = useState(false);
  const explorerPaneRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!resizing) return;

    function handleMouseMove(event: MouseEvent) {
      const pane = explorerPaneRef.current;
      if (!pane || window.innerWidth <= 0) return;
      const paneLeft = pane.getBoundingClientRect().left;
      const nextWidthPx = event.clientX - paneLeft;
      const nextPct = (nextWidthPx / window.innerWidth) * 100;
      setExplorerWidthPct(clampExplorerWidthPct(nextPct));
    }

    function handleMouseUp() {
      setResizing(false);
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  function startResize(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    setResizing(true);
  }

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.roles || (user && item.roles.includes(user.role)),
      ),
    }))
    .filter((section) => section.items.length > 0);

  const showSecondaryExplorerBar = explorerDrawerOpen && pathname.startsWith('/explorer');

  return (
    <div className="flex shrink-0">
      <aside className="relative z-30 flex w-14 shrink-0 flex-col items-center border-r border-line bg-panel py-4">
        <nav className="flex flex-1 flex-col items-center gap-2">
          {visibleSections.map((section, sectionIndex) => (
            <div key={section.title} className="flex flex-col items-center gap-1.5">
              {sectionIndex > 0 && (
                <span
                  aria-hidden="true"
                  className="py-1 font-mono text-xs tracking-widest text-ink-muted select-none"
                >
                  ...
                </span>
              )}

              <div className="flex flex-col items-center gap-1">
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.href);

                  if (item.kind === 'explorer') {
                    return (
                      <button
                        key={item.href}
                        type="button"
                        aria-label={item.label}
                        onClick={() => {
                          if (pathname.startsWith('/explorer')) {
                            setExplorerDrawerOpen((prev) => !prev);
                          } else {
                            setExplorerDrawerOpen(true);
                            router.push('/explorer');
                          }
                        }}
                        className={`group relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                          active
                            ? 'bg-muted text-ink'
                            : 'text-ink-muted hover:bg-muted/70 hover:text-ink'
                        }`}
                      >
                        <NavIcon name={item.icon} />
                        <TooltipBadge label={item.label} category={section.title} />
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                        active
                          ? 'bg-muted text-ink'
                          : 'text-ink-muted hover:bg-muted/70 hover:text-ink'
                      }`}
                    >
                      <NavIcon name={item.icon} />
                      <TooltipBadge label={item.label} category={section.title} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {showSecondaryExplorerBar && (
        <aside
          ref={explorerPaneRef}
          style={{
            width: `${explorerWidthPct}vw`,
            minWidth: `${MIN_EXPLORER_WIDTH_PCT}vw`,
            maxWidth: `${MAX_EXPLORER_WIDTH_PCT}vw`,
          }}
          className="relative flex shrink-0 flex-col border-r border-line bg-panel px-3 py-4"
        >
          <div className="mb-3 flex items-center justify-between px-2">
            <span className="text-xs font-semibold tracking-tight text-ink">Explorar</span>
            <button
              type="button"
              aria-label="Ocultar painel explorar"
              onClick={() => setExplorerDrawerOpen(false)}
              className="cursor-pointer rounded-md p-1 text-ink-muted transition-colors hover:bg-muted hover:text-ink"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-3.5 w-3.5">
                <path d="M10 4 6 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Suspense fallback={null}>
              <SidebarExplorer />
            </Suspense>
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar painel explorar"
            aria-valuemin={MIN_EXPLORER_WIDTH_PCT}
            aria-valuemax={MAX_EXPLORER_WIDTH_PCT}
            aria-valuenow={Math.round(explorerWidthPct)}
            onMouseDown={startResize}
            className={`absolute top-0 -right-1 z-20 h-full w-2 cursor-col-resize transition-colors hover:bg-line-strong/60 ${
              resizing ? 'bg-line-strong' : ''
            }`}
          />
        </aside>
      )}
    </div>
  );
}
