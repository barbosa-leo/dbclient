import type { Role } from '@/services/auth';

export interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
}

export const navItems: NavItem[] = [
  { href: '/connections', label: 'Conexões' },
  { href: '/explorer', label: 'Explorador' },
  { href: '/query', label: 'Editor SQL' },
  { href: '/scripts', label: 'Scripts' },
  { href: '/dumps', label: 'Dumps' },
  { href: '/users', label: 'Usuários', roles: ['admin'] },
];
