import { uploadFile } from '@/services/api';
import type { Job } from '@/services/jobs';

export function runScript(connectionId: number, database: string, file: File) {
  const query = `?database=${encodeURIComponent(database)}`;
  return uploadFile<Job>(`/connections/${connectionId}/scripts${query}`, file);
}
