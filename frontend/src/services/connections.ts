import { apiRequest } from '@/services/api';

export const sslModes = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'] as const;

export type SslMode = (typeof sslModes)[number];

export interface Connection {
  id: number;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  sslMode: SslMode;
}

export interface ConnectionInput {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  sslMode: SslMode;
}

export function listConnections() {
  return apiRequest<Connection[]>('/connections');
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
