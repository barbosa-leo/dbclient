'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { navItems } from '@/components/layout/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = navItems.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-brand-900 text-brand-50">
      <div className="px-6 py-5 text-lg font-semibold tracking-tight">DBClient</div>
      <nav className="flex flex-col gap-1 px-3">
        {items.map((item) => {
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
      </nav>
    </aside>
  );
}
