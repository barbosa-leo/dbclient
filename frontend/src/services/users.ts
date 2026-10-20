import { apiRequest } from '@/services/api';
import type { Role, User } from '@/services/auth';

export interface UserCreateInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  environmentIds?: number[];
}

export interface UserUpdateInput {
  name: string;
  email: string;
  role: Role;
  password?: string;
  environmentIds?: number[];
}

export function listUsers() {
  return apiRequest<User[]>('/users');
}

export function createUser(input: UserCreateInput) {
  return apiRequest<User>('/users', { method: 'POST', body: JSON.stringify(input) });
}

export function updateUser(id: number, input: UserUpdateInput) {
  return apiRequest<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteUser(id: number) {
  return apiRequest<void>(`/users/${id}`, { method: 'DELETE' });
}
