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
  const barColor = job.status === 'failed' ? 'bg-danger' : 'bg-primary';

  return (
    <div className="rounded-xl border border-brand-300 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-brand-900">{job.fileName}</p>
          <p className="text-sm text-brand-700">{statusLabels[job.status]}</p>
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
        className="mt-4 h-2 overflow-hidden rounded-full bg-brand-50"
      >
        <div className={`h-full transition-all ${barColor}`} style={{ width: `${job.progress}%` }} />
      </div>
      {job.error && (
        <pre className="mt-4 whitespace-pre-wrap font-mono text-xs text-danger">{job.error}</pre>
      )}
    </div>
  );
}
