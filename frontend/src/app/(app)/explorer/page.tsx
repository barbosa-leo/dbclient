'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { SchemaTree } from '@/components/explorer/SchemaTree';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { listSchemas } from '@/services/explorer';
import type { SchemaInfo } from '@/services/explorer';

export default function ExplorerPage() {
  const { active } = useConnections();
  const activeId = active?.id;
  const [schemas, setSchemas] = useState<SchemaInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (activeId === undefined) return;
    setLoading(true);
    setError(null);
    setSchemas(null);
    try {
      setSchemas(await listSchemas(activeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar os schemas');
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Explorador"
          description={
            active
              ? `Schemas e tabelas de ${active.name} (${active.database}).`
              : 'Cadastre e selecione uma conexão para explorar o banco.'
          }
        />
        {active && (
          <Button variant="secondary" onClick={load} disabled={loading}>
            Atualizar
          </Button>
        )}
      </div>

      {loading && <p className="text-sm text-brand-700">Carregando...</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {schemas && <SchemaTree schemas={schemas} />}
    </div>
  );
}
