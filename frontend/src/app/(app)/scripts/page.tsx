'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { JobStatusCard } from '@/components/jobs/JobStatusCard';
import { useJobPolling } from '@/components/jobs/useJobPolling';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { SqlCodeEditor } from '@/components/ui/SqlCodeEditor';
import { cancelJob, isJobFinished, MAX_FILE_SIZE } from '@/services/jobs';
import type { Job } from '@/services/jobs';
import { runScript } from '@/services/scripts';

export default function ScriptsPage() {
  const { user } = useAuth();
  const canUseTools = user?.role === 'admin' || user?.role === 'operator';
  const { active } = useConnections();
  const [file, setFile] = useState<File | null>(null);
  const [sqlContent, setSqlContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const handleUpdate = useCallback((updated: Job) => setJob(updated), []);
  useJobPolling(job, handleUpdate);

  if (!canUseTools) {
    return (
      <PageHeader
        title="Scripts"
        description="Apenas operadores e administradores podem acessar as ferramentas de scripts."
      />
    );
  }

  const running = job !== null && !isJobFinished(job);

  function handleFileChange(selected: File | null) {
    setError(null);
    setFile(selected);
    if (!selected) {
      setFileName('');
      return;
    }
    if (!selected.name.toLowerCase().endsWith('.sql')) {
      setError('Apenas arquivos .sql são aceitos');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError('O arquivo excede o limite de 50 MB');
      return;
    }
    setFileName(selected.name);

    // Carrega o conteúdo no editor para preview e edição se for de tamanho razoável (< 5MB)
    if (selected.size <= 5 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) ?? '';
        setSqlContent(text);
      };
      reader.readAsText(selected);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!active) return;
    setError(null);

    let fileToSend = file;
    if (sqlContent.trim()) {
      const targetName = fileName.trim() || 'script.sql';
      const safeName = targetName.toLowerCase().endsWith('.sql') ? targetName : `${targetName}.sql`;
      const blob = new Blob([sqlContent], { type: 'text/sql' });
      fileToSend = new File([blob], safeName, { type: 'text/sql' });
    }

    if (!fileToSend) {
      setError('Informe o conteúdo do script ou selecione um arquivo .sql');
      return;
    }

    if (fileToSend.size > MAX_FILE_SIZE) {
      setError('O script excede o limite máximo de 50 MB');
      return;
    }

    setSubmitting(true);
    try {
      setJob(await runScript(active.id, fileToSend));
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
            ? `Execute um script .sql na conexão ${active.name} (${active.database}) em uma única transação.`
            : 'Cadastre e selecione uma conexão para executar scripts.'
        }
      />

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 sm:p-5 shadow-card"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-secondary">
            Carregar arquivo .sql (opcional)
            <input
              type="file"
              accept=".sql"
              disabled={running}
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="max-w-full font-sans text-xs font-normal text-ink file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-line"
            />
          </label>
          {fileName && (
            <span className="font-mono text-xs text-ink-muted break-all">
              Arquivo: <span className="text-ink font-semibold">{fileName}</span>
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-secondary">
            Editor de Script SQL
          </label>
          <SqlCodeEditor
            value={sqlContent}
            onChange={setSqlContent}
            disabled={running || submitting}
            placeholder="-- Cole ou escreva seu script SQL aqui para executar em transação...
-- Exemplo:
-- BEGIN;
-- ALTER TABLE usuarios ADD COLUMN ativo BOOLEAN DEFAULT true;
-- COMMIT;"
            minHeight="280px"
            className="min-h-[280px]"
            ariaLabel="Editor de Script SQL"
          />
        </div>

        <p className="text-xs text-ink-muted">
          O script roda com ON_ERROR_STOP em uma única transação: se algum comando falhar, tudo é
          revertido e o erro retornado pelo PostgreSQL é exibido.
        </p>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          {sqlContent && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSqlContent('');
                setFile(null);
                setFileName('');
              }}
              disabled={running || submitting}
              className="w-full sm:w-auto"
            >
              Limpar
            </Button>
          )}
          <Button
            type="submit"
            disabled={!active || running || submitting || (!sqlContent.trim() && !file)}
            className="w-full sm:w-auto"
          >
            {submitting ? 'Enviando...' : 'Executar script'}
          </Button>
        </div>
      </form>

      {job && <JobStatusCard job={job} onCancel={handleCancel} canceling={canceling} />}
    </div>
  );
}

