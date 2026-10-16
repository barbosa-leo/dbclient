'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { listSchemas } from '@/services/schemas';
import type { SchemaInfo, TableKind } from '@/services/schemas';

const kindBadges: Record<TableKind, string> = {
  table: 'T',
  view: 'V',
  materialized_view: 'MV',
};

export function SidebarSchemas() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { active } = useConnections();
  const activeConnectionId = active?.id;

  const activeSchema = pathname.startsWith('/schemas') ? searchParams.get('schema') : null;
  const activeTable = pathname.startsWith('/schemas') ? searchParams.get('table') : null;

  const [openSchemas, setOpenSchemas] = useState<Record<string, boolean>>({ public: true });
  const [schemas, setSchemas] = useState<SchemaInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeConnectionId === undefined) {
      setSchemas([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listSchemas(activeConnectionId)
      .then((data) => {
        if (!cancelled) setSchemas(data);
      })
      .catch(() => {
        if (!cancelled) setSchemas([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeConnectionId]);

  useEffect(() => {
    if (activeSchema) {
      setOpenSchemas((prev) => ({ ...prev, [activeSchema]: true }));
    }
  }, [activeSchema]);

  function toggleSchema(name: string) {
    setOpenSchemas((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  return (
    <div className="flex flex-col gap-0.5">
      {loading && (
        <span className="px-2.5 py-1.5 text-[11px] text-ink-muted">Carregando...</span>
      )}
      {!loading && schemas.length === 0 && (
        <span className="px-2.5 py-1.5 text-[11px] text-ink-muted">
          {active ? 'Nenhum schema' : 'Sem conexão'}
        </span>
      )}
      {!loading &&
        schemas.map((schema) => {
          const schemaOpen = Boolean(openSchemas[schema.name]);
          return (
            <div key={schema.name} className="flex flex-col">
              <button
                type="button"
                onClick={() => toggleSchema(schema.name)}
                aria-expanded={schemaOpen}
                className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left font-mono text-xs text-ink-secondary transition-colors hover:bg-muted/70 hover:text-ink"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                    className={`h-3 w-3 shrink-0 text-ink-muted transition-transform duration-150 ${
                      schemaOpen ? 'rotate-90' : ''
                    }`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="truncate">{schema.name}</span>
                </span>
                <span className="font-sans text-[10px] text-ink-muted">
                  {schema.tables.length}
                </span>
              </button>

              {schemaOpen && (
                <ul className="ml-2.5 flex flex-col gap-0.5 border-l border-line py-0.5 pl-2">
                  {schema.tables.map((table) => {
                    const selected =
                      activeSchema === schema.name && activeTable === table.name;
                    const href = `/schemas?schema=${encodeURIComponent(
                      schema.name,
                    )}&table=${encodeURIComponent(table.name)}&kind=${table.kind}`;
                    return (
                      <li key={table.name}>
                        <Link
                          href={href}
                          aria-current={selected ? 'page' : undefined}
                          className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
                            selected
                              ? 'bg-cta font-semibold text-cta-fg'
                              : 'text-ink-secondary hover:bg-muted/70 hover:text-ink'
                          }`}
                        >
                          <span className="truncate">{table.name}</span>
                          <span
                            className={`shrink-0 rounded px-1 py-0.2 font-sans text-[9px] font-semibold tracking-wider ${
                              selected
                                ? 'bg-cta-fg/15 text-cta-fg'
                                : 'bg-muted text-ink-muted'
                            }`}
                          >
                            {kindBadges[table.kind]}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  {schema.tables.length === 0 && (
                    <li className="px-2 py-1 text-[11px] text-ink-muted">Vazio</li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
    </div>
  );
}
