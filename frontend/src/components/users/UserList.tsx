import { Button } from '@/components/ui/Button';
import type { User } from '@/services/auth';

interface UserListProps {
  users: User[];
  currentUserId: number | undefined;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export function UserList({ users, currentUserId, onEdit, onDelete }: UserListProps) {
  return (
    <div className="min-h-0 overflow-auto rounded-xl border border-line bg-panel shadow-card">
      <table className="w-full text-left text-xs leading-tight">
        <thead className="sticky top-0 z-10 border-b border-line bg-subtle text-[11px] font-medium text-ink-muted">
          <tr>
            <th className="px-4 py-1.5">Usuário</th>
            <th className="px-4 py-1.5">Papel</th>
            <th className="px-4 py-1.5">Situação</th>
            <th className="px-4 py-1.5 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {users.map((user) => (
            <tr key={user.id} className="transition-colors hover:bg-muted/50">
              <td className="px-4 py-1.5 font-semibold text-ink">{user.username}</td>
              <td className="px-4 py-1.5">
                <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium text-ink-secondary uppercase">
                  {user.role}
                </span>
              </td>
              <td className="px-4 py-1.5 text-[11px] text-ink-secondary">
                {user.mustChangePassword ? (
                  <span className="text-ink-muted">Troca de senha pendente</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-ink">
                    <span className="h-1.5 w-1.5 rounded-full bg-online" />
                    Ativo
                  </span>
                )}
              </td>
              <td className="flex justify-end gap-1.5 px-4 py-1">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
