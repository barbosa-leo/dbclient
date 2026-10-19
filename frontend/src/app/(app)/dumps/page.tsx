'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { DumpList } from '@/components/jobs/DumpList';
import { JobStatusCard } from '@/components/jobs/JobStatusCard';
import { useJobPolling } from '@/components/jobs/useJobPolling';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { deleteDump, exportDump, getDumpDownloadUrl, importDump, listUserDumps } from '@/services/dumps';
import { cancelJob, isJobFinished, MAX_FILE_SIZE } from '@/services/jobs';
import type { Job } from '@/services/jobs';

function validateFile(file: File | null): string | null {
  if (!file) return 'Selecione um arquivo .sql';
  if (!file.name.toLowerCase().endsWith('.sql')) return 'Apenas arquivos .sql são aceitos';
  if (file.size > MAX_FILE_SIZE) return 'O arquivo excede o limite de 50 MB';
  return null;
}

export default function DumpsPage() {
  const { user } = useAuth();
  const canUseTools = user?.role === 'admin' || user?.role === 'operator';
  const { active } = useConnections();
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const [userDumps, setUserDumps] = useState<Job[]>([]);
  const [loadingDumps, setLoadingDumps] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dumpToDelete, setDumpToDelete] = useState<Job | null>(null);

  const loadDumps = useCallback(async () => {
    if (!canUseTools) return;
    setLoadingDumps(true);
    try {
      const data = await listUserDumps();
      setUserDumps(data);
    } catch {
      // Ignora falha silenciosa no carregamento inicial da lista
    } finally {
      setLoadingDumps(false);
    }
  }, [canUseTools]);

  useEffect(() => {
    loadDumps();
  }, [loadDumps]);

  const handleUpdate = useCallback(
    (updated: Job) => {
      setJob(updated);
      if (updated.status === 'done' || updated.status === 'failed') {
        loadDumps();
      }
    },
    [loadDumps],
  );
  useJobPolling(job, handleUpdate);

  if (!canUseTools) {
    return (
      <PageHeader
        title="Dumps"
        description="Apenas operadores e administradores podem acessar as ferramentas de dumps."
      />
    );
  }

  const running = job !== null && !isJobFinished(job);

  async function handleExport() {
    if (!active) return;
    setError(null);
    setExporting(true);
    try {
      const created = await exportDump(active.id);
      setJob(created);
      loadDumps();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao iniciar a exportação');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(event: FormEvent) {
    event.preventDefault();
    if (!active) return;
    const validation = validateFile(file);
    setError(validation);
    if (validation || !file) return;

    setImporting(true);
    try {
      setJob(await importDump(active.id, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao importar o dump');
    } finally {
      setImporting(false);
    }
  }

  async function handleCancel() {
    if (!job) return;
    setCanceling(true);
    try {
      setJob(await cancelJob(job.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cancelar o job');
    } finally {
      setCanceling(false);
    }
  }

  async function handleConfirmDelete() {
    if (!dumpToDelete) return;
    const id = dumpToDelete.id;
    setDeletingId(id);
    try {
      await deleteDump(id);
      setUserDumps((prev) => prev.filter((d) => d.id !== id));
      if (job?.id === id) {
        setJob(null);
      }
      setDumpToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir o dump');
    } finally {
      setDeletingId(null);
    }
  }

  const downloadAction =
    job && job.kind === 'dump_export' && job.status === 'done' ? (
      <a
        href={getDumpDownloadUrl(job.id)}
        download={job.fileName}
        className="rounded-lg bg-cta px-3.5 py-2 text-xs font-medium text-cta-fg transition-colors hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
      >
        Baixar .sql
      </a>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dumps"
        description={
          active
            ? `Exporte e importe dumps em SQL puro de ${active.name} (${active.database}).`
            : 'Cadastre e selecione uma conexão para exportar ou importar dumps.'
        }
      />

      <div className="grid gap-5 md:grid-cols-2">
        <section className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-panel p-5 shadow-card">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-ink">
              Exportar dump
            </h2>
            <p className="text-xs leading-relaxed text-ink-secondary">
              Gera um arquivo .sql em formato SQL puro via pg_dump. A exportação é abortada se o
              arquivo ultrapassar 50 MB.
            </p>
            <p className="text-[11px] text-ink-muted">
              Arquivos temporários expiram após o TTL configurado e não sobrevivem à reinicialização
              do container.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleExport} disabled={!active || running || exporting || importing}>
              {exporting ? 'Iniciando...' : 'Exportar dump'}
            </Button>
          </div>
        </section>

        <form
          onSubmit={handleImport}
          className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-panel p-5 shadow-card"
        >
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-tight text-ink">
              Importar dump
            </h2>
            <label className="flex flex-col gap-2 text-xs font-medium text-ink-secondary">
              Arquivo .sql (até 50 MB)
              <input
                type="file"
                accept=".sql"
                disabled={running}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="font-sans text-xs font-normal text-ink file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-line"
              />
            </label>
            <p className="text-[11px] text-ink-muted">
              Restaura o dump na conexão selecionada em uma única transação com ON_ERROR_STOP.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={!active || running || importing || exporting}>
              {importing ? 'Enviando...' : 'Importar dump'}
            </Button>
          </div>
        </form>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {job && (
        <JobStatusCard
          job={job}
          onCancel={handleCancel}
          canceling={canceling}
          actions={downloadAction}
        />
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold tracking-tight text-ink">
              Meus dumps disponíveis
            </h2>
            <p className="text-xs text-ink-secondary">
              Dumps exportados recentemente por você nesta sessão do servidor.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={loadDumps}
            disabled={loadingDumps}
            className="text-xs"
          >
            {loadingDumps ? 'Atualizando...' : 'Atualizar lista'}
          </Button>
        </div>

        {userDumps.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-muted">
            {loadingDumps ? 'Carregando dumps...' : 'Nenhum dump exportado até o momento.'}
          </div>
        ) : (
          <DumpList dumps={userDumps} deletingId={deletingId} onDelete={setDumpToDelete} />
        )}
      </section>

      {dumpToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dumps-delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-card">
            <h2 id="dumps-delete-modal-title" className="text-sm font-semibold text-ink">
              Excluir dump
            </h2>
            <p className="mt-1.5 text-xs text-ink-secondary">
              Tem certeza que deseja remover o arquivo{' '}
              <strong className="font-mono text-ink">{dumpToDelete.fileName}</strong>?
              Esta ação removerá o arquivo temporário do servidor permanentemente.
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={() => setDumpToDelete(null)}
                className="cursor-pointer rounded-md border border-line bg-subtle px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={() => void handleConfirmDelete()}
                className="cursor-pointer rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId !== null ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

