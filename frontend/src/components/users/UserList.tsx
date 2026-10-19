import { Button } from '@/components/ui/Button';
import type { User } from '@/services/auth';

interface UserListProps {
  users: User[];
  currentUserId: number | undefined;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

function UserStatus({ user }: { user: User }) {
  if (user.mustChangePassword) {
    return <span className="text-ink-muted">Troca de senha pendente</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-ink">
      <span className="h-1.5 w-1.5 rounded-full bg-online" />
      Ativo
    </span>
  );
}

export function UserList({ users, currentUserId, onEdit, onDelete }: UserListProps) {
  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {users.map((user) => (
          <li key={user.id} className="rounded-xl border border-line bg-panel p-3 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 text-sm font-semibold break-words text-ink">{user.name}</span>
              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium text-ink-secondary uppercase">
                {user.role}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] break-all text-ink-secondary">{user.email}</p>
            <p className="mt-0.5 text-[11px] text-ink-secondary">
              <UserStatus user={user} />
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="min-h-10" onClick={() => onEdit(user)}>
                Editar
              </Button>
              <Button
                variant="danger"
                className="min-h-10"
                disabled={user.id === currentUserId}
                onClick={() => onDelete(user)}
              >
                Excluir
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden min-h-0 overflow-auto rounded-xl border border-line bg-panel shadow-card md:block">
        <table className="w-full text-left text-xs leading-tight">
          <thead className="sticky top-0 z-10 border-b border-line bg-subtle text-[11px] font-medium text-ink-muted">
            <tr>
              <th className="px-4 py-1.5">Nome</th>
              <th className="px-4 py-1.5">E-mail</th>
              <th className="px-4 py-1.5">Papel</th>
              <th className="px-4 py-1.5">Situação</th>
              <th className="px-4 py-1.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((user) => (
              <tr key={user.id} className="transition-colors hover:bg-muted/50">
                <td className="px-4 py-1.5 font-semibold text-ink">{user.name}</td>
                <td className="px-4 py-1.5 font-mono text-ink-secondary">{user.email}</td>
                <td className="px-4 py-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium text-ink-secondary uppercase">
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-1.5 text-[11px] text-ink-secondary">
                  <UserStatus user={user} />
                </td>
                <td className="px-4 py-1">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="secondary"
                      className="px-2.5 py-1 text-[11px]"
                      onClick={() => onEdit(user)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      className="px-2.5 py-1 text-[11px]"
                      disabled={user.id === currentUserId}
                      onClick={() => onDelete(user)}
                    >
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
