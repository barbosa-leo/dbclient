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
    <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-line bg-subtle text-xs font-medium text-ink-muted">
          <tr>
            <th className="px-5 py-3">Usuário</th>
            <th className="px-5 py-3">Papel</th>
            <th className="px-5 py-3">Situação</th>
            <th className="px-5 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {users.map((user) => (
            <tr key={user.id} className="transition-colors hover:bg-muted/50">
              <td className="px-5 py-3 font-semibold text-ink">{user.username}</td>
              <td className="px-5 py-3">
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-ink-secondary uppercase">
                  {user.role}
                </span>
              </td>
              <td className="px-5 py-3 text-[11px] text-ink-secondary">
                {user.mustChangePassword ? (
                  <span className="text-ink-muted">Troca de senha pendente</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-ink">
                    <span className="h-1.5 w-1.5 rounded-full bg-online" />
                    Ativo
                  </span>
                )}
              </td>
              <td className="flex justify-end gap-2 px-5 py-2.5">
                <Button variant="secondary" onClick={() => onEdit(user)}>
                  Editar
                </Button>
                <Button
                  variant="danger"
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
