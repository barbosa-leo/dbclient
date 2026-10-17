'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { listConnections, listEnvironments } from '@/services/connections';
import type { Connection, Environment } from '@/services/connections';

const CONNECTION_STORAGE_KEY = 'dbclient.activeConnectionId';
const ENVIRONMENT_STORAGE_KEY = 'dbclient.activeEnvironmentId';

interface ConnectionsContextValue {
  environments: Environment[];
  activeEnvironment: Environment | null;
  selectEnvironment: (id: number) => void;
  connections: Connection[];
  allConnections: Connection[];
  loading: boolean;
  error: string | null;
  active: Connection | null;
  selectConnection: (id: number) => void;
  accessConnection: (connection: Connection) => Promise<void>;
  contextRevision: number;
  reload: () => Promise<void>;
}

const ConnectionsContext = createContext<ConnectionsContextValue | null>(null);

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<number | null>(null);
  const [allConnections, setAllConnections] = useState<Connection[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [contextRevision, setContextRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [envs, conns] = await Promise.all([listEnvironments(), listConnections()]);
      setEnvironments(envs);
      setAllConnections(conns);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar conexões');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedEnv = Number(window.localStorage.getItem(ENVIRONMENT_STORAGE_KEY));
    if (Number.isInteger(storedEnv) && storedEnv > 0) setActiveEnvironmentId(storedEnv);
    const storedConn = Number(window.localStorage.getItem(CONNECTION_STORAGE_KEY));
    if (Number.isInteger(storedConn) && storedConn > 0) setActiveId(storedConn);
    void reload();
  }, [reload]);

  const activeEnvironment = useMemo(
    () =>
      environments.find((env) => env.id === activeEnvironmentId) ?? environments[0] ?? null,
    [environments, activeEnvironmentId],
  );

  const connections = useMemo(() => {
    if (!activeEnvironment) return allConnections;
    return allConnections.filter((conn) => conn.environmentId === activeEnvironment.id);
  }, [allConnections, activeEnvironment]);

  const active = useMemo(
    () => allConnections.find((connection) => connection.id === activeId) ?? null,
    [allConnections, activeId],
  );

  const selectEnvironment = useCallback((id: number) => {
    setActiveEnvironmentId(id);
    window.localStorage.setItem(ENVIRONMENT_STORAGE_KEY, String(id));
  }, []);

  const selectConnection = useCallback(
    (id: number) => {
      const target = allConnections.find((conn) => conn.id === id);
      if (target) {
        setActiveEnvironmentId(target.environmentId);
        window.localStorage.setItem(ENVIRONMENT_STORAGE_KEY, String(target.environmentId));
      }
      setActiveId(id);
      window.localStorage.setItem(CONNECTION_STORAGE_KEY, String(id));
      setContextRevision((prev) => prev + 1);
    },
    [allConnections],
  );

  const accessConnection = useCallback(
    async (connection: Connection) => {
      setActiveEnvironmentId(connection.environmentId);
      window.localStorage.setItem(ENVIRONMENT_STORAGE_KEY, String(connection.environmentId));
      setActiveId(connection.id);
      window.localStorage.setItem(CONNECTION_STORAGE_KEY, String(connection.id));
      await reload();
      setContextRevision((prev) => prev + 1);
    },
    [reload],
  );

  const value = useMemo(
    () => ({
      environments,
      activeEnvironment,
      selectEnvironment,
      connections,
      allConnections,
      loading,
      error,
      active,
      selectConnection,
      accessConnection,
      contextRevision,
      reload,
    }),
    [
      environments,
      activeEnvironment,
      selectEnvironment,
      connections,
      allConnections,
      loading,
      error,
      active,
      selectConnection,
      accessConnection,
      contextRevision,
      reload,
    ],
  );

  return <ConnectionsContext.Provider value={value}>{children}</ConnectionsContext.Provider>;
}

export function useConnections(): ConnectionsContextValue {
  const context = useContext(ConnectionsContext);
  if (!context) throw new Error('useConnections deve ser usado dentro de ConnectionsProvider');
  return context;
}

