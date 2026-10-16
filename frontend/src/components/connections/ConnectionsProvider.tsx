'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { listConnections } from '@/services/connections';
import type { Connection } from '@/services/connections';

const STORAGE_KEY = 'dbclient.activeConnectionId';

interface ConnectionsContextValue {
  connections: Connection[];
  loading: boolean;
  error: string | null;
  active: Connection | null;
  selectConnection: (id: number) => void;
  reload: () => Promise<void>;
}

const ConnectionsContext = createContext<ConnectionsContextValue | null>(null);

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setConnections(await listConnections());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar conexões');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (Number.isInteger(stored) && stored > 0) setActiveId(stored);
    void reload();
  }, [reload]);

  const selectConnection = useCallback((id: number) => {
    setActiveId(id);
    window.localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  const active = useMemo(
    () => connections.find((connection) => connection.id === activeId) ?? connections[0] ?? null,
    [connections, activeId],
  );

  const value = useMemo(
    () => ({ connections, loading, error, active, selectConnection, reload }),
    [connections, loading, error, active, selectConnection, reload],
  );

  return <ConnectionsContext.Provider value={value}>{children}</ConnectionsContext.Provider>;
}

export function useConnections(): ConnectionsContextValue {
  const context = useContext(ConnectionsContext);
  if (!context) throw new Error('useConnections deve ser usado dentro de ConnectionsProvider');
  return context;
}
