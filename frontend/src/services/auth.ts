import { apiRequest } from '@/services/api';

export type Role = 'admin' | 'operator';

export interface User {
  id: number;
  username: string;
  role: Role;
  mustChangePassword: boolean;
}

export function login(username: string, password: string) {
  return apiRequest<User>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
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
