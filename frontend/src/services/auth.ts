import { ApiError, apiRequest } from '@/services/api';

export type Role = 'admin' | 'operator' | 'viewer';

export type AuthMode = 'session' | 'local';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  environmentIds?: number[];
}

export function login(email: string, password: string) {
  return apiRequest<User>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
}

export function fetchCurrentUser() {
  return apiRequest<User>('/auth/me');
}

// Only desktop builds expose /app-config; the web server answers 404 and keeps the session flow.
export async function fetchAuthMode(): Promise<AuthMode> {
  try {
    const config = await apiRequest<{ authMode: AuthMode }>('/app-config');
    return config.authMode === 'local' ? 'local' : 'session';
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return 'session';
    throw err;
  }
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<void>('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
