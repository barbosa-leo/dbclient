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
    <div className="overflow-x-auto rounded-xl border border-brand-300 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-900 text-brand-50">
          <tr>
            <th className="px-4 py-3 font-medium">Usuário</th>
            <th className="px-4 py-3 font-medium">Papel</th>
            <th className="px-4 py-3 font-medium">Situação</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-brand-300">
              <td className="px-4 py-3 font-medium text-brand-900">{user.username}</td>
              <td className="px-4 py-3">{user.role}</td>
              <td className="px-4 py-3">{user.mustChangePassword ? 'Troca de senha pendente' : 'Ativo'}</td>
              <td className="flex justify-end gap-2 px-4 py-3">
                <Button variant="secondary" onClick={() => onEdit(user)}>
                  Editar
                </Button>
                <Button variant="danger" disabled={user.id === currentUserId} onClick={() => onDelete(user)}>
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
