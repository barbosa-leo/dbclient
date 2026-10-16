import { apiRequest } from '@/services/api';

export const MAX_SQL_LENGTH = 5000;

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  hasMore: boolean;
  rowsAffected: number | null;
  durationMs: number;
}

export function executeQuery(connectionId: number, sql: string, page: number, pageSize: number) {
  return apiRequest<QueryResult>(`/connections/${connectionId}/query`, {
    method: 'POST',
    body: JSON.stringify({ sql, page, pageSize }),
  });
}
