import { apiRequest } from '@/services/api';

export interface Settings {
  maxFileSize: number;
  historyEnabled: boolean;
  historyRetentionDays: number;
}

export function getSettings() {
  return apiRequest<Settings>('/settings');
}

export function updateSettings(input: Settings) {
  return apiRequest<Settings>('/settings', { method: 'PUT', body: JSON.stringify(input) });
}
