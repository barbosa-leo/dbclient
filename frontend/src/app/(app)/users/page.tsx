'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { UserForm } from '@/components/users/UserForm';
import { UserList } from '@/components/users/UserList';
import type { User } from '@/services/auth';
import { listEnvironments, type Environment } from '@/services/connections';
import { deleteUser, listUsers } from '@/services/users';

type Editing = User | 'new' | null;

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [users, setUsers] = useState<User[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  const reload = useCallback(async () => {
    try {
      const [usersData, envsData] = await Promise.all([listUsers(), listEnvironments()]);
      setUsers(usersData);
      setEnvironments(envsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void reload();
  }, [isAdmin, reload]);

  async function handleSaved() {
    setEditing(null);
    await reload();
  }

  async function handleDelete(target: User) {
    if (!window.confirm(`Excluir o usuário "${target.name}" (${target.email})?`)) return;
    try {
      await deleteUser(target.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir o usuário');
    }
  }

  if (!isAdmin) {
    return (
      <PageHeader title="Usuários" description="Apenas administradores podem gerenciar usuários." />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Usuários" description="Gerencie os usuários da plataforma." />
        {editing === null && <Button onClick={() => setEditing('new')}>Novo usuário</Button>}
      </div>

      {editing !== null && (
        <UserForm
          key={editing === 'new' ? 'new' : editing.id}
          user={editing === 'new' ? null : editing}
          environments={environments}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-ink-muted">Carregando...</p>
      ) : (
        <UserList
          users={users}
          environments={environments}
          currentUserId={currentUser?.id}
          onEdit={setEditing}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
