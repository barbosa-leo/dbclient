import { apiRequest } from '@/services/api';

export const MAX_SQL_LENGTH = 5000;
export const MIN_ROW_LIMIT = 10;
export const MAX_ROW_LIMIT = 10000;

export const ROW_LIMIT_PRESETS = [10, 25, 50, 100, 250, 500, 1000, 5000, 10000] as const;

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowsAffected: number | null;
  durationMs: number;
}

export function clampRowLimit(value: number): number {
  if (!Number.isFinite(value)) return MIN_ROW_LIMIT;
  return Math.min(MAX_ROW_LIMIT, Math.max(MIN_ROW_LIMIT, Math.round(value)));
}

export function calculateAutoRowLimit(topOffsetPx: number): number {
  if (typeof window === 'undefined') return MIN_ROW_LIMIT;
  const chromeBelowRowsPx = 116;
  const rowHeightPx = 25;
  const availablePx = window.innerHeight - topOffsetPx - chromeBelowRowsPx;
  return clampRowLimit(Math.floor(availablePx / rowHeightPx));
}

export interface ExecuteQueryOptions {
  saveHistory?: boolean;
}

export function executeQuery(
  connectionId: number,
  sql: string,
  limit: number,
  options?: ExecuteQueryOptions,
) {
  return apiRequest<QueryResult>(`/connections/${connectionId}/query`, {
    method: 'POST',
    body: JSON.stringify({
      sql,
      limit: clampRowLimit(limit),
      saveHistory: options?.saveHistory ?? false,
    }),
  });
}
