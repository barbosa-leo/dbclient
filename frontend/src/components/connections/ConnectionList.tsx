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
      <p className="rounded-2xl border border-dashed border-brand-300/80 bg-white/60 p-10 text-center text-xs font-medium text-brand-700 shadow-card">
        Nenhuma conexão cadastrada.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-300/60 bg-white/95 shadow-card backdrop-blur-sm">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-brand-300/50 bg-brand-50/70 font-display text-[10px] font-semibold tracking-wider text-brand-700 uppercase">
          <tr>
            <th className="px-5 py-3.5">Nome</th>
            <th className="px-5 py-3.5">Host</th>
            <th className="px-5 py-3.5">Database</th>
            <th className="px-5 py-3.5">Usuário</th>
            <th className="px-5 py-3.5">SSL</th>
            {canManage && <th className="px-5 py-3.5 text-right">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-300/35">
          {connections.map((connection) => (
            <tr key={connection.id} className="transition-colors hover:bg-brand-50/50">
              <td className="px-5 py-3 font-semibold text-brand-900">{connection.name}</td>
              <td className="px-5 py-3 font-mono text-[11px] text-brand-700">
                {connection.host}:{connection.port}
              </td>
              <td className="px-5 py-3 font-mono text-[11px] text-brand-900">
                {connection.database}
              </td>
              <td className="px-5 py-3 font-mono text-[11px] text-brand-700">
                {connection.username}
              </td>
              <td className="px-5 py-3">
                <span className="rounded-full border border-brand-300/60 bg-brand-50 px-2.5 py-0.5 font-mono text-[10px] font-medium text-brand-700">
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
