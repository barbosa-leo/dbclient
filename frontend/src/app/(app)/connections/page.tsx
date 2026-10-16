'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { ConnectionForm } from '@/components/connections/ConnectionForm';
import { ConnectionList } from '@/components/connections/ConnectionList';
import { useConnections } from '@/components/connections/useConnections';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { deleteConnection } from '@/services/connections';
import type { Connection } from '@/services/connections';

type Editing = Connection | 'new' | null;

export default function ConnectionsPage() {
  const { user } = useAuth();
  const { connections, loading, error, reload } = useConnections();
  const [editing, setEditing] = useState<Editing>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const canManage = user?.role === 'admin';

  async function handleSaved() {
    setEditing(null);
    await reload();
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
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Conexões" description="Cadastre e gerencie as conexões PostgreSQL." />
        {canManage && editing === null && <Button onClick={() => setEditing('new')}>Nova conexão</Button>}
      </div>

      {editing !== null && (
        <ConnectionForm
          key={editing === 'new' ? 'new' : editing.id}
          connection={editing === 'new' ? null : editing}
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
        <p className="text-sm text-brand-700">Carregando...</p>
      ) : (
        <ConnectionList
          connections={connections}
          canManage={canManage}
          onEdit={setEditing}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
