'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { navSections } from '@/components/layout/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-brand-900 text-brand-50">
      <div className="px-6 py-5 text-lg font-semibold tracking-tight">DBClient</div>
      <nav className="flex flex-col gap-5 px-3">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.roles || (user && item.roles.includes(user.role)),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="flex flex-col gap-1">
              <span className="px-3 text-xs font-semibold uppercase tracking-wider text-brand-300">
                {section.title}
              </span>
              {visibleItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-md px-3 py-2 text-sm transition-colors ${
                      active ? 'bg-brand-500 text-white' : 'hover:bg-brand-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
