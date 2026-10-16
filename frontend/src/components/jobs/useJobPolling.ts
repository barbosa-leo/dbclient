import { useEffect } from 'react';
import { fetchJob, isJobFinished } from '@/services/jobs';
import type { Job } from '@/services/jobs';

const POLL_INTERVAL_MS = 1000;

export function useJobPolling(job: Job | null, onUpdate: (job: Job) => void) {
  const jobId = job?.id;
  const finished = job ? isJobFinished(job) : true;

  useEffect(() => {
    if (!jobId || finished) return;
    const timer = setInterval(async () => {
      try {
        onUpdate(await fetchJob(jobId));
      } catch {
        // próxima tentativa do polling cobre falhas transitórias de rede
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [jobId, finished, onUpdate]);
}
