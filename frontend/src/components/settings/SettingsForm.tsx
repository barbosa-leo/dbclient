'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { updateSettings } from '@/services/settings';
import type { Settings } from '@/services/settings';

const BYTES_PER_MB = 1024 * 1024;
const MIN_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_MB = 10240;

interface SettingsFormProps {
  settings: Settings;
  onSaved: (settings: Settings) => void;
}

export function SettingsForm({ settings, onSaved }: SettingsFormProps) {
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(String(settings.maxFileSize / BYTES_PER_MB));
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setSaved(false);

    const parsed = Number(maxFileSizeMb);
    if (!Number.isFinite(parsed) || parsed < MIN_FILE_SIZE_MB || parsed > MAX_FILE_SIZE_MB) {
      setFieldError(`Informe um valor entre ${MIN_FILE_SIZE_MB} e ${MAX_FILE_SIZE_MB} MB`);
      return;
    }
    setFieldError(undefined);

    setSubmitting(true);
    try {
      const updated = await updateSettings({ maxFileSize: Math.round(parsed * BYTES_PER_MB) });
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
      className="rounded-xl border border-line bg-panel p-5 shadow-card"
    >
      <h2 className="mb-5 text-sm font-semibold tracking-tight text-ink">Arquivos</h2>
      <div className="grid gap-4 sm:max-w-sm">
        <TextField
          label="Tamanho máximo de arquivos (MB)"
          type="number"
          inputMode="decimal"
          min={MIN_FILE_SIZE_MB}
          max={MAX_FILE_SIZE_MB}
          step="any"
          value={maxFileSizeMb}
          onChange={(e) => setMaxFileSizeMb(e.target.value)}
          error={fieldError}
        />
        <p className="text-xs text-ink-muted">
          Limite aplicado a scripts, importações e exportações de dumps.
        </p>
      </div>
      {submitError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {submitError}
        </p>
      )}
      {saved && <p className="mt-4 text-sm text-online">Configurações salvas.</p>}
      <div className="mt-6 flex sm:justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}

