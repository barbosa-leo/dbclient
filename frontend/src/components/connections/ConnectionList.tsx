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
      <p className="rounded-xl border border-dashed border-line bg-panel p-10 text-center text-xs font-medium text-ink-muted shadow-card">
        Nenhuma conexão cadastrada.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-line bg-subtle text-xs font-medium text-ink-muted">
          <tr>
            <th className="px-5 py-3">Nome</th>
            <th className="px-5 py-3">Host</th>
            <th className="px-5 py-3">Database</th>
            <th className="px-5 py-3">Usuário</th>
            <th className="px-5 py-3">SSL</th>
            {canManage && <th className="px-5 py-3 text-right">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {connections.map((connection) => (
            <tr key={connection.id} className="transition-colors hover:bg-muted/50">
              <td className="px-5 py-3 font-semibold text-ink">{connection.name}</td>
              <td className="px-5 py-3 font-mono text-[11px] text-ink-secondary">
                {connection.host}:{connection.port}
              </td>
              <td className="px-5 py-3 font-mono text-[11px] text-ink">
                {connection.database}
              </td>
              <td className="px-5 py-3 font-mono text-[11px] text-ink-secondary">
                {connection.username}
              </td>
              <td className="px-5 py-3">
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-ink-secondary">
                  {connection.sslMode}
                </span>
              </td>
              {canManage && (
                <td className="flex justify-end gap-2 px-5 py-2.5">
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
