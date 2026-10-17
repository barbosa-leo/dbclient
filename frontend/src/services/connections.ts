import { apiRequest } from '@/services/api';

export const sslModes = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'] as const;

export type SslMode = (typeof sslModes)[number];

export interface Environment {
  id: number;
  name: string;
}

export interface Connection {
  id: number;
  environmentId: number;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  sslMode: SslMode;
}

export interface ConnectionInput {
  environmentId: number;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  sslMode: SslMode;
}

export function listEnvironments() {
  return apiRequest<Environment[]>('/environments');
}

export function createEnvironment(name: string) {
  return apiRequest<Environment>('/environments', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function deleteEnvironment(id: number) {
  return apiRequest<void>(`/environments/${id}`, { method: 'DELETE' });
}

export function listConnections(environmentId?: number) {
  const query = environmentId ? `?environmentId=${environmentId}` : '';
  return apiRequest<Connection[]>(`/connections${query}`);
}

export function createConnection(input: ConnectionInput) {
  return apiRequest<Connection>('/connections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateConnection(id: number, input: ConnectionInput) {
  return apiRequest<Connection>(`/connections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteConnection(id: number) {
  return apiRequest<void>(`/connections/${id}`, { method: 'DELETE' });
}
