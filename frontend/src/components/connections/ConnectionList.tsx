import { Fragment, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { testConnectionById } from '@/services/connections';
import type { Connection } from '@/services/connections';

interface ConnectionListProps {
  connections: Connection[];
  activeConnectionId: number | null;
  canManage: boolean;
  onAccess: (connection: Connection) => void;
  onEdit: (connection: Connection) => void;
  onDelete: (connection: Connection) => void;
}

interface TestStatus {
  loading?: boolean;
  ok?: boolean;
  error?: string;
}

function StatusBadges({ isActive, status }: { isActive: boolean; status?: TestStatus }) {
  return (
    <>
      {isActive && (
        <span className="rounded bg-online/15 px-1.5 py-0.2 font-sans text-[10px] font-semibold text-online">
          Ativa
        </span>
      )}
      {status?.loading && (
        <span className="rounded bg-muted px-1.5 py-0.2 font-sans text-[10px] font-medium text-ink-muted">
          Testando...
        </span>
      )}
      {status?.ok === true && (
        <span className="rounded bg-online/15 px-1.5 py-0.2 font-sans text-[10px] font-semibold text-online">
          Online
        </span>
      )}
      {status?.ok === false && (
        <span className="rounded bg-danger/15 px-1.5 py-0.2 font-sans text-[10px] font-semibold text-danger">
          Falha
        </span>
      )}
    </>
  );
}

export function ConnectionList({
  connections,
  activeConnectionId,
  canManage,
  onAccess,
  onEdit,
  onDelete,
}: ConnectionListProps) {
  const [testStatuses, setTestStatuses] = useState<Record<number, TestStatus>>({});

  async function handleTest(connectionId: number) {
    setTestStatuses((prev) => ({
      ...prev,
      [connectionId]: { loading: true },
    }));
    try {
      const res = await testConnectionById(connectionId);
      setTestStatuses((prev) => ({
        ...prev,
        [connectionId]: {
          loading: false,
          ok: res.ok,
          error: res.error,
        },
      }));
    } catch (err) {
      setTestStatuses((prev) => ({
        ...prev,
        [connectionId]: {
          loading: false,
          ok: false,
          error: err instanceof Error ? err.message : 'Falha ao testar conexão',
        },
      }));
    }
  }

  if (connections.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-panel p-8 text-center text-xs font-medium text-ink-muted shadow-card">
        Nenhuma conexão cadastrada neste environment.
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {connections.map((connection) => {
          const isActive = connection.id === activeConnectionId;
          const testStatus = testStatuses[connection.id];
          return (
            <li
              key={connection.id}
              className="rounded-xl border border-line bg-panel p-3 shadow-card"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                <span className="min-w-0 break-words">{connection.name}</span>
                <StatusBadges isActive={isActive} status={testStatus} />
              </div>
              <p className="mt-1 font-mono text-[11px] break-all text-ink-secondary">
                {connection.host}:{connection.port} · {connection.database}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                {connection.username} · ssl {connection.sslMode}
              </p>
              {testStatus?.ok === false && testStatus.error && (
                <p className="mt-2 rounded-md bg-danger/5 p-2 font-mono text-[11px] break-words text-danger">
                  <span className="font-semibold">Erro de conexão: </span>
                  {testStatus.error}
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant={isActive ? 'secondary' : 'primary'}
                  className="min-h-10"
                  onClick={() => onAccess(connection)}
                >
                  Acessar
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-10"
                  disabled={testStatus?.loading}
                  onClick={() => void handleTest(connection.id)}
                >
                  {testStatus?.loading ? 'Testando...' : 'Testar'}
                </Button>
                {canManage && (
                  <>
                    <Button
                      variant="secondary"
                      className="min-h-10"
                      onClick={() => onEdit(connection)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      className="min-h-10"
                      onClick={() => onDelete(connection)}
                    >
                      Excluir
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden min-h-0 overflow-auto rounded-xl border border-line bg-panel shadow-card md:block">
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
              const testStatus = testStatuses[connection.id];
              return (
                <Fragment key={connection.id}>
                  <tr className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-1.5 font-semibold text-ink">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{connection.name}</span>
                        <StatusBadges isActive={isActive} status={testStatus} />
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
                    <td className="px-4 py-1">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          className="px-2.5 py-1 text-[11px]"
                          disabled={testStatus?.loading}
                          onClick={() => void handleTest(connection.id)}
                        >
                          {testStatus?.loading ? 'Testando...' : 'Testar'}
                        </Button>
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
                      </div>
                    </td>
                  </tr>
                  {testStatus?.ok === false && testStatus.error && (
                    <tr className="border-b border-danger/20 bg-danger/5">
                      <td colSpan={6} className="px-4 py-2 font-mono text-[11px] text-danger">
                        <span className="font-semibold">Erro de conexão: </span>
                        {testStatus.error}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
