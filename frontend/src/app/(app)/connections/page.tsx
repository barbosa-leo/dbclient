'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { ConnectionForm } from '@/components/connections/ConnectionForm';
import { ConnectionList } from '@/components/connections/ConnectionList';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import {
  createEnvironment,
  deleteConnection,
  deleteEnvironment,
} from '@/services/connections';
import type { Connection } from '@/services/connections';

type Editing = Connection | 'new' | null;

export default function ConnectionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    environments,
    activeEnvironment,
    selectEnvironment,
    connections,
    active,
    accessConnection,
    loading,
    error,
    reload,
  } = useConnections();
  const [editing, setEditing] = useState<Editing>(null);
  const [creatingEnv, setCreatingEnv] = useState(false);
  const [envName, setEnvName] = useState('');
  const [envError, setEnvError] = useState<string | null>(null);
  const [submittingEnv, setSubmittingEnv] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const canManage = user?.role === 'admin';

  async function handleSaved() {
    setEditing(null);
    await reload();
  }

  async function handleCreateEnv(event: FormEvent) {
    event.preventDefault();
    const trimmed = envName.trim();
    if (!trimmed) {
      setEnvError('Informe o nome do environment');
      return;
    }
    setEnvError(null);
    setSubmittingEnv(true);
    try {
      const created = await createEnvironment(trimmed);
      setEnvName('');
      setCreatingEnv(false);
      await reload();
      selectEnvironment(created.id);
    } catch (err) {
      setEnvError(err instanceof Error ? err.message : 'Falha ao criar environment');
    } finally {
      setSubmittingEnv(false);
    }
  }

  async function handleDeleteEnv() {
    if (!activeEnvironment) return;
    if (
      !window.confirm(
        `Excluir o environment "${activeEnvironment.name}"?`,
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await deleteEnvironment(activeEnvironment.id);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao excluir environment');
    }
  }

  async function handleAccess(connection: Connection) {
    setActionError(null);
    try {
      await accessConnection(connection);
      router.push('/explorer');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao acessar a conexão');
    }
  }

  async function handleDelete(connection: Connection) {
    if (!window.confirm(`Excluir a conexão "${connection.name}"?`)) return;
    setActionError(null);
    try {
      await deleteConnection(connection.id);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao excluir a conexão');
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Conexões"
          description={
            activeEnvironment
              ? `Conexões do environment ${activeEnvironment.name}.`
              : 'Agrupe e gerencie as conexões PostgreSQL por environment.'
          }
        />
        {canManage && editing === null && (
          <div className="flex items-center gap-2">
            {!creatingEnv && (
              <Button variant="secondary" onClick={() => setCreatingEnv(true)}>
                Novo environment
              </Button>
            )}
            <Button
              disabled={environments.length === 0}
              onClick={() => setEditing('new')}
            >
              Nova conexão
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-ink-muted">Environment:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {environments.map((env) => {
              const selected = env.id === activeEnvironment?.id;
              return (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => selectEnvironment(env.id)}
                  className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-cta text-cta-fg shadow-card'
                      : 'bg-subtle text-ink-secondary hover:bg-muted hover:text-ink'
                  }`}
                >
                  {env.name}
                </button>
              );
            })}
            {environments.length === 0 && (
              <span className="text-xs text-ink-muted">Nenhum environment cadastrado</span>
            )}
          </div>
        </div>

        {canManage && activeEnvironment && environments.length > 1 && (
          <Button
            variant="danger"
            className="px-2.5 py-1 text-[11px]"
            onClick={() => void handleDeleteEnv()}
          >
            Excluir environment
          </Button>
        )}
      </div>

      {creatingEnv && (
        <form
          onSubmit={handleCreateEnv}
          noValidate
          className="rounded-xl border border-line bg-panel p-5 shadow-card"
        >
          <h2 className="mb-4 text-sm font-semibold tracking-tight text-ink">
            Novo environment
          </h2>
          <div className="max-w-md">
            <TextField
              label="Nome do environment"
              placeholder="Ex.: Production, Staging, Development"
              value={envName}
              onChange={(e) => setEnvName(e.target.value)}
              error={envError ?? undefined}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreatingEnv(false);
                setEnvName('');
                setEnvError(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submittingEnv}>
              {submittingEnv ? 'Salvando...' : 'Criar'}
            </Button>
          </div>
        </form>
      )}

      {editing !== null && (
        <ConnectionForm
          key={editing === 'new' ? 'new' : editing.id}
          connection={editing === 'new' ? null : editing}
          environments={environments}
          defaultEnvironmentId={activeEnvironment?.id ?? null}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      {(error ?? actionError) && (
        <p role="alert" className="text-sm text-danger">
          {error ?? actionError}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-ink-muted">Carregando...</p>
      ) : (
        <ConnectionList
          connections={connections}
          activeConnectionId={active?.id ?? null}
          canManage={canManage}
          onAccess={(conn) => void handleAccess(conn)}
          onEdit={setEditing}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

