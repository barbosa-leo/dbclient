import { apiRequest, uploadFile } from '@/services/api';
import type { Job } from '@/services/jobs';

export function exportDump(connectionId: number) {
  return apiRequest<Job>(`/connections/${connectionId}/dumps/export`, {
    method: 'POST',
  });
}

export function importDump(connectionId: number, file: File) {
  return uploadFile<Job>(`/connections/${connectionId}/dumps/import`, file);
}

export function getDumpDownloadUrl(jobId: string): string {
  return `/api/jobs/${jobId}/download`;
}

export function listUserDumps() {
  return apiRequest<Job[]>('/dumps');
}

export function deleteDump(jobId: string) {
  return apiRequest<void>(`/dumps/${jobId}`, {
    method: 'DELETE',
  });
}
