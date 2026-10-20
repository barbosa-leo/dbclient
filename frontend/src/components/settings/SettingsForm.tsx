'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { CheckboxField } from '@/components/ui/CheckboxField';
import { TextField } from '@/components/ui/TextField';
import { updateSettings } from '@/services/settings';
import type { Settings } from '@/services/settings';

const BYTES_PER_MB = 1024 * 1024;
const MIN_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_MB = 10240;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 365;

interface SettingsFormProps {
  settings: Settings;
  onSaved: (settings: Settings) => void;
}

export function SettingsForm({ settings, onSaved }: SettingsFormProps) {
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(String(settings.maxFileSize / BYTES_PER_MB));
  const [historyEnabled, setHistoryEnabled] = useState(settings.historyEnabled);
  const [historyRetentionDays, setHistoryRetentionDays] = useState(
    String(settings.historyRetentionDays || 7),
  );

  const [fileSizeError, setFileSizeError] = useState<string | undefined>();
  const [retentionError, setRetentionError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setSaved(false);

    let hasError = false;

    const parsedFileSize = Number(maxFileSizeMb);
    if (
      !Number.isFinite(parsedFileSize) ||
      parsedFileSize < MIN_FILE_SIZE_MB ||
      parsedFileSize > MAX_FILE_SIZE_MB
    ) {
      setFileSizeError(`Informe um valor entre ${MIN_FILE_SIZE_MB} e ${MAX_FILE_SIZE_MB} MB`);
      hasError = true;
    } else {
      setFileSizeError(undefined);
    }

    const parsedRetention = Number(historyRetentionDays);
    if (
      !Number.isFinite(parsedRetention) ||
      parsedRetention < MIN_RETENTION_DAYS ||
      parsedRetention > MAX_RETENTION_DAYS
    ) {
      setRetentionError(
        `Informe um período de retenção entre ${MIN_RETENTION_DAYS} e ${MAX_RETENTION_DAYS} dias`,
      );
      hasError = true;
    } else {
      setRetentionError(undefined);
    }

    if (hasError) return;

    setSubmitting(true);
    try {
      const updated = await updateSettings({
        maxFileSize: Math.round(parsedFileSize * BYTES_PER_MB),
        historyEnabled,
        historyRetentionDays: Math.round(parsedRetention),
      });
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Falha ao salvar as configurações');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-6 rounded-xl border border-line bg-panel p-5 shadow-card"
    >
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:max-w-md">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Arquivos</h2>
        <TextField
          label="Tamanho máximo de arquivos (MB)"
          type="number"
          inputMode="decimal"
          min={MIN_FILE_SIZE_MB}
          max={MAX_FILE_SIZE_MB}
          step="any"
          value={maxFileSizeMb}
          onChange={(e) => setMaxFileSizeMb(e.target.value)}
          error={fileSizeError}
        />
        <p className="text-xs text-ink-muted">
          Limite aplicado a scripts, importações e exportações de dumps.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:max-w-md">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Histórico de Execuções</h2>
        <CheckboxField
          label="Salvar histórico de execuções"
          description="Registra consultas executadas no editor SQL e execuções de scripts."
          checked={historyEnabled}
          onChange={(e) => setHistoryEnabled(e.target.checked)}
        />
        <div className="pt-2">
          <TextField
            label="Tempo máximo de retenção (dias)"
            type="number"
            inputMode="numeric"
            min={MIN_RETENTION_DAYS}
            max={MAX_RETENTION_DAYS}
            value={historyRetentionDays}
            disabled={!historyEnabled}
            onChange={(e) => setHistoryRetentionDays(e.target.value)}
            error={retentionError}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            Registros mais antigos que esse período são excluídos automaticamente antes de cada
            gravação.
          </p>
        </div>
      </div>

      {submitError && (
        <p role="alert" className="text-sm text-danger">
          {submitError}
        </p>
      )}

      {saved && <p className="text-sm text-online">Configurações salvas.</p>}

      <div className="flex sm:justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
