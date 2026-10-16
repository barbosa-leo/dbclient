'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
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

export default function QueryPage() {
  const { active } = useConnections();
  const [sql, setSql] = useState('');
  const [executedSql, setExecutedSql] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [autoLimit, setAutoLimit] = useState(MIN_ROW_LIMIT);
  const [limit, setLimit] = useState(MIN_ROW_LIMIT);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultAnchorRef = useRef<HTMLDivElement>(null);

  const measureAutoLimit = useCallback(() => {
    const top = resultAnchorRef.current?.getBoundingClientRect().top ?? 380;
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

  async function run(statement: string, targetLimit: number) {
    if (!active || !statement.trim()) return;
    const clamped = clampRowLimit(targetLimit);
    setRunning(true);
    setError(null);
    try {
      setResult(await executeQuery(active.id, statement, clamped));
      setExecutedSql(statement);
      setLimit(clamped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar a consulta');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Editor SQL"
        description={
          active
            ? `Executando em ${active.name} (${active.database}).`
            : 'Cadastre e selecione uma conexão para executar consultas.'
        }
      />
      <SqlEditor
        value={sql}
        onChange={setSql}
        onRun={() => run(sql, limit)}
        running={running}
        disabled={!active}
      />
      <div ref={resultAnchorRef} className="flex flex-col gap-3">
        {error && (
          <pre
            role="alert"
            className="whitespace-pre-wrap rounded-xl border border-danger bg-white p-4 font-mono text-xs text-danger"
          >
            {error}
          </pre>
        )}
        {result && (
          <>
            <ResultTable result={result} />
            {result.columns.length > 0 && (
              <RowLimitSelector
                value={limit}
                autoValue={autoLimit}
                rowCount={result.rows.length}
                disabled={running}
                onChange={(next) => run(executedSql, next)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
