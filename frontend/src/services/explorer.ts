import { apiRequest } from '@/services/api';

export type TableKind = 'table' | 'view' | 'materialized_view';

export interface TableInfo {
  name: string;
  kind: TableKind;
}

export interface SchemaInfo {
  name: string;
  tables: TableInfo[];
}

export function listSchemas(connectionId: number) {
  return apiRequest<SchemaInfo[]>(`/connections/${connectionId}/schemas`);
}
