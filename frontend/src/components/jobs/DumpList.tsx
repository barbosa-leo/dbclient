import { getDumpDownloadUrl } from '@/services/dumps';
import type { Job } from '@/services/jobs';

interface DumpListProps {
  dumps: Job[];
  deletingId: string | null;
  onDelete: (dump: Job) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

function isRunning(dump: Job): boolean {
  return dump.status === 'running' || dump.status === 'pending';
}

function DumpStatusBadge({ dump }: { dump: Job }) {
  if (dump.status === 'done') {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
        Concluído
      </span>
    );
  }
  if (dump.status === 'failed') {
    return (
      <span className="inline-flex items-center rounded-md bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
        Falhou
      </span>
    );
  }
  if (isRunning(dump)) {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
        {dump.progress}%
      </span>
    );
  }
  return null;
}

function ConnectionLabel({ dump }: { dump: Job }) {
  if (!dump.connectionName) return <>—</>;
  return (
    <span>
      <span className="font-medium text-ink">{dump.connectionName}</span>
      {dump.databaseName && <span className="text-ink-muted"> ({dump.databaseName})</span>}
    </span>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export function DumpList({ dumps, deletingId, onDelete }: DumpListProps) {
  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {dumps.map((dump) => (
          <li key={dump.id} className="rounded-lg border border-line bg-panel p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 font-mono text-xs font-medium break-all text-ink">
                {dump.fileName}
              </span>
              <DumpStatusBadge dump={dump} />
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              <ConnectionLabel dump={dump} />
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {formatBytes(dump.sizeBytes)} · {formatDate(dump.createdAt)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {dump.status === 'done' && (
                <a
                  href={getDumpDownloadUrl(dump.id)}
                  download={dump.fileName}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-xs font-medium text-ink transition-colors hover:bg-muted focus:outline-none"
                >
                  <DownloadIcon />
                  Baixar
                </a>
              )}
              <button
                type="button"
                onClick={() => onDelete(dump)}
                disabled={isRunning(dump) || deletingId === dump.id}
                className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-panel px-3 text-xs font-medium text-danger transition-colors hover:bg-danger/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-30"
              >
                <TrashIcon />
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-line md:block">
        <table className="w-full text-left font-sans text-xs">
          <thead className="bg-muted text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3">Arquivo</th>
              <th className="px-4 py-3">Conexão / Banco</th>
              <th className="px-4 py-3">Tamanho</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {dumps.map((dump) => (
              <tr key={dump.id} className="transition-colors hover:bg-muted/50">
                <td className="px-4 py-3 font-mono font-medium text-ink">{dump.fileName}</td>
                <td className="px-4 py-3 text-ink-secondary">
                  <ConnectionLabel dump={dump} />
                </td>
                <td className="px-4 py-3 text-ink-secondary">{formatBytes(dump.sizeBytes)}</td>
                <td className="px-4 py-3 text-ink-secondary">{formatDate(dump.createdAt)}</td>
                <td className="px-4 py-3">
                  <DumpStatusBadge dump={dump} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {dump.status === 'done' && (
                      <a
                        href={getDumpDownloadUrl(dump.id)}
                        download={dump.fileName}
                        className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-muted focus:outline-none"
                        title="Baixar arquivo .sql"
                      >
                        <DownloadIcon />
                        Baixar
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(dump)}
                      disabled={isRunning(dump) || deletingId === dump.id}
                      className="inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-30"
                      title="Excluir dump"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
