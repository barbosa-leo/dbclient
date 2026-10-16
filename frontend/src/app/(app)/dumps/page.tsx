'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { JobStatusCard } from '@/components/jobs/JobStatusCard';
import { useJobPolling } from '@/components/jobs/useJobPolling';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { exportDump, getDumpDownloadUrl, importDump } from '@/services/dumps';
import { cancelJob, isJobFinished, MAX_FILE_SIZE } from '@/services/jobs';
import type { Job } from '@/services/jobs';

function validateFile(file: File | null): string | null {
  if (!file) return 'Selecione um arquivo .sql';
  if (!file.name.toLowerCase().endsWith('.sql')) return 'Apenas arquivos .sql são aceitos';
  if (file.size > MAX_FILE_SIZE) return 'O arquivo excede o limite de 50 MB';
  return null;
}

export default function DumpsPage() {
  const { active } = useConnections();
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const handleUpdate = useCallback((updated: Job) => setJob(updated), []);
  useJobPolling(job, handleUpdate);

  const running = job !== null && !isJobFinished(job);

  async function handleExport() {
    if (!active) return;
    setError(null);
    setExporting(true);
    try {
      setJob(await exportDump(active.id));
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

  const downloadAction =
    job && job.kind === 'dump_export' && job.status === 'done' ? (
      <a
        href={getDumpDownloadUrl(job.id)}
        download={job.fileName}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col justify-between gap-4 rounded-xl border border-brand-300 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-brand-900">Exportar dump</h2>
            <p className="text-sm text-brand-700">
              Gera um arquivo .sql em formato SQL puro via pg_dump. A exportação é abortada se o
              arquivo ultrapassar 50 MB.
            </p>
            <p className="text-xs text-brand-700">
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
          className="flex flex-col justify-between gap-4 rounded-xl border border-brand-300 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-brand-900">Importar dump</h2>
            <label className="flex flex-col gap-1 text-sm font-medium text-brand-700">
              Arquivo .sql (até 50 MB)
              <input
                type="file"
                accept=".sql"
                disabled={running}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm font-normal text-brand-900 file:mr-4 file:rounded-md file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700"
              />
            </label>
            <p className="text-xs text-brand-700">
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
    </div>
  );
}
