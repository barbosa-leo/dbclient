import { apiRequest } from '@/services/api';

export type TableKind = 'table' | 'view' | 'materialized_view';

export type SchemaCategoryKey = 'tables' | 'views' | 'procedures' | 'functions' | 'triggers';

export interface SchemaCategory {
  key: SchemaCategoryKey;
  label: string;
}

export const SCHEMA_CATEGORIES: readonly SchemaCategory[] = [
  { key: 'tables', label: 'tables' },
  { key: 'views', label: 'views' },
  { key: 'procedures', label: 'procedures' },
  { key: 'functions', label: 'functions' },
  { key: 'triggers', label: 'triggers' },
];

export interface TableInfo {
  name: string;
  kind: TableKind;
}

export interface SchemaObjectItem {
  name: string;
  kind?: TableKind;
}

export interface SchemaInfo {
  name: string;
  tables: TableInfo[];
  views?: TableInfo[];
  procedures?: string[];
  functions?: string[];
  triggers?: string[];
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export function getSchemaCategoryItems(
  schema: SchemaInfo,
  category: SchemaCategoryKey,
): SchemaObjectItem[] {
  switch (category) {
    case 'tables':
      return schema.tables
        .filter((item) => item.kind === 'table')
        .map((item) => ({ name: item.name, kind: item.kind }));
    case 'views': {
      const viewList =
        schema.views ??
        schema.tables.filter(
          (item) => item.kind === 'view' || item.kind === 'materialized_view',
        );
      return viewList.map((item) => ({ name: item.name, kind: item.kind }));
    }
    case 'procedures':
      return (schema.procedures ?? []).map((name) => ({ name }));
    case 'functions':
      return (schema.functions ?? []).map((name) => ({ name }));
    case 'triggers':
      return (schema.triggers ?? []).map((name) => ({ name }));
  }
}

export function listSchemas(connectionId: number) {
  return apiRequest<SchemaInfo[]>(`/connections/${connectionId}/schemas`);
}

export function listColumns(
  connectionId: number,
  schema: string,
  table: string,
) {
  const s = encodeURIComponent(schema);
  const t = encodeURIComponent(table);
  return apiRequest<ColumnInfo[]>(
    `/connections/${connectionId}/schemas/${s}/tables/${t}/columns`,
  );
}
