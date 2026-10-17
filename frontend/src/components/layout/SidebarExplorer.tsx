'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import { listDatabases } from '@/services/connections';
import {
  SCHEMA_CATEGORIES,
  getSchemaCategoryItems,
  listSchemas,
} from '@/services/explorer';
import type { SchemaCategoryKey, SchemaInfo, TableKind } from '@/services/explorer';

const kindBadges: Record<TableKind, string> = {
  table: 'T',
  view: 'V',
  materialized_view: 'MV',
};

function CategoryIcon({ category }: { category: SchemaCategoryKey }) {
  switch (category) {
    case 'tables':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-3 w-3 shrink-0 opacity-75">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M9 10v10" />
        </svg>
      );
    case 'views':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-3 w-3 shrink-0 opacity-75">
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case 'procedures':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-3 w-3 shrink-0 opacity-75">
          <circle cx="12" cy="12" r="8" />
          <path d="m10 9 5 3-5 3V9Z" strokeLinejoin="round" />
        </svg>
      );
    case 'functions':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-3 w-3 shrink-0 opacity-75">
          <path d="M15 4c-2.5 0-3.5 1.5-3.5 4v8c0 2.5-1 4-3.5 4" strokeLinecap="round" />
          <path d="M8.5 11h6" strokeLinecap="round" />
        </svg>
      );
    case 'triggers':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-3 w-3 shrink-0 opacity-75">
          <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function SidebarExplorer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { active } = useConnections();
  const activeConnectionId = active?.id;

  const activeDatabase = pathname.startsWith('/explorer') ? searchParams.get('database') : null;
  const activeSchema = pathname.startsWith('/explorer') ? searchParams.get('schema') : null;
  const activeCategory = pathname.startsWith('/explorer') ? searchParams.get('category') : null;
  const activeTable = pathname.startsWith('/explorer') ? searchParams.get('table') : null;
  const activeItem = pathname.startsWith('/explorer') ? searchParams.get('item') : null;

  const [databases, setDatabases] = useState<string[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [openDatabases, setOpenDatabases] = useState<Record<string, boolean>>({});
  const [openSchemas, setOpenSchemas] = useState<Record<string, boolean>>({});
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [schemasByDb, setSchemasByDb] = useState<Record<string, SchemaInfo[]>>({});
  const [loadingSchemasByDb, setLoadingSchemasByDb] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenDatabases({});
    setOpenSchemas({});
    setOpenCategories({});
    setSchemasByDb({});
    setLoadingSchemasByDb({});

    if (!active || activeConnectionId === undefined) {
      setDatabases([]);
      return;
    }
    let cancelled = false;
    setLoadingDatabases(true);
    listDatabases(activeConnectionId)
      .then((items) => {
        if (!cancelled) {
          setDatabases(items.length > 0 ? items : [active.database]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDatabases([active.database]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDatabases(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, activeConnectionId]);

  useEffect(() => {
    if (activeDatabase && activeConnectionId !== undefined) {
      setOpenDatabases((prev) => ({ ...prev, [activeDatabase]: true }));
      if (!schemasByDb[activeDatabase] && !loadingSchemasByDb[activeDatabase]) {
        void fetchSchemasForDatabase(activeConnectionId, activeDatabase);
      }
      if (activeSchema) {
        const schemaKey = `${activeDatabase}:${activeSchema}`;
        setOpenSchemas((prev) => ({ ...prev, [schemaKey]: true }));
        if (activeCategory) {
          const categoryKey = `${activeDatabase}:${activeSchema}:${activeCategory}`;
          setOpenCategories((prev) => ({ ...prev, [categoryKey]: true }));
        }
      }
    }
  }, [activeDatabase, activeSchema, activeCategory, activeConnectionId]);

  async function fetchSchemasForDatabase(connectionId: number, db: string) {
    setLoadingSchemasByDb((prev) => ({ ...prev, [db]: true }));
    try {
      const data = await listSchemas(connectionId, db);
      setSchemasByDb((prev) => ({ ...prev, [db]: data }));
    } catch {
      setSchemasByDb((prev) => ({ ...prev, [db]: [] }));
    } finally {
      setLoadingSchemasByDb((prev) => ({ ...prev, [db]: false }));
    }
  }

  function toggleDatabase(db: string) {
    if (activeConnectionId === undefined) return;
    const nextOpen = !openDatabases[db];
    setOpenDatabases((prev) => ({ ...prev, [db]: nextOpen }));
    if (nextOpen && !schemasByDb[db] && !loadingSchemasByDb[db]) {
      void fetchSchemasForDatabase(activeConnectionId, db);
    }
  }

  function toggleSchema(db: string, schemaName: string) {
    const key = `${db}:${schemaName}`;
    setOpenSchemas((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleCategory(db: string, schemaName: string, category: SchemaCategoryKey) {
    const key = `${db}:${schemaName}:${category}`;
    setOpenCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (loadingDatabases) {
    return <span className="px-2.5 py-1.5 text-[11px] text-ink-muted">Carregando...</span>;
  }

  if (!active) {
    return <span className="px-2.5 py-1.5 text-[11px] text-ink-muted">Sem conexão</span>;
  }

  if (databases.length === 0) {
    return <span className="px-2.5 py-1.5 text-[11px] text-ink-muted">Nenhum banco</span>;
  }

  return (
    <div className="flex flex-col gap-px leading-tight">
      {databases.map((db) => {
        const isOpen = Boolean(openDatabases[db]);
        const schemas = schemasByDb[db] ?? [];
        const isLoadingSchemas = Boolean(loadingSchemasByDb[db]);

        return (
          <div key={db} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggleDatabase(db)}
              aria-expanded={isOpen}
              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-left font-mono text-xs text-ink-secondary transition-colors hover:bg-muted/70 hover:text-ink"
            >
              <span className="flex items-center gap-1.5 truncate">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className={`h-3 w-3 shrink-0 text-ink-muted transition-transform duration-150 ${
                    isOpen ? 'rotate-90' : ''
                  }`}
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                    clipRule="evenodd"
                  />
                </svg>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-ink-muted"
                >
                  <ellipse cx="12" cy="5" rx="8" ry="3" />
                  <path d="M4 5v7c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
                  <path d="M4 12v7c0 1.66 3.58 3 8 3s8-1.34 8-3v-7" />
                </svg>
                <span className="truncate">{db}</span>
              </span>
              {schemasByDb[db] && (
                <span className="font-sans text-[10px] text-ink-muted">{schemas.length}</span>
              )}
            </button>

            {isOpen && (
              <div className="ml-3 flex flex-col gap-px border-l border-line py-0.5 pl-2">
                {isLoadingSchemas && (
                  <span className="px-2 py-0.5 text-[11px] text-ink-muted">
                    Carregando schemas...
                  </span>
                )}
                {!isLoadingSchemas && schemas.length === 0 && (
                  <span className="px-2 py-0.5 text-[11px] text-ink-muted">Nenhum schema</span>
                )}
                {!isLoadingSchemas &&
                  schemas.map((schema) => {
                    const schemaKey = `${db}:${schema.name}`;
                    const schemaOpen = Boolean(openSchemas[schemaKey]);

                    return (
                      <div key={schema.name} className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => toggleSchema(db, schema.name)}
                          aria-expanded={schemaOpen}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-0.5 text-left font-mono text-[11px] text-ink-secondary transition-colors hover:bg-muted/70 hover:text-ink"
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
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              aria-hidden="true"
                              className="h-3 w-3 shrink-0 opacity-75"
                            >
                              <path
                                d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span className="truncate">{schema.name}</span>
                          </span>
                        </button>

                        {schemaOpen && (
                          <div className="ml-3 flex flex-col gap-px border-l border-line py-0.5 pl-2">
                            {SCHEMA_CATEGORIES.map((category) => {
                              const categoryKey = `${db}:${schema.name}:${category.key}`;
                              const categoryOpen = Boolean(openCategories[categoryKey]);
                              const items = getSchemaCategoryItems(schema, category.key);

                              return (
                                <div key={category.key} className="flex flex-col">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleCategory(db, schema.name, category.key)
                                    }
                                    aria-expanded={categoryOpen}
                                    className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-0.5 text-left font-mono text-[11px] text-ink-secondary transition-colors hover:bg-muted/70 hover:text-ink"
                                  >
                                    <span className="flex items-center gap-1.5 truncate">
                                      <svg
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        aria-hidden="true"
                                        className={`h-3 w-3 shrink-0 text-ink-muted transition-transform duration-150 ${
                                          categoryOpen ? 'rotate-90' : ''
                                        }`}
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <CategoryIcon category={category.key} />
                                      <span className="truncate">{category.label}</span>
                                    </span>
                                    <span className="font-sans text-[10px] text-ink-muted">
                                      {items.length}
                                    </span>
                                  </button>

                                  {categoryOpen && (
                                    <ul className="ml-3 flex flex-col gap-px border-l border-line py-0.5 pl-2">
                                      {items.map((item) => {
                                        const isTabular =
                                          category.key === 'tables' ||
                                          category.key === 'views';
                                        const selected =
                                          activeDatabase === db &&
                                          activeSchema === schema.name &&
                                          (isTabular
                                            ? activeTable === item.name
                                            : activeCategory === category.key &&
                                              activeItem === item.name);

                                        const currentTab = searchParams.get('tab');
                                        const tabSuffix =
                                          currentTab === 'structure' || currentTab === 'data'
                                            ? `&tab=${currentTab}`
                                            : '';
                                        const href = isTabular
                                          ? `/explorer?database=${encodeURIComponent(
                                              db,
                                            )}&schema=${encodeURIComponent(
                                              schema.name,
                                            )}&category=${encodeURIComponent(
                                              category.key,
                                            )}&table=${encodeURIComponent(
                                              item.name,
                                            )}&kind=${item.kind ?? 'table'}${tabSuffix}`
                                          : `/explorer?database=${encodeURIComponent(
                                              db,
                                            )}&schema=${encodeURIComponent(
                                              schema.name,
                                            )}&category=${encodeURIComponent(
                                              category.key,
                                            )}&item=${encodeURIComponent(item.name)}`;

                                        return (
                                          <li key={item.name}>
                                            <Link
                                              href={href}
                                              aria-current={selected ? 'page' : undefined}
                                              className={`flex items-center justify-between gap-2 rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors ${
                                                selected
                                                  ? 'bg-cta font-semibold text-cta-fg'
                                                  : 'text-ink-secondary hover:bg-muted/70 hover:text-ink'
                                              }`}
                                            >
                                              <span className="truncate">{item.name}</span>
                                              {item.kind && (
                                                <span
                                                  className={`shrink-0 rounded px-1 py-0.2 font-sans text-[9px] font-semibold tracking-wider ${
                                                    selected
                                                      ? 'bg-cta-fg/15 text-cta-fg'
                                                      : 'bg-muted text-ink-muted'
                                                  }`}
                                                >
                                                  {kindBadges[item.kind]}
                                                </span>
                                              )}
                                            </Link>
                                          </li>
                                        );
                                      })}
                                      {items.length === 0 && (
                                        <li className="px-2 py-0.5 text-[11px] text-ink-muted">
                                          Vazio
                                        </li>
                                      )}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
