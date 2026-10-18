import { apiRequest } from '@/services/api';

export type Role = 'admin' | 'operator' | 'viewer';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
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

export function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<void>('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
