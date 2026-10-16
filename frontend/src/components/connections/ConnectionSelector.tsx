'use client';

import Link from 'next/link';
import { useConnections } from '@/components/connections/ConnectionsProvider';

export function ConnectionSelector() {
  const { connections, loading, active, selectConnection } = useConnections();

  if (loading) return null;

  if (connections.length === 0) {
    return (
      <Link href="/connections" className="text-sm text-primary-strong underline">
        Nenhuma conexão cadastrada
      </Link>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm text-brand-700">
      Conexão
      <select
        value={active?.id ?? ''}
        onChange={(e) => selectConnection(Number(e.target.value))}
        className="rounded-md border border-brand-300 bg-white px-3 py-1.5 text-sm text-brand-900 outline-none focus:border-primary focus:ring-2 focus:ring-accent"
      >
        {connections.map((connection) => (
          <option key={connection.id} value={connection.id}>
            {connection.name}
          </option>
        ))}
      </select>
    </label>
  );
}
