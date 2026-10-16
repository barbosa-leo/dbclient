'use client';

import Link from 'next/link';
import { useConnections } from '@/components/connections/ConnectionsProvider';

export function ConnectionSelector() {
  const { connections, loading, active, selectConnection } = useConnections();

  if (loading) return null;

  if (connections.length === 0) {
    return (
      <Link
        href="/connections"
        className="text-xs font-medium text-ink-secondary underline decoration-line-strong underline-offset-4 hover:text-ink"
      >
        Nenhuma conexão cadastrada
      </Link>
    );
  }

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-medium text-ink-muted">Conexão</span>
      <select
        value={active?.id ?? ''}
        onChange={(e) => selectConnection(Number(e.target.value))}
        className="h-8 cursor-pointer rounded-lg border border-line bg-panel px-2.5 text-xs font-medium text-ink transition-colors outline-none hover:bg-muted focus:border-line-strong"
      >
        {connections.map((connection) => (
          <option key={connection.id} value={connection.id}>
            {connection.name} · {connection.database}
          </option>
        ))}
      </select>
    </label>
  );
}
