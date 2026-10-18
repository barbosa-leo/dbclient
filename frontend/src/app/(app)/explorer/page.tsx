'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { testConnectionById } from '@/services/connections';
import { ObjectDefinitionEditor } from '@/components/explorer/ObjectDefinitionEditor';
import { TableStructure } from '@/components/explorer/TableStructure';
import type { TableStructureChanges } from '@/components/explorer/TableStructure';
import { PageHeader } from '@/components/layout/PageHeader';
import { ResultTable } from '@/components/query/ResultTable';
import type { CellUpdate, ColumnSort } from '@/components/query/ResultTable';
import { RowLimitSelector } from '@/components/query/RowLimitSelector';
import {
  dropObject,
  getObjectDefinition,
  getTableStructure,
  listColumns,
  notifyExplorerRefresh,
} from '@/services/explorer';
import type {
  ColumnInfo,
  EditableObjectCategory,
  ForeignKeyInfo,
  IndexInfo,
  SchemaCategoryKey,
  TableKind,
  TableStructureInfo,
} from '@/services/explorer';
import {
  MIN_ROW_LIMIT,
  calculateAutoRowLimit,
  clampRowLimit,
  executeQuery,
} from '@/services/query';
import type { QueryResult } from '@/services/query';

type Tab = 'data' | 'structure' | 'definition';

const kindLabels: Record<TableKind, string> = {
  table: 'Tabela',
  view: 'View',
  materialized_view: 'View materializada',
};

const routineCategoryLabels: Record<Exclude<EditableObjectCategory, 'views'>, string> = {
  procedures: 'Procedure',
  functions: 'Function',
  triggers: 'Trigger',
};

const categoryCreateLabels: Record<SchemaCategoryKey, string> = {
  tables: 'Nova Tabela',
  views: 'Nova View',
  procedures: 'Nova Procedure',
  functions: 'Nova Function',
  triggers: 'Nova Trigger',
};

function isRoutineCategory(
  category: string | null,
): category is Exclude<EditableObjectCategory, 'views'> {
  return category === 'procedures' || category === 'functions' || category === 'triggers';
}

function isValidCategory(category: string | null): category is SchemaCategoryKey {
  return (
    category === 'tables' ||
    category === 'views' ||
    category === 'procedures' ||
    category === 'functions' ||
    category === 'triggers'
  );
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'object') {
    return `'${escapeSqlLiteral(JSON.stringify(value))}'`;
  }
  return `'${escapeSqlLiteral(String(value))}'`;
}

function buildNewObjectTemplate(schema: string, category: SchemaCategoryKey): string {
  const s = quoteIdentifier(schema);
  switch (category) {
    case 'tables':
      return `CREATE TABLE ${s}."nova_tabela" (\n  "id" BIGSERIAL PRIMARY KEY,\n  "nome" VARCHAR(255) NOT NULL,\n  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);`;
    case 'views':
      return `CREATE OR REPLACE VIEW ${s}."nova_view" AS\nSELECT 1 AS "id";`;
    case 'procedures':
      return `CREATE OR REPLACE PROCEDURE ${s}."nova_procedure"()\nLANGUAGE plpgsql\nAS $$\nBEGIN\n  \nEND;\n$$;`;
    case 'functions':
      return `CREATE OR REPLACE FUNCTION ${s}."nova_function"()\nRETURNS void\nLANGUAGE plpgsql\nAS $$\nBEGIN\n  \nEND;\n$$;`;
    case 'triggers':
      return `CREATE OR REPLACE TRIGGER "nova_trigger"\nBEFORE INSERT OR UPDATE ON ${s}."nome_da_tabela"\nFOR EACH ROW\nEXECUTE FUNCTION ${s}."nome_da_function"();`;
  }
}

function extractCreatedObjectName(sql: string, category: SchemaCategoryKey): string | null {
  switch (category) {
    case 'tables': {
      const m = sql.match(
        /CREATE\s+(?:UNLOGGED\s+|TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"[^"]+"\s*\.\s*|[a-zA-Z0-9_$]+\s*\.\s*)?(?:"([^"]+)"|([a-zA-Z0-9_$]+))/i,
      );
      return m?.[1] ?? m?.[2] ?? null;
    }
    case 'views': {
      const m = sql.match(
        /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"[^"]+"\s*\.\s*|[a-zA-Z0-9_$]+\s*\.\s*)?(?:"([^"]+)"|([a-zA-Z0-9_$]+))/i,
      );
      return m?.[1] ?? m?.[2] ?? null;
    }
    case 'procedures': {
      const m = sql.match(
        /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+(?:"[^"]+"\s*\.\s*|[a-zA-Z0-9_$]+\s*\.\s*)?(?:"([^"]+)"|([a-zA-Z0-9_$(]+))/i,
      );
      return m?.[1] ?? m?.[2] ?? null;
    }
    case 'functions': {
      const m = sql.match(
        /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"[^"]+"\s*\.\s*|[a-zA-Z0-9_$]+\s*\.\s*)?(?:"([^"]+)"|([a-zA-Z0-9_$(]+))/i,
      );
      return m?.[1] ?? m?.[2] ?? null;
    }
    case 'triggers': {
      const m = sql.match(
        /CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+(?:"([^"]+)"|([a-zA-Z0-9_$]+))/i,
      );
      return m?.[1] ?? m?.[2] ?? null;
    }
  }
}

function buildUpdateStatement(
  schema: string,
  table: string,
  resultColumns: string[],
  primaryKeyColumns: string[],
  update: CellUpdate,
): string {
  const tableRef = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const setClauses = Object.entries(update.changes).map(
    ([col, val]) => `${quoteIdentifier(col)} = ${formatSqlValue(val)}`,
  );

  const matchColumns =
    primaryKeyColumns.length > 0
      ? primaryKeyColumns.filter((pk) => resultColumns.includes(pk))
      : resultColumns;

  const whereColumns = matchColumns.length > 0 ? matchColumns : resultColumns;
  const whereClauses = whereColumns.map((col) => {
    const colIdx = resultColumns.indexOf(col);
    const originalVal = colIdx >= 0 ? update.originalRow[colIdx] : null;
    if (originalVal === null || originalVal === undefined) {
      return `${quoteIdentifier(col)} IS NULL`;
    }
    return `${quoteIdentifier(col)} = ${formatSqlValue(originalVal)}`;
  });

  return `UPDATE ${tableRef} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
}

function buildAlterTableStatements(
  schema: string,
  table: string,
  currentColumns: ColumnInfo[],
  changes: TableStructureChanges,
): string[] {
  const tableRef = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const statements: string[] = [];
  const { updates, added, deleted } = changes;
  const deletedSet = new Set(deleted);

  for (const colName of deleted) {
    statements.push(`ALTER TABLE ${tableRef} DROP COLUMN ${quoteIdentifier(colName)}`);
  }

  for (const col of added) {
    let stmt = `ALTER TABLE ${tableRef} ADD COLUMN ${quoteIdentifier(col.name)} ${col.dataType}`;
    if (!col.nullable) {
      stmt += ' NOT NULL';
    }
    if (col.defaultValue !== null) {
      stmt += ` DEFAULT ${col.defaultValue}`;
    }
    statements.push(stmt);
  }

  for (const { original, updated } of updates) {
    if (deletedSet.has(original.name)) continue;
    let colName = original.name;

    if (updated.name !== original.name) {
      statements.push(
        `ALTER TABLE ${tableRef} RENAME COLUMN ${quoteIdentifier(original.name)} TO ${quoteIdentifier(updated.name)}`,
      );
      colName = updated.name;
    }

    const colIdent = quoteIdentifier(colName);

    if (updated.dataType !== original.dataType) {
      statements.push(`ALTER TABLE ${tableRef} ALTER COLUMN ${colIdent} TYPE ${updated.dataType}`);
    }

    if (updated.nullable !== original.nullable) {
      statements.push(
        `ALTER TABLE ${tableRef} ALTER COLUMN ${colIdent} ${updated.nullable ? 'DROP NOT NULL' : 'SET NOT NULL'}`,
      );
    }

    if (updated.defaultValue !== original.defaultValue) {
      if (updated.defaultValue === null) {
        statements.push(`ALTER TABLE ${tableRef} ALTER COLUMN ${colIdent} DROP DEFAULT`);
      } else {
        statements.push(
          `ALTER TABLE ${tableRef} ALTER COLUMN ${colIdent} SET DEFAULT ${updated.defaultValue}`,
        );
      }
    }
  }

  const pkChangedInUpdates = updates.some(
    (u) => !deletedSet.has(u.original.name) && u.original.isPrimaryKey !== u.updated.isPrimaryKey,
  );
  const pkAdded = added.some((c) => c.isPrimaryKey);
  const pkDeleted = currentColumns.some((c) => deletedSet.has(c.name) && c.isPrimaryKey);

  if (pkChangedInUpdates || pkAdded || pkDeleted) {
    const updateByOrigName = new Map(updates.map((u) => [u.original.name, u.updated]));
    const remainingCols = currentColumns
      .filter((c) => !deletedSet.has(c.name))
      .map((c) => updateByOrigName.get(c.name) ?? c);
    const allFinalCols = [...remainingCols, ...added];
    const nextPkCols = allFinalCols
      .filter((c) => c.isPrimaryKey)
      .map((c) => quoteIdentifier(c.name));
    const constraintIdent = quoteIdentifier(`${table}_pkey`);
    statements.push(`ALTER TABLE ${tableRef} DROP CONSTRAINT IF EXISTS ${constraintIdent}`);
    if (nextPkCols.length > 0) {
      statements.push(`ALTER TABLE ${tableRef} ADD PRIMARY KEY (${nextPkCols.join(', ')})`);
    }
  }

  return statements;
}

function buildTableQuery(
  schema: string,
  table: string,
  filters: Record<string, string>,
  sort: ColumnSort | null,
): string {
  const tableRef = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const conditions = Object.entries(filters)
    .map(([col, val]) => [col, val.trim()] as const)
    .filter(([, val]) => val.length > 0)
    .map(
      ([col, val]) =>
        `CAST(${tableRef}.${quoteIdentifier(col)} AS TEXT) ILIKE '%${escapeSqlLiteral(val)}%'`,
    );

  let sql = `SELECT * FROM ${tableRef}`;
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  if (sort) {
    sql += ` ORDER BY ${tableRef}.${quoteIdentifier(sort.column)} ${sort.direction.toUpperCase()}`;
  }
  return sql;
}

function ExplorerContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { active } = useConnections();
  const activeId = active?.id;
  const database = active?.database ?? null;
  const canEdit = user?.role === 'admin' || user?.role === 'operator';

  const schema = searchParams.get('schema');
  const categoryRaw = searchParams.get('category');
  const categoryParam = isValidCategory(categoryRaw) ? categoryRaw : null;
  const table = searchParams.get('table');
  const item = searchParams.get('item');
  const kindParam = searchParams.get('kind') as TableKind | null;
  const isCreating =
    canEdit && searchParams.get('create') === '1' && Boolean(schema) && categoryParam !== null;

  const isRoutine = !isCreating && isRoutineCategory(categoryParam) && Boolean(item);
  const isView =
    !isCreating &&
    (categoryParam === 'views' || kindParam === 'view' || kindParam === 'materialized_view');

  const tabParam = searchParams.get('tab');
  const tab: Tab =
    isCreating || isRoutine
      ? 'definition'
      : isView
        ? tabParam === 'data'
          ? 'data'
          : tabParam === 'structure'
            ? 'structure'
            : 'definition'
        : tabParam === 'structure'
          ? 'structure'
          : 'data';

  const objectName = isCreating
    ? categoryCreateLabels[categoryParam]
    : isRoutine
      ? item
      : table;
  const kindLabel = isCreating
    ? 'Novo objeto'
    : isRoutine
      ? routineCategoryLabels[categoryParam]
      : (kindParam && kindLabels[kindParam]) ?? (isView ? 'View' : 'Tabela');

  const deleteCategory: SchemaCategoryKey = isRoutine
    ? categoryParam
    : isView
      ? 'views'
      : 'tables';

  const [autoLimit, setAutoLimit] = useState(MIN_ROW_LIMIT);
  const [limit, setLimit] = useState(MIN_ROW_LIMIT);
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dataResult, setDataResult] = useState<QueryResult | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[] | null>(null);
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyInfo[]>([]);
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [objectDefinition, setObjectDefinition] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingObject, setDeletingObject] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connTestLoading, setConnTestLoading] = useState(false);
  const [connTestResult, setConnTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const tableAnchorRef = useRef<HTMLDivElement>(null);

  const checkConnection = useCallback(async () => {
    if (activeId === undefined) return;
    setConnTestLoading(true);
    try {
      const res = await testConnectionById(activeId);
      setConnTestResult(res);
    } catch (err) {
      setConnTestResult({
        ok: false,
        error: err instanceof Error ? err.message : 'Falha ao testar conexão',
      });
    } finally {
      setConnTestLoading(false);
    }
  }, [activeId]);

  function selectTab(nextTab: Tab) {
    if (nextTab === tab && tabParam === nextTab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const measureAutoLimit = useCallback(() => {
    const top = tableAnchorRef.current?.getBoundingClientRect().top ?? 170;
    return calculateAutoRowLimit(top);
  }, []);

  const loadData = useCallback(
    async (
      targetLimit: number,
      targetFilters: Record<string, string>,
      targetSort: ColumnSort | null,
    ) => {
      if (activeId === undefined || !schema || !table) return;
      const clamped = clampRowLimit(targetLimit);
      setLoading(true);
      setError(null);
      try {
        const sql = buildTableQuery(schema, table, targetFilters, targetSort);
        setDataResult(await executeQuery(activeId, sql, clamped));
        setLimit(clamped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar os dados da tabela');
      } finally {
        setLoading(false);
      }
    },
    [activeId, schema, table],
  );

  const loadStructure = useCallback(async () => {
    if (activeId === undefined || !schema || !table) return;
    setLoading(true);
    setError(null);
    try {
      if (isView) {
        const cols = await listColumns(activeId, schema, table);
        setColumns(cols);
        setForeignKeys([]);
        setIndexes([]);
      } else {
        const struct = await getTableStructure(activeId, schema, table);
        setColumns(struct.columns);
        setForeignKeys(struct.foreignKeys ?? []);
        setIndexes(struct.indexes ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a estrutura da tabela');
    } finally {
      setLoading(false);
    }
  }, [activeId, schema, table, isView]);

  const loadDefinition = useCallback(async () => {
    if (activeId === undefined || !schema || !objectName) return;
    if (isCreating && categoryParam) {
      setObjectDefinition(buildNewObjectTemplate(schema, categoryParam));
      return;
    }
    const defCategory: EditableObjectCategory | null = isRoutine
      ? categoryParam
      : isView
        ? 'views'
        : null;
    if (!defCategory) return;

    setLoading(true);
    setError(null);
    try {
      setObjectDefinition(await getObjectDefinition(activeId, schema, defCategory, objectName));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a definição SQL do objeto');
    } finally {
      setLoading(false);
    }
  }, [activeId, schema, objectName, isCreating, isRoutine, isView, categoryParam]);

  useEffect(() => {
    setDataResult(null);
    setColumns(null);
    setForeignKeys([]);
    setIndexes([]);
    setObjectDefinition(null);
    setSavedMessage(null);
    setConfirmingDelete(false);
    setSort(null);
    setFilters({});
    if (!schema || !objectName || activeId === undefined) return;

    if (tab === 'definition') {
      void loadDefinition();
    } else if (tab === 'data') {
      const computedAuto = measureAutoLimit();
      setAutoLimit(computedAuto);
      setLimit(computedAuto);
      void loadData(computedAuto, {}, null);
    } else {
      void loadStructure();
    }
  }, [
    activeId,
    schema,
    objectName,
    tab,
    measureAutoLimit,
    loadData,
    loadStructure,
    loadDefinition,
  ]);

  useEffect(() => {
    function handleResize() {
      setAutoLimit(measureAutoLimit());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureAutoLimit]);

  useEffect(() => {
    if (!schema && !objectName && activeId !== undefined) {
      void checkConnection();
    }
  }, [activeId, schema, objectName, checkConnection]);

  function handleSortChange(nextSort: ColumnSort | null) {
    setSort(nextSort);
    void loadData(limit, filters, nextSort);
  }

  function handleFilterChange(column: string, value: string) {
    const nextFilters = { ...filters };
    if (value) {
      nextFilters[column] = value;
    } else {
      delete nextFilters[column];
    }
    setFilters(nextFilters);
    void loadData(limit, nextFilters, sort);
  }

  async function handleSaveChanges(updates: CellUpdate[]) {
    if (activeId === undefined || !schema || !table || !dataResult) return;
    setSavingChanges(true);
    setError(null);
    try {
      let colMeta = columns;
      if (!colMeta) {
        colMeta = await listColumns(activeId, schema, table);
        setColumns(colMeta);
      }
      const pkCols = colMeta.filter((c) => c.isPrimaryKey).map((c) => c.name);
      for (const update of updates) {
        const sql = buildUpdateStatement(schema, table, dataResult.columns, pkCols, update);
        await executeQuery(activeId, sql, limit);
      }
      await loadData(limit, filters, sort);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar os dados da tabela');
    } finally {
      setSavingChanges(false);
    }
  }

  async function handleSaveStructureChanges(changes: TableStructureChanges) {
    if (activeId === undefined || !schema || !table || !columns) return;
    setSavingChanges(true);
    setError(null);
    try {
      const statements = buildAlterTableStatements(schema, table, columns, changes);
      for (const sql of statements) {
        await executeQuery(activeId, sql, limit);
      }
      await loadStructure();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alterar a estrutura da tabela');
    } finally {
      setSavingChanges(false);
    }
  }

  async function handleCreateForeignKey(fk: {
    column: string;
    referencedSchema: string;
    referencedTable: string;
    referencedColumn: string;
    onUpdate: string;
    onDelete: string;
  }) {
    if (activeId === undefined || !schema || !table) return;
    setSavingChanges(true);
    setError(null);
    try {
      const constraintName = quoteIdentifier(`fk_${table}_${fk.column}`);
      const tableRef = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
      const refTableRef = `${quoteIdentifier(fk.referencedSchema)}.${quoteIdentifier(fk.referencedTable)}`;
      const sql = `ALTER TABLE ${tableRef} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${quoteIdentifier(
        fk.column,
      )}) REFERENCES ${refTableRef} (${quoteIdentifier(fk.referencedColumn)}) ON UPDATE ${fk.onUpdate} ON DELETE ${fk.onDelete}`;
      await executeQuery(activeId, sql, MIN_ROW_LIMIT);
      await loadStructure();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar chave estrangeira');
    } finally {
      setSavingChanges(false);
    }
  }

  async function handleDeleteForeignKey(constraintName: string) {
    if (activeId === undefined || !schema || !table) return;
    setSavingChanges(true);
    setError(null);
    try {
      const tableRef = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
      const sql = `ALTER TABLE ${tableRef} DROP CONSTRAINT ${quoteIdentifier(constraintName)}`;
      await executeQuery(activeId, sql, MIN_ROW_LIMIT);
      await loadStructure();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover chave estrangeira');
    } finally {
      setSavingChanges(false);
    }
  }

  async function handleCreateIndex(idx: {
    name: string;
    columns: string[];
    isUnique: boolean;
    method: string;
  }) {
    if (activeId === undefined || !schema || !table) return;
    setSavingChanges(true);
    setError(null);
    try {
      const tableRef = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
      const indexIdent = quoteIdentifier(idx.name.trim());
      const uniqueClause = idx.isUnique ? 'UNIQUE ' : '';
      const methodClause = idx.method ? `USING ${idx.method} ` : '';
      const colList = idx.columns.map((c) => quoteIdentifier(c)).join(', ');
      const sql = `CREATE ${uniqueClause}INDEX ${indexIdent} ON ${tableRef} ${methodClause}(${colList})`;
      await executeQuery(activeId, sql, MIN_ROW_LIMIT);
      await loadStructure();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar índice');
    } finally {
      setSavingChanges(false);
    }
  }

  async function handleDeleteIndex(indexName: string) {
    if (activeId === undefined || !schema || !table) return;
    setSavingChanges(true);
    setError(null);
    try {
      const sql = `DROP INDEX ${quoteIdentifier(schema)}.${quoteIdentifier(indexName)}`;
      await executeQuery(activeId, sql, MIN_ROW_LIMIT);
      await loadStructure();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover índice');
    } finally {
      setSavingChanges(false);
    }
  }

  async function handleSaveDefinition(sql: string) {
    if (activeId === undefined || !schema || !objectName) return;
    setSavingChanges(true);
    setError(null);
    setSavedMessage(null);
    try {
      await executeQuery(activeId, sql, MIN_ROW_LIMIT);
      notifyExplorerRefresh();

      if (isCreating && categoryParam) {
        const createdName = extractCreatedObjectName(sql, categoryParam);
        if (createdName) {
          if (categoryParam === 'tables') {
            router.replace(
              `/explorer?schema=${encodeURIComponent(schema)}&category=tables&table=${encodeURIComponent(
                createdName,
              )}&kind=table&tab=structure`,
            );
            return;
          }
          if (categoryParam === 'views') {
            const isMat = /MATERIALIZED\s+VIEW/i.test(sql);
            router.replace(
              `/explorer?schema=${encodeURIComponent(schema)}&category=views&table=${encodeURIComponent(
                createdName,
              )}&kind=${isMat ? 'materialized_view' : 'view'}`,
            );
            return;
          }
          router.replace(
            `/explorer?schema=${encodeURIComponent(schema)}&category=${encodeURIComponent(
              categoryParam,
            )}&item=${encodeURIComponent(createdName)}`,
          );
          return;
        }
        setSavedMessage('Objeto criado com sucesso');
        return;
      }

      await loadDefinition();
      setSavedMessage('Definição salva com sucesso');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a definição SQL do objeto');
    } finally {
      setSavingChanges(false);
    }
  }

  async function handleConfirmDeleteCurrentObject() {
    if (activeId === undefined || !schema || !objectName || isCreating) return;
    setDeletingObject(true);
    setError(null);
    try {
      await dropObject(activeId, schema, deleteCategory, objectName);
      setConfirmingDelete(false);
      notifyExplorerRefresh();
      router.replace(`/explorer?schema=${encodeURIComponent(schema)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir o objeto');
      setConfirmingDelete(false);
    } finally {
      setDeletingObject(false);
    }
  }

  if (!schema || !objectName) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Explorar"
          description={
            active
              ? `Selecione um objeto na barra lateral de ${active.name} (${active.database}).`
              : 'Cadastre e selecione uma conexão para explorar o banco configurado.'
          }
        />
        <div className="rounded-xl border border-dashed border-line bg-panel p-12 text-center shadow-card">
          <p className="font-mono text-sm font-semibold text-ink">
            {database && schema
              ? `${database}.${schema}`
              : database
                ? database
                : 'Nenhuma conexão selecionada'}
          </p>
          {connTestResult?.ok === false ? (
            <div className="mx-auto mt-4 max-w-lg rounded-xl border border-danger/30 bg-danger/10 p-5 text-left shadow-card">
              <div className="flex items-center gap-2 text-sm font-semibold text-danger">
                <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />
                <span>Falha na conexão com o banco de dados</span>
              </div>
              <p className="mt-2 font-mono text-xs break-words text-danger">
                {connTestResult.error}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={connTestLoading}
                  onClick={() => void checkConnection()}
                  className="cursor-pointer rounded-lg bg-danger/20 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/30 disabled:opacity-50"
                >
                  {connTestLoading ? 'Testando...' : 'Testar novamente'}
                </button>
                <Link
                  href="/connections"
                  className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-muted"
                >
                  Gerenciar conexões
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-xs text-ink-muted">
              Expanda um schema no painel <strong>Explorar</strong> da barra lateral para visualizar,
              adicionar ou excluir tabelas, views, procedures, functions e triggers.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-bold tracking-tight text-ink">
              <span className="text-ink-muted">{schema}.</span>
              {objectName}
            </h1>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
              {kindLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {active ? `Conexão ${active.name} (${active.database})` : 'Sem conexão ativa'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isCreating && !isRoutine && (
            <div
              role="tablist"
              aria-label="Visualização do objeto"
              className="flex rounded-lg bg-muted p-1"
            >
              {isView && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'definition'}
                  onClick={() => selectTab('definition')}
                  className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    tab === 'definition'
                      ? 'bg-panel text-ink shadow-card'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Editor SQL
                </button>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'data'}
                onClick={() => selectTab('data')}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  tab === 'data'
                    ? 'bg-panel text-ink shadow-card'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Dados
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'structure'}
                onClick={() => selectTab('structure')}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  tab === 'structure'
                    ? 'bg-panel text-ink shadow-card'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Estrutura
              </button>
            </div>
          )}

          {canEdit && !isCreating && (
            <button
              type="button"
              aria-label={`Excluir ${schema}.${objectName}`}
              title={`Excluir ${schema}.${objectName}`}
              onClick={() => setConfirmingDelete(true)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-line bg-panel text-ink-muted shadow-card transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
                className="h-3.5 w-3.5"
              >
                <path
                  d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.5 8.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div ref={tableAnchorRef} className="flex min-h-0 flex-1 flex-col gap-3">
        {loading && <p className="text-xs font-medium text-ink-muted">Carregando...</p>}

        {error && (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}

        {!loading && tab === 'definition' && objectDefinition !== null && (
          <ObjectDefinitionEditor
            definition={objectDefinition}
            objectLabel={`${schema}.${objectName}`}
            isNewTemplate={isCreating}
            onRefresh={isCreating ? undefined : () => void loadDefinition()}
            refreshing={loading}
            onSave={canEdit ? handleSaveDefinition : undefined}
            saving={savingChanges}
            savedMessage={savedMessage}
          />
        )}

        {!loading && tab === 'data' && dataResult && table && (
          <>
            <ResultTable
              result={dataResult}
              tableName={`${schema}.${table}`}
              sort={sort}
              onSortChange={handleSortChange}
              filters={filters}
              onFilterChange={handleFilterChange}
              onRefresh={() => void loadData(limit, filters, sort)}
              refreshing={loading}
              onSaveChanges={canEdit && !isView ? handleSaveChanges : undefined}
              savingChanges={savingChanges}
            />
            {dataResult.columns.length > 0 && (
              <RowLimitSelector
                value={limit}
                autoValue={autoLimit}
                rowCount={dataResult.rows.length}
                disabled={loading}
                onChange={(next) => loadData(next, filters, sort)}
              />
            )}
          </>
        )}

        {!loading && tab === 'structure' && columns && (
          <TableStructure
            columns={columns}
            foreignKeys={foreignKeys}
            indexes={indexes}
            currentSchema={schema}
            currentTable={table ?? ''}
            onRefresh={() => void loadStructure()}
            refreshing={loading}
            onSaveChanges={canEdit && !isView ? handleSaveStructureChanges : undefined}
            onCreateForeignKey={canEdit && !isView ? handleCreateForeignKey : undefined}
            onDeleteForeignKey={canEdit && !isView ? handleDeleteForeignKey : undefined}
            onCreateIndex={canEdit && !isView ? handleCreateIndex : undefined}
            onDeleteIndex={canEdit && !isView ? handleDeleteIndex : undefined}
            savingChanges={savingChanges}
          />
        )}
      </div>

      {confirmingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="explorer-delete-object-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-card">
            <h2 id="explorer-delete-object-title" className="text-sm font-semibold text-ink">
              Excluir {kindLabel.toLowerCase()}
            </h2>
            <p className="mt-1.5 text-xs text-ink-secondary">
              Tem certeza que deseja remover{' '}
              <strong className="font-mono text-ink">
                {schema}.{objectName}
              </strong>
              ? Esta operação executará <code className="font-mono">DROP</code> no banco de dados.
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingObject}
                onClick={() => setConfirmingDelete(false)}
                className="cursor-pointer rounded-md border border-line bg-subtle px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingObject}
                onClick={() => void handleConfirmDeleteCurrentObject()}
                className="cursor-pointer rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingObject ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={null}>
      <ExplorerContent />
    </Suspense>
  );
}

