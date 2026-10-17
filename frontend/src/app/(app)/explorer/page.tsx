'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { TableStructure } from '@/components/explorer/TableStructure';
import type { ColumnStructureUpdate } from '@/components/explorer/TableStructure';
import { PageHeader } from '@/components/layout/PageHeader';
import { ResultTable } from '@/components/query/ResultTable';
import type { CellUpdate, ColumnSort } from '@/components/query/ResultTable';
import { RowLimitSelector } from '@/components/query/RowLimitSelector';
import { listColumns } from '@/services/explorer';
import type { ColumnInfo, TableKind } from '@/services/explorer';
import {
  MIN_ROW_LIMIT,
  calculateAutoRowLimit,
  clampRowLimit,
  executeQuery,
} from '@/services/query';
import type { QueryResult } from '@/services/query';

type Tab = 'data' | 'structure';

const kindLabels: Record<TableKind, string> = {
  table: 'Tabela',
  view: 'View',
  materialized_view: 'View materializada',
};

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
  updates: ColumnStructureUpdate[],
): string[] {
  const tableRef = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const statements: string[] = [];

  for (const { original, updated } of updates) {
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

  const pkChanged = updates.some((u) => u.original.isPrimaryKey !== u.updated.isPrimaryKey);
  if (pkChanged) {
    const updateByOrigName = new Map(updates.map((u) => [u.original.name, u.updated]));
    const nextCols = currentColumns.map((c) => updateByOrigName.get(c.name) ?? c);
    const nextPkCols = nextCols.filter((c) => c.isPrimaryKey).map((c) => quoteIdentifier(c.name));
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
  const { active } = useConnections();
  const activeId = active?.id;
  const database = active?.database ?? null;

  const schema = searchParams.get('schema');
  const table = searchParams.get('table');
  const kindParam = searchParams.get('kind') as TableKind | null;
  const kindLabel = (kindParam && kindLabels[kindParam]) ?? 'Objeto';
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'structure' ? 'structure' : 'data';

  const [autoLimit, setAutoLimit] = useState(MIN_ROW_LIMIT);
  const [limit, setLimit] = useState(MIN_ROW_LIMIT);
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dataResult, setDataResult] = useState<QueryResult | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tableAnchorRef = useRef<HTMLDivElement>(null);

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
      setColumns(await listColumns(activeId, schema, table));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a estrutura da tabela');
    } finally {
      setLoading(false);
    }
  }, [activeId, schema, table]);

  useEffect(() => {
    setDataResult(null);
    setColumns(null);
    setSort(null);
    setFilters({});
    if (!schema || !table || activeId === undefined) return;
    if (tab === 'data') {
      const computedAuto = measureAutoLimit();
      setAutoLimit(computedAuto);
      setLimit(computedAuto);
      void loadData(computedAuto, {}, null);
    } else {
      void loadStructure();
    }
  }, [activeId, schema, table, tab, measureAutoLimit, loadData, loadStructure]);

  useEffect(() => {
    function handleResize() {
      setAutoLimit(measureAutoLimit());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureAutoLimit]);

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

  async function handleSaveStructureChanges(updates: ColumnStructureUpdate[]) {
    if (activeId === undefined || !schema || !table || !columns) return;
    setSavingChanges(true);
    setError(null);
    try {
      const statements = buildAlterTableStatements(schema, table, columns, updates);
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

  if (!schema || !table) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Explorar"
          description={
            active
              ? `Selecione uma tabela na barra lateral de ${active.name} (${active.database}).`
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
          <p className="mt-1 text-xs text-ink-muted">
            Expanda um schema no painel <strong>Explorar</strong> da barra lateral para visualizar
            suas tabelas, views, procedures, functions e triggers.
          </p>
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
              {table}
            </h1>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
              {kindLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {active ? `Conexão ${active.name} (${active.database})` : 'Sem conexão ativa'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            role="tablist"
            aria-label="Visualização da tabela"
            className="flex rounded-lg bg-muted p-1"
          >
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
        </div>
      </div>

      <div ref={tableAnchorRef} className="flex min-h-0 flex-1 flex-col gap-3">
        {loading && <p className="text-xs font-medium text-ink-muted">Carregando...</p>}

        {error && (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}

        {!loading && tab === 'data' && dataResult && (
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
              onSaveChanges={handleSaveChanges}
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
            onRefresh={() => void loadStructure()}
            refreshing={loading}
            onSaveChanges={handleSaveStructureChanges}
            savingChanges={savingChanges}
          />
        )}
      </div>
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
