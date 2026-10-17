'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { TableStructure } from '@/components/explorer/TableStructure';
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
  const searchParams = useSearchParams();
  const { active } = useConnections();
  const activeId = active?.id;

  const database = searchParams.get('database') ?? active?.database ?? null;
  const schema = searchParams.get('schema');
  const table = searchParams.get('table');
  const kindParam = searchParams.get('kind') as TableKind | null;
  const kindLabel = (kindParam && kindLabels[kindParam]) ?? 'Objeto';

  const [tab, setTab] = useState<Tab>('data');
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
        setDataResult(await executeQuery(activeId, sql, clamped, database ?? undefined));
        setLimit(clamped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar os dados da tabela');
      } finally {
        setLoading(false);
      }
    },
    [activeId, database, schema, table],
  );

  const loadStructure = useCallback(async () => {
    if (activeId === undefined || !schema || !table) return;
    setLoading(true);
    setError(null);
    try {
      setColumns(await listColumns(activeId, schema, table, database ?? undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a estrutura da tabela');
    } finally {
      setLoading(false);
    }
  }, [activeId, database, schema, table]);

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
        colMeta = await listColumns(activeId, schema, table, database ?? undefined);
        setColumns(colMeta);
      }
      const pkCols = colMeta.filter((c) => c.isPrimaryKey).map((c) => c.name);
      for (const update of updates) {
        const sql = buildUpdateStatement(schema, table, dataResult.columns, pkCols, update);
        await executeQuery(activeId, sql, limit, database ?? undefined);
      }
      await loadData(limit, filters, sort);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar os dados da tabela');
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
              ? `Expanda um banco na barra lateral de ${active.name} para visualizar seus schemas.`
              : 'Cadastre e selecione uma conexão para explorar os bancos disponíveis.'
          }
        />
        <div className="rounded-xl border border-dashed border-line bg-panel p-12 text-center shadow-card">
          <p className="font-mono text-sm font-semibold text-ink">
            {database && schema
              ? `${database}.${schema}`
              : database
                ? database
                : 'Nenhum banco selecionado'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Expanda um banco no painel <strong>Explorar</strong> da barra lateral para visualizar os
            schemas daquele banco.
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
            {active ? `Conexão ${active.name} (${database ?? active.database})` : 'Sem conexão ativa'}
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
              onClick={() => setTab('data')}
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
              onClick={() => setTab('structure')}
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

        {!loading && tab === 'structure' && columns && <TableStructure columns={columns} />}
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
