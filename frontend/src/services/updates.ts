import { apiRequest } from '@/services/api';

export async function listSeenUpdates() {
  const { versions } = await apiRequest<{ versions: string[] }>('/updates/seen');
  return versions;
}

export function markUpdatesSeen(versions: string[]) {
  return apiRequest<void>('/updates/seen', {
    method: 'POST',
    body: JSON.stringify({ versions }),
  });
}
