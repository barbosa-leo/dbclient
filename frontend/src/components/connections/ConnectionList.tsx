import { Button } from '@/components/ui/Button';
import type { Connection } from '@/services/connections';

interface ConnectionListProps {
  connections: Connection[];
  canManage: boolean;
  onEdit: (connection: Connection) => void;
  onDelete: (connection: Connection) => void;
}

export function ConnectionList({ connections, canManage, onEdit, onDelete }: ConnectionListProps) {
  if (connections.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-brand-300 p-8 text-center text-sm text-brand-700">
        Nenhuma conexão cadastrada.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-300 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-900 text-brand-50">
          <tr>
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Host</th>
            <th className="px-4 py-3 font-medium">Database</th>
            <th className="px-4 py-3 font-medium">Usuário</th>
            <th className="px-4 py-3 font-medium">SSL</th>
            {canManage && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {connections.map((connection) => (
            <tr key={connection.id} className="border-t border-brand-300">
              <td className="px-4 py-3 font-medium text-brand-900">{connection.name}</td>
              <td className="px-4 py-3">
                {connection.host}:{connection.port}
              </td>
              <td className="px-4 py-3">{connection.database}</td>
              <td className="px-4 py-3">{connection.username}</td>
              <td className="px-4 py-3">{connection.sslMode}</td>
              {canManage && (
                <td className="flex justify-end gap-2 px-4 py-3">
                  <Button variant="secondary" onClick={() => onEdit(connection)}>
                    Editar
                  </Button>
                  <Button variant="danger" onClick={() => onDelete(connection)}>
                    Excluir
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
