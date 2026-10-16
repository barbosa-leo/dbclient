'use client';

import { useEffect, useState } from 'react';
import { listDatabases } from '@/services/connections';
import type { Connection } from '@/services/connections';

export function useConnectionDatabases(active: Connection | null) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState('');

  useEffect(() => {
    if (!active) {
      setDatabases([]);
      setSelectedDatabase('');
      return;
    }
    let cancelled = false;
    setSelectedDatabase(active.database);
    setDatabases([active.database]);

    listDatabases(active.id)
      .then((items) => {
        if (cancelled) return;
        const nextList = items.length > 0 ? items : [active.database];
        setDatabases(nextList);
        setSelectedDatabase(
          nextList.includes(active.database) ? active.database : (nextList[0] ?? active.database),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setDatabases([active.database]);
          setSelectedDatabase(active.database);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active]);

  return {
    databases,
    selectedDatabase,
    setSelectedDatabase,
  };
}
