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
    <div className="overflow-x-auto rounded-2xl border border-brand-300/60 bg-white/95 shadow-card backdrop-blur-sm">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-brand-300/50 bg-brand-50/70 font-display text-[10px] font-semibold tracking-wider text-brand-700 uppercase">
          <tr>
            <th className="px-5 py-3.5">Usuário</th>
            <th className="px-5 py-3.5">Papel</th>
            <th className="px-5 py-3.5">Situação</th>
            <th className="px-5 py-3.5 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-300/35">
          {users.map((user) => (
            <tr key={user.id} className="transition-colors hover:bg-brand-50/50">
              <td className="px-5 py-3 font-semibold text-brand-900">{user.username}</td>
              <td className="px-5 py-3">
                <span className="rounded-full border border-brand-300/60 bg-brand-50 px-2.5 py-0.5 font-display text-[10px] font-semibold tracking-wider text-brand-700 uppercase">
                  {user.role}
                </span>
              </td>
              <td className="px-5 py-3 text-[11px] text-brand-700">
                {user.mustChangePassword ? 'Troca de senha pendente' : 'Ativo'}
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
