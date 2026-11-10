import type { AccessLevel, Role, User } from '@/services/auth';

export const accessLevelLabels: Record<AccessLevel, string> = {
  read: 'Leitura',
  write: 'Leitura e escrita',
};

export const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  member: 'Membro',
};

export function accessLevelFor(user: User | null, environmentId: number | undefined): AccessLevel | null {
  if (!user || environmentId === undefined) return null;
  if (user.role === 'admin') return 'write';
  return user.environments?.find((access) => access.environmentId === environmentId)?.level ?? null;
}

export function canWriteAnywhere(user: User | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.environments?.some((access) => access.level === 'write') ?? false;
}
