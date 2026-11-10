'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveAccess } from '@/components/auth/useActiveAccess';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { ExecutionHistory } from '@/components/history/ExecutionHistory';
import { PageHeader } from '@/components/layout/PageHeader';
import { ResultTable } from '@/components/query/ResultTable';
import { RowLimitSelector } from '@/components/query/RowLimitSelector';
import { SqlEditor } from '@/components/query/SqlEditor';
import { MIN_EDITOR_HEIGHT, useEditorLayout } from '@/components/query/useEditorLayout';
import { useSqlDraft } from '@/components/query/useSqlDraft';
import { ResizeHandle } from '@/components/ui/ResizeHandle';
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
  const { readOnly } = useActiveAccess();
  const [tab, setTab] = useState<QueryTab>('result');
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [sql, setSql] = useSqlDraft(active?.id ?? null);
  const [executedSql, setExecutedSql] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [autoLimit, setAutoLimit] = useState(MIN_ROW_LIMIT);
  const [limit, setLimit] = useState(MIN_ROW_LIMIT);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [metadataRevision, setMetadataRevision] = useState(0);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const lowerAreaRef = useRef<HTMLDivElement>(null);
  const resultAnchorRef = useRef<HTMLDivElement>(null);
  const layout = useEditorLayout(editorAreaRef, lowerAreaRef);
  const resultsCollapsed = layout.resultsCollapsed && !editorCollapsed;

  const measureAutoLimit = useCallback(() => {
    const top = resultAnchorRef.current?.getBoundingClientRect().top ?? 280;
    return calculateAutoRowLimit(top);
  }, []);

  useEffect(() => {
    const computed = measureAutoLimit();
    setAutoLimit(computed);
    setLimit(computed);
  }, [measureAutoLimit]);

  useEffect(() => {
    const anchor = resultAnchorRef.current;
    if (!anchor) return;
    const observer = new ResizeObserver(() => setAutoLimit(measureAutoLimit()));
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [measureAutoLimit]);

  async function run(statement: string, targetLimit: number, saveHistory = false) {
    if (!active || !statement.trim()) return;
    const clamped = clampRowLimit(targetLimit);
    setRunning(true);
    setError(null);
    setTab('result');
    layout.expandResults();
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

  function showTab(next: QueryTab) {
    setTab(next);
    layout.expandResults();
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
        readOnly={readOnly}
        collapsed={editorCollapsed}
        onToggleCollapse={() => setEditorCollapsed((prev) => !prev)}
        height={layout.height}
        fill={resultsCollapsed}
        editorAreaRef={editorAreaRef}
        resizeHandle={
          <ResizeHandle
            label="Altura do editor SQL"
            value={layout.height}
            min={MIN_EDITOR_HEIGHT}
            max={layout.maxHeight}
            {...layout.handleProps}
          />
        }
      />

      <div
        ref={lowerAreaRef}
        className={`flex flex-col gap-3.5 ${
          resultsCollapsed ? 'shrink-0' : 'min-h-[320px] flex-1 lg:min-h-0'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line pb-1.5">
          <div role="tablist" aria-label="Abas da consulta" className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'result'}
              onClick={() => showTab('result')}
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
              onClick={() => showTab('history')}
              className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                tab === 'history' ? 'bg-panel text-ink shadow-card' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Histórico
            </button>
          </div>
          {resultsCollapsed && (
            <button
              type="button"
              onClick={layout.expandResults}
              className="flex h-7 cursor-pointer items-center gap-1 rounded-md border border-line bg-subtle px-2 text-[11px] font-medium text-ink transition-colors hover:bg-muted"
            >
              <span>Mostrar resultados</span>
              <span aria-hidden="true" className="text-ink-muted">
                ▴
              </span>
            </button>
          )}
        </div>

        <div
          className={
            tab === 'result' && !resultsCollapsed ? 'flex min-h-0 flex-1 flex-col gap-2.5' : 'hidden'
          }
        >
          <div ref={resultAnchorRef} className="flex min-h-0 flex-1 flex-col gap-2.5">
            {error && (
              <pre
                role="alert"
                className="max-h-40 shrink-0 overflow-auto whitespace-pre-wrap rounded-xl border border-danger/50 bg-panel p-4 font-mono text-xs text-danger"
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
                />
                {result.columns.length > 0 && (
                  <div className="shrink-0">
                    <RowLimitSelector
                      value={limit}
                      autoValue={autoLimit}
                      rowCount={result.rows.length}
                      disabled={running}
                      onChange={(next) => run(executedSql, next, false)}
                    />
                  </div>
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

        <div
          className={
            tab === 'history' && !resultsCollapsed ? 'flex min-h-0 flex-1 flex-col' : 'hidden'
          }
        >
          <ExecutionHistory
            kind="query"
            refreshKey={historyVersion}
            collapsible={false}
            fill
            onReuse={(entry) => setSql(entry.sql ?? '')}
          />
        </div>
      </div>
    </div>
  );
}
