'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { TableStructure } from '@/components/schemas/TableStructure';
import { PageHeader } from '@/components/layout/PageHeader';
import { ResultTable } from '@/components/query/ResultTable';
import { RowLimitSelector } from '@/components/query/RowLimitSelector';
import { Button } from '@/components/ui/Button';
import { listColumns } from '@/services/schemas';
import type { ColumnInfo, TableKind } from '@/services/schemas';
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

function SchemasContent() {
  const searchParams = useSearchParams();
  const { active } = useConnections();
  const activeId = active?.id;

  const schema = searchParams.get('schema');
  const table = searchParams.get('table');
  const kindParam = searchParams.get('kind') as TableKind | null;
  const kindLabel = (kindParam && kindLabels[kindParam]) ?? 'Objeto';

  const [tab, setTab] = useState<Tab>('data');
  const [autoLimit, setAutoLimit] = useState(MIN_ROW_LIMIT);
  const [limit, setLimit] = useState(MIN_ROW_LIMIT);
  const [dataResult, setDataResult] = useState<QueryResult | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tableAnchorRef = useRef<HTMLDivElement>(null);

  const measureAutoLimit = useCallback(() => {
    const top = tableAnchorRef.current?.getBoundingClientRect().top ?? 170;
    return calculateAutoRowLimit(top);
  }, []);

  const loadData = useCallback(
    async (targetLimit: number) => {
      if (activeId === undefined || !schema || !table) return;
      const clamped = clampRowLimit(targetLimit);
      setLoading(true);
      setError(null);
      try {
        const sql = `SELECT * FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
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
    if (!schema || !table || activeId === undefined) return;
    if (tab === 'data') {
      const computedAuto = measureAutoLimit();
      setAutoLimit(computedAuto);
      setLimit(computedAuto);
      void loadData(computedAuto);
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

  if (!schema || !table) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Schemas"
          description={
            active
              ? `Expanda um schema no menu lateral e selecione uma tabela de ${active.name} (${active.database}).`
              : 'Cadastre e selecione uma conexão para explorar os schemas.'
          }
        />
        <div className="rounded-2xl border border-dashed border-brand-300/80 bg-white/60 p-12 text-center shadow-card">
          <p className="font-display text-xs font-semibold tracking-wider text-brand-700 uppercase">
            Nenhuma tabela selecionada
          </p>
          <p className="mt-1.5 text-xs text-brand-700/85">
            Abra <strong>Schemas</strong> na barra lateral, escolha um schema e clique em uma tabela
            para visualizar seus dados e estrutura.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-bold tracking-tight text-brand-900">
              <span className="text-brand-700/75">{schema}.</span>
              {table}
            </h1>
            <span className="rounded-full border border-brand-300/60 bg-white px-2.5 py-0.5 font-display text-[10px] font-semibold tracking-wider text-brand-700 uppercase shadow-xs">
              {kindLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-brand-700/90">
            {active ? `Conexão ${active.name} (${active.database})` : 'Sem conexão ativa'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            role="tablist"
            aria-label="Visualização da tabela"
            className="flex rounded-xl border border-brand-300/60 bg-white/90 p-1 shadow-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'data'}
              onClick={() => setTab('data')}
              className={`cursor-pointer rounded-lg px-4 py-1.5 font-display text-xs font-semibold tracking-wide transition-all ${
                tab === 'data'
                  ? 'bg-gradient-to-r from-brand-500 to-brand-700 text-white shadow-glow'
                  : 'text-brand-700 hover:text-brand-900'
              }`}
            >
              Dados
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'structure'}
              onClick={() => setTab('structure')}
              className={`cursor-pointer rounded-lg px-4 py-1.5 font-display text-xs font-semibold tracking-wide transition-all ${
                tab === 'structure'
                  ? 'bg-gradient-to-r from-brand-500 to-brand-700 text-white shadow-glow'
                  : 'text-brand-700 hover:text-brand-900'
              }`}
            >
              Estrutura
            </button>
          </div>

          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => (tab === 'data' ? loadData(limit) : loadStructure())}
          >
            Atualizar
          </Button>
        </div>
      </div>

      <div ref={tableAnchorRef} className="flex flex-col gap-3">
        {loading && <p className="text-xs font-medium text-brand-700">Carregando...</p>}

        {error && (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}

        {!loading && tab === 'data' && dataResult && (
          <>
            <ResultTable result={dataResult} />
            {dataResult.columns.length > 0 && (
              <RowLimitSelector
                value={limit}
                autoValue={autoLimit}
                rowCount={dataResult.rows.length}
                disabled={loading}
                onChange={(next) => loadData(next)}
              />
            )}
          </>
        )}

        {!loading && tab === 'structure' && columns && <TableStructure columns={columns} />}
      </div>
    </div>
  );
}

export default function SchemasPage() {
  return (
    <Suspense fallback={null}>
      <SchemasContent />
    </Suspense>
  );
}
