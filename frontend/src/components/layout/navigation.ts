import type { Role } from '@/services/auth';

export type NavIconName = 'explorer' | 'query' | 'scripts' | 'dumps' | 'connections' | 'users';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  roles?: Role[];
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
      { href: '/scripts', label: 'Scripts', icon: 'scripts' },
      { href: '/dumps', label: 'Dumps', icon: 'dumps' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { href: '/connections', label: 'Conexões', icon: 'connections' },
      { href: '/users', label: 'Usuários', icon: 'users', roles: ['admin'] },
    ],
  },
];
