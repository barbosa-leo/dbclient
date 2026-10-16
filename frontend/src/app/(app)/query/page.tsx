'use client';

import { useState } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/query/Pagination';
import { ResultTable } from '@/components/query/ResultTable';
import { SqlEditor } from '@/components/query/SqlEditor';
import { executeQuery } from '@/services/query';
import type { QueryResult } from '@/services/query';

const PAGE_SIZE = 50;

export default function QueryPage() {
  const { active } = useConnections();
  const [sql, setSql] = useState('');
  const [executedSql, setExecutedSql] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [page, setPage] = useState(1);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(statement: string, targetPage: number) {
    if (!active || !statement.trim()) return;
    setRunning(true);
    setError(null);
    try {
      setResult(await executeQuery(active.id, statement, targetPage, PAGE_SIZE));
      setExecutedSql(statement);
      setPage(targetPage);
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
        onRun={() => run(sql, 1)}
        running={running}
        disabled={!active}
      />
      {error && (
        <pre
          role="alert"
          className="whitespace-pre-wrap rounded-xl border border-danger bg-white p-4 font-mono text-xs text-danger"
        >
          {error}
        </pre>
      )}
      {result && (
        <div className="flex flex-col gap-3">
          <ResultTable result={result} />
          {result.columns.length > 0 && (
            <Pagination
              page={page}
              hasMore={result.hasMore}
              disabled={running}
              onChange={(next) => run(executedSql, next)}
            />
          )}
        </div>
      )}
    </div>
  );
}
