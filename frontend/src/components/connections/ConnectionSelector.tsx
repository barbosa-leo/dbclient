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
        className="text-xs font-medium text-primary-strong underline decoration-brand-300 underline-offset-4 hover:text-brand-900"
      >
        Nenhuma conexão cadastrada
      </Link>
    );
  }

  return (
    <label className="flex items-center gap-2.5">
      <span className="font-display text-[10px] font-semibold tracking-widest text-brand-700/80 uppercase">
        Conexão
      </span>
      <select
        value={active?.id ?? ''}
        onChange={(e) => selectConnection(Number(e.target.value))}
        className="cursor-pointer rounded-lg border border-brand-300/70 bg-white px-3 py-1.5 text-xs font-medium text-brand-900 shadow-xs transition-all outline-none hover:border-brand-500/60 focus:border-primary focus:ring-2 focus:ring-accent/60"
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
