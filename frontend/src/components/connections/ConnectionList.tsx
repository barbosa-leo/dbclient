import { Button } from '@/components/ui/Button';
import type { Connection } from '@/services/connections';

interface ConnectionListProps {
  connections: Connection[];
  activeConnectionId: number | null;
  canManage: boolean;
  onAccess: (connection: Connection) => void;
  onEdit: (connection: Connection) => void;
  onDelete: (connection: Connection) => void;
}

export function ConnectionList({
  connections,
  activeConnectionId,
  canManage,
  onAccess,
  onEdit,
  onDelete,
}: ConnectionListProps) {
  if (connections.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-panel p-8 text-center text-xs font-medium text-ink-muted shadow-card">
        Nenhuma conexão cadastrada neste environment.
      </p>
    );
  }

  return (
    <div className="min-h-0 overflow-auto rounded-xl border border-line bg-panel shadow-card">
      <table className="w-full text-left text-xs leading-tight">
        <thead className="sticky top-0 z-10 border-b border-line bg-subtle text-[11px] font-medium text-ink-muted">
          <tr>
            <th className="px-4 py-1.5">Nome</th>
            <th className="px-4 py-1.5">Host</th>
            <th className="px-4 py-1.5">Database</th>
            <th className="px-4 py-1.5">Usuário</th>
            <th className="px-4 py-1.5">SSL</th>
            <th className="px-4 py-1.5 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {connections.map((connection) => {
            const isActive = connection.id === activeConnectionId;
            return (
              <tr key={connection.id} className="transition-colors hover:bg-muted/50">
                <td className="px-4 py-1.5 font-semibold text-ink">
                  <div className="flex items-center gap-2">
                    <span>{connection.name}</span>
                    {isActive && (
                      <span className="rounded bg-online/15 px-1.5 py-0.2 font-sans text-[10px] font-semibold text-online">
                        Ativa
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-1.5 font-mono text-[11px] text-ink-secondary">
                  {connection.host}:{connection.port}
                </td>
                <td className="px-4 py-1.5 font-mono text-[11px] text-ink">
                  {connection.database}
                </td>
                <td className="px-4 py-1.5 font-mono text-[11px] text-ink-secondary">
                  {connection.username}
                </td>
                <td className="px-4 py-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] font-medium text-ink-secondary">
                    {connection.sslMode}
                  </span>
                </td>
                <td className="flex justify-end gap-1.5 px-4 py-1">
                  <Button
                    variant={isActive ? 'secondary' : 'primary'}
                    className="px-2.5 py-1 text-[11px]"
                    onClick={() => onAccess(connection)}
                  >
                    Acessar
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        variant="secondary"
                        className="px-2.5 py-1 text-[11px]"
                        onClick={() => onEdit(connection)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        className="px-2.5 py-1 text-[11px]"
                        onClick={() => onDelete(connection)}
                      >
                        Excluir
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

