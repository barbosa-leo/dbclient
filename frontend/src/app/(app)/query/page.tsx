'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { ExecutionHistory } from '@/components/history/ExecutionHistory';
import { PageHeader } from '@/components/layout/PageHeader';
import { ResultTable } from '@/components/query/ResultTable';
import { RowLimitSelector } from '@/components/query/RowLimitSelector';
import { SqlEditor } from '@/components/query/SqlEditor';
import {
  MIN_ROW_LIMIT,
  calculateAutoRowLimit,
  clampRowLimit,
  executeQuery,
} from '@/services/query';
import type { QueryResult } from '@/services/query';

type QueryTab = 'result' | 'history';

export default function QueryPage() {
  const { active } = useConnections();
  const [tab, setTab] = useState<QueryTab>('result');
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [sql, setSql] = useState('');
  const [executedSql, setExecutedSql] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [autoLimit, setAutoLimit] = useState(MIN_ROW_LIMIT);
  const [limit, setLimit] = useState(MIN_ROW_LIMIT);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [metadataRevision, setMetadataRevision] = useState(0);
  const resultAnchorRef = useRef<HTMLDivElement>(null);

  const measureAutoLimit = useCallback(() => {
    const top = resultAnchorRef.current?.getBoundingClientRect().top ?? 280;
    return calculateAutoRowLimit(top);
  }, []);

  useEffect(() => {
    const computed = measureAutoLimit();
    setAutoLimit(computed);
    setLimit(computed);

    function handleResize() {
      setAutoLimit(measureAutoLimit());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureAutoLimit]);

  function handleToggleCollapse() {
    setEditorCollapsed((prev) => !prev);
    requestAnimationFrame(() => {
      setAutoLimit(measureAutoLimit());
    });
  }

  async function run(statement: string, targetLimit: number, saveHistory = false) {
    if (!active || !statement.trim()) return;
    const clamped = clampRowLimit(targetLimit);
    setRunning(true);
    setError(null);
    setTab('result');
    try {
      setResult(await executeQuery(active.id, statement, clamped, { saveHistory }));
      setExecutedSql(statement);
      setLimit(clamped);
      if (/(?:^|;)\s*(?:CREATE|ALTER|DROP|TRUNCATE|RENAME|COMMENT)\b/i.test(statement)) {
        setMetadataRevision((revision) => revision + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar a consulta');
    } finally {
      setRunning(false);
      if (saveHistory) {
        setHistoryVersion((version) => version + 1);
      }
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      <PageHeader
        title="Editor SQL"
        description={
          active
            ? `Executando na conexão ${active.name} (${active.database}).`
            : 'Cadastre e selecione uma conexão para executar consultas.'
        }
      />
      <SqlEditor
        value={sql}
        onChange={setSql}
        databaseName={active?.database ?? null}
        connectionId={active?.id ?? null}
        metadataRevision={metadataRevision}
        onRun={(statement) => run(statement, limit, true)}
        running={running}
        disabled={!active}
        collapsed={editorCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className="flex items-center justify-between border-b border-line pb-1.5">
        <div role="tablist" aria-label="Abas da consulta" className="flex rounded-lg bg-muted p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'result'}
            onClick={() => setTab('result')}
            className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tab === 'result' ? 'bg-panel text-ink shadow-card' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Resultado
            {result && result.columns.length > 0 && (
              <span className="ml-1.5 font-mono text-[11px] text-ink-muted">
                ({result.rows.length})
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'history'}
            onClick={() => setTab('history')}
            className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tab === 'history' ? 'bg-panel text-ink shadow-card' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Histórico
          </button>
        </div>
      </div>

      <div className={tab === 'result' ? 'flex min-h-0 flex-1 flex-col gap-2.5' : 'hidden'}>
        <div ref={resultAnchorRef} className="flex min-h-0 flex-1 flex-col gap-2.5">
          {error && (
            <pre
              role="alert"
              className="whitespace-pre-wrap rounded-xl border border-danger/50 bg-panel p-4 font-mono text-xs text-danger"
            >
              {error}
            </pre>
          )}
          {result ? (
            <>
              <ResultTable
                result={result}
                onRefresh={() => void run(executedSql, limit, false)}
                refreshing={running}
                maxHeight={
                  editorCollapsed
                    ? 'max(450px, calc(100vh - 200px))'
                    : 'max(380px, calc(100vh - 290px))'
                }
              />
              {result.columns.length > 0 && (
                <RowLimitSelector
                  value={limit}
                  autoValue={autoLimit}
                  rowCount={result.rows.length}
                  disabled={running}
                  onChange={(next) => run(executedSql, next, false)}
                />
              )}
            </>
          ) : (
            !error && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-panel p-8 text-center shadow-card">
                <p className="text-xs text-ink-muted">
                  Nenhum resultado para exibir. Escreva uma consulta SQL acima e clique em Executar.
                </p>
              </div>
            )
          )}
        </div>
      </div>

      <div className={tab === 'history' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <ExecutionHistory
          kind="query"
          refreshKey={historyVersion}
          collapsible={false}
          maxHeight={
            editorCollapsed
              ? 'max(450px, calc(100vh - 200px))'
              : 'max(380px, calc(100vh - 290px))'
          }
          onReuse={(entry) => setSql(entry.sql ?? '')}
        />
      </div>
    </div>
  );
}
