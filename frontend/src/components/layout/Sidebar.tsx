'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { SidebarSchemas } from '@/components/layout/SidebarSchemas';
import { navSections } from '@/components/layout/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-brand-700/40 bg-gradient-to-b from-brand-900 via-brand-900 to-brand-700/95 text-brand-50 shadow-2xl">
      <div className="flex items-center gap-3 border-b border-brand-700/40 px-6 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 font-display text-xs font-bold tracking-wider text-white shadow-glow">
          DB
        </span>
        <div className="flex flex-col">
          <span className="font-display text-base font-bold tracking-tight text-white">
            DBClient
          </span>
          <span className="text-[10px] font-medium tracking-widest text-brand-300/70 uppercase">
            PostgreSQL Studio
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3.5 py-6">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.roles || (user && item.roles.includes(user.role)),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="flex flex-col gap-1.5">
              <span className="px-3 font-display text-[10px] font-medium tracking-[0.22em] text-brand-300/65 uppercase">
                {section.title}
              </span>
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) => {
                  if (item.kind === 'schemas') {
                    return (
                      <Suspense key={item.href} fallback={null}>
                        <SidebarSchemas />
                      </Suspense>
                    );
                  }

                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`group flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-r from-brand-500 to-brand-700/90 text-white shadow-glow'
                          : 'text-brand-50/75 hover:bg-brand-700/35 hover:text-white'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full transition-all ${
                          active
                            ? 'bg-white shadow-[0_0_8px_#ffffff]'
                            : 'bg-transparent group-hover:bg-brand-300/50'
                        }`}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
