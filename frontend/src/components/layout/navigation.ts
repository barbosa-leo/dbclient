import type { Role } from '@/services/auth';

export interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: 'SQL',
    items: [
      { href: '/explorer', label: 'Explorador' },
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
