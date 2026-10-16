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

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export function listSchemas(connectionId: number) {
  return apiRequest<SchemaInfo[]>(`/connections/${connectionId}/schemas`);
}

export function listColumns(connectionId: number, schema: string, table: string) {
  const s = encodeURIComponent(schema);
  const t = encodeURIComponent(table);
  return apiRequest<ColumnInfo[]>(`/connections/${connectionId}/schemas/${s}/tables/${t}/columns`);
}
