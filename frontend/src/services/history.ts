import { apiRequest } from '@/services/api';

export type HistoryKind = 'query' | 'script';

export interface HistoryEntry {
  id: number;
  userEmail: string;
  kind: HistoryKind;
  connectionId: number;
  connectionName: string;
  database: string;
  sql?: string;
  fileName?: string;
  fileSize?: number;
  success: boolean;
  error?: string;
  durationMs: number;
  createdAt: string;
}

export function listHistory(kind: HistoryKind) {
  return apiRequest<HistoryEntry[]>(`/history?kind=${kind}`);
}

