'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { validateConnection } from '@/components/connections/validation';
import type { ConnectionFormErrors, ConnectionFormValues } from '@/components/connections/validation';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import {
  createConnection,
  sslModes,
  testConnection,
  updateConnection,
} from '@/services/connections';
import type { Connection, Environment, SslMode } from '@/services/connections';

interface ConnectionFormProps {
  connection: Connection | null;
  environments: Environment[];
  defaultEnvironmentId: number | null;
  onSaved: () => void;
  onCancel: () => void;
}

function initialValues(
  connection: Connection | null,
  environments: Environment[],
  defaultEnvironmentId: number | null,
): ConnectionFormValues {
  const envId =
    connection?.environmentId ?? defaultEnvironmentId ?? environments[0]?.id ?? '';
  return {
    environmentId: String(envId),
    name: connection?.name ?? '',
    host: connection?.host ?? '',
    port: String(connection?.port ?? 5432),
    database: connection?.database ?? '',
    username: connection?.username ?? '',
    password: '',
    sslMode: connection?.sslMode ?? 'prefer',
  };
}

export function ConnectionForm({
  connection,
  environments,
  defaultEnvironmentId,
  onSaved,
  onCancel,
}: ConnectionFormProps) {
  const [values, setValues] = useState(() =>
    initialValues(connection, environments, defaultEnvironmentId),
  );
  const [errors, setErrors] = useState<ConnectionFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const isEditing = connection !== null;

  function setField<K extends keyof ConnectionFormValues>(key: K, value: ConnectionFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleTestConnection() {
    setTestResult(null);
    setSubmitError(null);

    const port = Number(values.port);
    if (
      !values.host.trim() ||
      !values.database.trim() ||
      !values.username.trim() ||
      !values.port.trim() ||
      isNaN(port) ||
      port <= 0 ||
      port > 65535
    ) {
      setTestResult({
        ok: false,
        message: 'Preencha corretamente Host, Porta (1-65535), Database e Usuário para testar a conexão.',
      });
      return;
    }

    if (!values.password) {
      setTestResult({
        ok: false,
        message: 'A senha é obrigatória para testar a conexão.',
      });
      return;
    }

    setTesting(true);
    try {
      const result = await testConnection({
        host: values.host.trim(),
        port,
        database: values.database.trim(),
        username: values.username.trim(),
        password: values.password,
        sslMode: values.sslMode,
      });

      if (result.ok) {
        setTestResult({ ok: true, message: 'Conexão estabelecida com sucesso!' });
      } else {
        setTestResult({
          ok: false,
          message: result.error || 'Falha ao conectar com o banco de dados.',
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Falha ao testar conexão',
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const validation = validateConnection(values, { passwordRequired: !isEditing });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const input = {
      environmentId: Number(values.environmentId),
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="connection-environment" className="text-xs font-medium text-ink">
            Environment
          </label>
          <select
            id="connection-environment"
            value={values.environmentId}
            onChange={(e) => setField('environmentId', e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-line bg-panel px-3 text-xs text-ink transition-colors outline-none hover:border-line-strong focus:border-line-strong"
          >
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
          {errors.environmentId && (
            <span className="text-xs font-medium text-danger">{errors.environmentId}</span>
          )}
        </div>
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
      {!isEditing && testResult && (
        <div
          role="status"
          className={`mt-4 rounded-lg border p-3 text-xs ${
            testResult.ok
              ? 'border-online/30 bg-online/10 text-online'
              : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            <span
              className={`h-2 w-2 rounded-full ${
                testResult.ok ? 'bg-online' : 'bg-danger'
              }`}
            />
            <span>{testResult.ok ? 'Conexão bem-sucedida' : 'Falha na conexão'}</span>
          </div>
          <p className="mt-1 font-mono text-[11px] break-words">{testResult.message}</p>
        </div>
      )}
      {submitError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {submitError}
        </p>
      )}
      <div
        className={`mt-6 flex flex-wrap items-center gap-3 ${
          !isEditing ? 'justify-between' : 'justify-end'
        }`}
      >
        {!isEditing && (
          <Button
            type="button"
            variant="secondary"
            disabled={testing || submitting}
            onClick={() => void handleTestConnection()}
          >
            {testing ? 'Testando conexão...' : 'Testar conexão'}
          </Button>
        )}
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </form>
  );
}

