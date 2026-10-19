import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { isJobFinished } from '@/services/jobs';
import type { Job, JobStatus } from '@/services/jobs';

const statusLabels: Record<JobStatus, string> = {
  pending: 'Na fila',
  running: 'Em execução',
  done: 'Concluído',
  failed: 'Falhou',
};

interface JobStatusCardProps {
  job: Job;
  onCancel: () => void;
  canceling: boolean;
  actions?: ReactNode;
}

export function JobStatusCard({ job, onCancel, canceling, actions }: JobStatusCardProps) {
  const finished = isJobFinished(job);
  const barColor = job.status === 'failed' ? 'bg-danger' : 'bg-cta';

  return (
    <div className="rounded-xl border border-line bg-panel p-4 sm:p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <p className="font-mono text-xs font-semibold text-ink break-all">{job.fileName}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
            <span
              className={`font-semibold ${
                job.status === 'failed' ? 'text-danger' : 'text-online'
              }`}
            >
              {job.progress}%
            </span>
            <span>{statusLabels[job.status]}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {actions}
          {!finished && (
            <Button variant="danger" onClick={onCancel} disabled={canceling}>
              {canceling ? 'Cancelando...' : 'Cancelar'}
            </Button>
          )}
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={job.progress}
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${job.progress}%` }} />
      </div>
      {job.error && (
        <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-line bg-subtle p-3 font-mono text-[11px] text-danger">
          {job.error}
        </pre>
      )}
    </div>
  );
}
