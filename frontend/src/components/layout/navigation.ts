import { canWriteAnywhere } from '@/components/auth/access';
import type { User } from '@/services/auth';

export type NavIconName =
  | 'explorer'
  | 'query'
  | 'scripts'
  | 'dumps'
  | 'connections'
  | 'users'
  | 'settings'
  | 'updates';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  requires?: 'admin' | 'write';
  hiddenInLocalMode?: boolean;
  indicator?: 'unreadUpdates';
  kind?: 'link' | 'explorer';
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: 'SQL',
    items: [
      { href: '/explorer', label: 'Explorar', icon: 'explorer', kind: 'explorer' },
      { href: '/query', label: 'Editor SQL', icon: 'query' },
    ],
  },
  {
    title: 'Ferramentas',
    items: [
      { href: '/scripts', label: 'Scripts', icon: 'scripts', requires: 'write' },
      { href: '/dumps', label: 'Dumps', icon: 'dumps' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { href: '/connections', label: 'Conexões', icon: 'connections' },
      { href: '/users', label: 'Usuários', icon: 'users', requires: 'admin', hiddenInLocalMode: true },
      { href: '/settings', label: 'Configurações', icon: 'settings', requires: 'admin' },
      { href: '/updates', label: 'Novidades', icon: 'updates', indicator: 'unreadUpdates' },
    ],
  },
];

export function isNavItemAllowed(requires: NavItem['requires'], user: User | null): boolean {
  if (!requires) return true;
  if (requires === 'admin') return user?.role === 'admin';
  return canWriteAnywhere(user);
}
