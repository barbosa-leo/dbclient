'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { JobStatusCard } from '@/components/jobs/JobStatusCard';
import { useJobPolling } from '@/components/jobs/useJobPolling';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { cancelJob, isJobFinished, MAX_FILE_SIZE } from '@/services/jobs';
import type { Job } from '@/services/jobs';
import { runScript } from '@/services/scripts';

function validateFile(file: File | null): string | null {
  if (!file) return 'Selecione um arquivo .sql';
  if (!file.name.toLowerCase().endsWith('.sql')) return 'Apenas arquivos .sql são aceitos';
  if (file.size > MAX_FILE_SIZE) return 'O arquivo excede o limite de 50 MB';
  return null;
}

export default function ScriptsPage() {
  const { active } = useConnections();
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const handleUpdate = useCallback((updated: Job) => setJob(updated), []);
  useJobPolling(job, handleUpdate);

  const running = job !== null && !isJobFinished(job);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!active) return;
    const validation = validateFile(file);
    setError(validation);
    if (validation || !file) return;

    setSubmitting(true);
    try {
      setJob(await runScript(active.id, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar o script');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Scripts"
        description={
          active
            ? `Execute um arquivo .sql em ${active.name} (${active.database}) em uma única transação.`
            : 'Cadastre e selecione uma conexão para executar scripts.'
        }
      />

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-brand-300 bg-white p-6 shadow-sm"
      >
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
          O script roda com ON_ERROR_STOP em uma transação: se algum comando falhar, tudo é
          revertido e o erro do banco é exibido.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={!active || running || submitting}>
            {submitting ? 'Enviando...' : 'Executar script'}
          </Button>
        </div>
      </form>

      {job && <JobStatusCard job={job} onCancel={handleCancel} canceling={canceling} />}
    </div>
  );
}
