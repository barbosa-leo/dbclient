import { apiRequest } from '@/services/api';

export const MAX_FILE_SIZE = 52428800;

export type JobKind = 'script' | 'dump_export' | 'dump_import';
export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  kind: JobKind;
  status: JobStatus;
  progress: number;
  fileName: string;
  userId?: number;
  connectionId?: number;
  connectionName?: string;
  databaseName?: string;
  sizeBytes?: number;
  createdAt?: string;
  error: string | null;
}

export function isJobFinished(job: Job): boolean {
  return job.status === 'done' || job.status === 'failed';
}

export function fetchJob(id: string) {
  return apiRequest<Job>(`/jobs/${id}`);
}

export function cancelJob(id: string) {
  return apiRequest<Job>(`/jobs/${id}/cancel`, { method: 'POST' });
}
