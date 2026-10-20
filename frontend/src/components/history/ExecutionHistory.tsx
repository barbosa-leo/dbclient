'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { listHistory } from '@/services/history';
import type { HistoryEntry, HistoryKind } from '@/services/history';

interface ExecutionHistoryProps {
  kind: HistoryKind;
  refreshKey?: string | number;
  onReuse?: (entry: HistoryEntry) => void;
  collapsible?: boolean;
  maxHeight?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function StatusBadge({ success }: { success: boolean }) {
  return success ? (
    <span className="rounded-md bg-online/15 px-2 py-0.5 text-[11px] font-medium text-online">
      Sucesso
    </span>
  ) : (
    <span className="rounded-md bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
      Falhou
    </span>
  );
}

export function ExecutionHistory({
  kind,
  refreshKey,
  onReuse,
  collapsible = true,
  maxHeight,
}: ExecutionHistoryProps) {
  const { user } = useAuth();
  const showUser = user?.role === 'admin';
  const [open, setOpen] = useState(!collapsible);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reusedId, setReusedId] = useState<number | null>(null);

  const shouldFetch = !collapsible || open;

  useEffect(() => {
    if (!shouldFetch) return;
    let cancelled = false;
    setLoading(true);
    listHistory(kind)
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Falha ao carregar o histórico');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shouldFetch, kind, refreshKey]);

  function handleReuse(entry: HistoryEntry) {
    if (!onReuse) return;
    onReuse(entry);
    setReusedId(entry.id);
    setTimeout(() => {
      setReusedId((current) => (current === entry.id ? null : current));
    }, 1500);
  }

  const isVisible = !collapsible || open;

  return (
    <section className="rounded-xl border border-line bg-panel shadow-card">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-xs font-semibold text-ink"
        >
          <span>Histórico de {kind === 'query' ? 'consultas' : 'scripts'}</span>
          <span aria-hidden="true" className="text-ink-muted">
            {open ? '▾' : '▸'}
          </span>
        </button>
      ) : (
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-xs text-ink-muted">
          <span className="font-semibold text-ink">
            Histórico de {kind === 'query' ? 'consultas' : 'scripts'}
          </span>
          {entries.length > 0 && <span>{entries.length} registro(s)</span>}
        </div>
      )}

      {isVisible && (
        <div className={collapsible ? 'border-t border-line' : ''}>
          {error && (
            <p role="alert" className="p-4 text-xs text-danger">
              {error}
            </p>
          )}
          {!error && loading && entries.length === 0 && (
            <p className="p-4 text-xs text-ink-muted">Carregando...</p>
          )}
          {!error && !loading && entries.length === 0 && (
            <p className="p-4 text-xs text-ink-muted">Nenhuma execução registrada.</p>
          )}
          {entries.length > 0 && (
            <ul
              style={maxHeight ? { maxHeight } : undefined}
              className={`divide-y divide-line overflow-y-auto ${!maxHeight ? (collapsible ? 'max-h-80' : 'max-h-[500px]') : ''}`}
            >
              {entries.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1.5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                    <StatusBadge success={entry.success} />
                    <span>{new Date(entry.createdAt).toLocaleString('pt-BR')}</span>
                    <span>·</span>
                    <span>
                      {entry.connectionName} ({entry.database})
                    </span>
                    <span>·</span>
                    <span>{formatDuration(entry.durationMs)}</span>
                    {kind === 'script' && (
                      <>
                        <span>·</span>
                        <span>{formatBytes(entry.fileSize)}</span>
                      </>
                    )}
                    {showUser && (
                      <>
                        <span>·</span>
                        <span>{entry.userEmail}</span>
                      </>
                    )}
                  </div>

                  {kind === 'query' ? (
                    <div className="flex items-start justify-between gap-3">
                      <pre className="max-h-24 min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-ink">
                        {entry.sql}
                      </pre>
                      {onReuse && (
                        <button
                          type="button"
                          onClick={() => handleReuse(entry)}
                          className={`shrink-0 cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            reusedId === entry.id
                              ? 'border-online/40 bg-online/15 text-online'
                              : 'border-line bg-subtle text-ink hover:bg-muted'
                          }`}
                        >
                          {reusedId === entry.id ? 'Carregado!' : 'Usar no editor'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="break-all font-mono text-xs font-medium text-ink">
                      {entry.fileName}
                    </span>
                  )}

                  {entry.error && (
                    <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-danger">
                      {entry.error}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

