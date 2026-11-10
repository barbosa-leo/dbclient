import { useAuth } from '@/components/auth/AuthProvider';
import { accessLevelFor } from '@/components/auth/access';
import { useConnections } from '@/components/connections/ConnectionsProvider';

export function useActiveAccess() {
  const { user } = useAuth();
  const { active } = useConnections();
  const level = accessLevelFor(user, active?.environmentId);
  return { level, canWrite: level === 'write', readOnly: level === 'read' };
}
