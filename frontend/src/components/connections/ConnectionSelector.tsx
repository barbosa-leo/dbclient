'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';

export function ConnectionSelector() {
  const {
    environments,
    activeEnvironment,
    selectEnvironment,
    connections,
    loading,
    active,
    accessConnection,
  } = useConnections();

  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
    active ? String(active.id) : '',
  );
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (
      active &&
      connections.some((conn) => conn.id === active.id)
    ) {
      setSelectedConnectionId(String(active.id));
    } else {
      setSelectedConnectionId('');
    }
  }, [active, activeEnvironment?.id, connections]);

  if (loading) return null;

  const targetConnection =
    connections.find((conn) => String(conn.id) === selectedConnectionId) ?? null;
  const canConnect = targetConnection !== null && !connecting;

  async function handleConnect() {
    if (!targetConnection) return;
    setConnecting(true);
    try {
      await accessConnection(targetConnection);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2">
        <span className="text-xs font-medium text-ink-muted">Environment</span>
        <select
          value={activeEnvironment?.id ?? ''}
          onChange={(e) => selectEnvironment(Number(e.target.value))}
          disabled={environments.length === 0}
          className="h-8 cursor-pointer rounded-lg border border-line bg-panel px-2.5 text-xs font-medium text-ink transition-colors outline-none hover:bg-muted focus:border-line-strong disabled:opacity-50"
        >
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
      </label>

      {connections.length === 0 ? (
        <Link
          href="/connections"
          className="text-xs font-medium text-ink-secondary underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          Nenhuma conexão neste environment
        </Link>
      ) : (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-muted">Conexão</span>
            <select
              value={selectedConnectionId}
              onChange={(e) => setSelectedConnectionId(e.target.value)}
              className="h-8 cursor-pointer rounded-lg border border-line bg-panel px-2.5 text-xs font-medium text-ink transition-colors outline-none hover:bg-muted focus:border-line-strong"
            >
              <option value="">Selecione uma conexão...</option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name} · {connection.database}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={!canConnect}
            onClick={() => void handleConnect()}
            className="h-8 cursor-pointer rounded-lg bg-cta px-3 text-xs font-semibold text-cta-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {connecting ? 'Conectando...' : 'Conectar'}
          </button>
        </div>
      )}
    </div>
  );
}


