'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { validateConnection } from '@/components/connections/validation';
import type { ConnectionFormErrors, ConnectionFormValues } from '@/components/connections/validation';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { createConnection, sslModes, updateConnection } from '@/services/connections';
import type { Connection, SslMode } from '@/services/connections';

interface ConnectionFormProps {
  connection: Connection | null;
  onSaved: () => void;
  onCancel: () => void;
}

function initialValues(connection: Connection | null): ConnectionFormValues {
  return {
    name: connection?.name ?? '',
    host: connection?.host ?? '',
    port: String(connection?.port ?? 5432),
    database: connection?.database ?? '',
    username: connection?.username ?? '',
    password: '',
    sslMode: connection?.sslMode ?? 'prefer',
  };
}

export function ConnectionForm({ connection, onSaved, onCancel }: ConnectionFormProps) {
  const [values, setValues] = useState(() => initialValues(connection));
  const [errors, setErrors] = useState<ConnectionFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = connection !== null;

  function setField<K extends keyof ConnectionFormValues>(key: K, value: ConnectionFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const validation = validateConnection(values, { passwordRequired: !isEditing });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const input = {
      name: values.name.trim(),
      host: values.host.trim(),
      port: Number(values.port),
      database: values.database.trim(),
      username: values.username.trim(),
      sslMode: values.sslMode,
      ...(values.password ? { password: values.password } : {}),
    };

    setSubmitting(true);
    try {
      if (connection) {
        await updateConnection(connection.id, input);
      } else {
        await createConnection(input);
      }
      onSaved();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Falha ao salvar a conexão');
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
      <h2 className="mb-5 text-sm font-semibold tracking-tight text-ink">
        {isEditing ? 'Editar conexão' : 'Nova conexão'}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nome"
          value={values.name}
          onChange={(e) => setField('name', e.target.value)}
          error={errors.name}
        />
        <TextField
          label="Host"
          value={values.host}
          onChange={(e) => setField('host', e.target.value)}
          error={errors.host}
        />
        <TextField
          label="Porta"
          inputMode="numeric"
          value={values.port}
          onChange={(e) => setField('port', e.target.value)}
          error={errors.port}
        />
        <TextField
          label="Database"
          value={values.database}
          onChange={(e) => setField('database', e.target.value)}
          error={errors.database}
        />
        <TextField
          label="Usuário"
          value={values.username}
          onChange={(e) => setField('username', e.target.value)}
          autoComplete="off"
          error={errors.username}
        />
        <TextField
          label={isEditing ? 'Senha (deixe em branco para manter)' : 'Senha'}
          type="password"
          value={values.password}
          onChange={(e) => setField('password', e.target.value)}
          autoComplete="new-password"
          error={errors.password}
        />
        <SelectField
          label="Modo SSL"
          options={sslModes}
          value={values.sslMode}
          onChange={(e) => setField('sslMode', e.target.value as SslMode)}
        />
      </div>
      {submitError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {submitError}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
