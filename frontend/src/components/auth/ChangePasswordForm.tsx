'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { changePassword } from '@/services/auth';

const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordForm() {
  const { refresh } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }
    if (next !== confirmation) {
      setError('A confirmação não confere com a nova senha');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(current, next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao trocar a senha');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Defina uma nova senha">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Senha atual"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
        <TextField
          label="Nova senha"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          required
        />
        <TextField
          label="Confirmar nova senha"
          type="password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="new-password"
          required
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar senha'}
        </Button>
      </form>
    </AuthCard>
  );
}
