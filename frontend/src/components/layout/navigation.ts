import type { Role } from '@/services/auth';

export interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
  kind?: 'link' | 'schemas';
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: 'SQL',
    items: [
      { href: '/schemas', label: 'Schemas', kind: 'schemas' },
      { href: '/query', label: 'Editor SQL' },
    ],
  },
  {
    title: 'Ferramentas',
    items: [
      { href: '/scripts', label: 'Scripts' },
      { href: '/dumps', label: 'Dumps' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { href: '/connections', label: 'Conexões' },
      { href: '/users', label: 'Usuários', roles: ['admin'] },
    ],
  },
];
