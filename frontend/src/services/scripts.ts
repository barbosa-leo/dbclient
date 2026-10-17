import { uploadFile } from '@/services/api';
import type { Job } from '@/services/jobs';

export function runScript(connectionId: number, file: File) {
  return uploadFile<Job>(`/connections/${connectionId}/scripts`, file);
}
