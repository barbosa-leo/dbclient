'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useConnections } from '@/components/connections/ConnectionsProvider';
import {
  SCHEMA_CATEGORIES,
  dropObject,
  getSchemaCategoryItems,
  listSchemas,
  notifyExplorerRefresh,
  onExplorerRefresh,
} from '@/services/explorer';
import type { SchemaCategoryKey, SchemaInfo } from '@/services/explorer';

const categorySingularLabels: Record<SchemaCategoryKey, string> = {
  tables: 'tabela',
  views: 'view',
  procedures: 'procedure',
  functions: 'function',
  triggers: 'trigger',
};

interface ContextMenuState {
  x: number;
  y: number;
  type: 'category' | 'item';
  schema: string;
  category: SchemaCategoryKey;
  itemName?: string;
}

interface PendingDeleteState {
  schema: string;
  category: SchemaCategoryKey;
  name: string;
}

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { active } = useConnections();
  const activeConnectionId = active?.id;

  const activeSchema = pathname.startsWith('/explorer') ? searchParams.get('schema') : null;
  const activeCategory = pathname.startsWith('/explorer') ? searchParams.get('category') : null;
  const activeTable = pathname.startsWith('/explorer') ? searchParams.get('table') : null;
  const activeItem = pathname.startsWith('/explorer') ? searchParams.get('item') : null;
  const activeCreate = pathname.startsWith('/explorer') ? searchParams.get('create') === '1' : false;

  const [databaseOpen, setDatabaseOpen] = useState(true);
  const [schemas, setSchemas] = useState<SchemaInfo[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [openSchemas, setOpenSchemas] = useState<Record<string, boolean>>({});
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reloadSchemas = useCallback(async () => {
    if (activeConnectionId === undefined) return;
    try {
      const data = await listSchemas(activeConnectionId);
      setSchemas(data);
    } catch {}
  }, [activeConnectionId]);

  useEffect(() => {
    setDatabaseOpen(true);
    setOpenSchemas({});
    setOpenCategories({});
    setSchemas([]);

    if (!active || activeConnectionId === undefined) {
      setLoadingSchemas(false);
      return;
    }

    let cancelled = false;
    setLoadingSchemas(true);
    listSchemas(activeConnectionId)
      .then((data) => {
        if (!cancelled) setSchemas(data);
      })
      .catch(() => {
        if (!cancelled) setSchemas([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSchemas(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, activeConnectionId]);

  useEffect(() => {
    return onExplorerRefresh(() => {
      void reloadSchemas();
    });
  }, [reloadSchemas]);

  useEffect(() => {
    if (activeSchema) {
      setDatabaseOpen(true);
      setOpenSchemas((prev) => ({ ...prev, [activeSchema]: true }));
      if (activeCategory) {
        const categoryKey = `${activeSchema}:${activeCategory}`;
        setOpenCategories((prev) => ({ ...prev, [categoryKey]: true }));
      }
    }
  }, [activeSchema, activeCategory]);

  useEffect(() => {
    if (!contextMenu) return;
    function closeMenu() {
      setContextMenu(null);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null);
    }
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  function toggleSchema(schemaName: string) {
    setOpenSchemas((prev) => ({ ...prev, [schemaName]: !prev[schemaName] }));
  }

  function toggleCategory(schemaName: string, category: SchemaCategoryKey) {
    const key = `${schemaName}:${category}`;
    setOpenCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function navigateToCreate(schemaName: string, category: SchemaCategoryKey) {
    setContextMenu(null);
    setOpenSchemas((prev) => ({ ...prev, [schemaName]: true }));
    setOpenCategories((prev) => ({ ...prev, [`${schemaName}:${category}`]: true }));
    router.push(
      `/explorer?schema=${encodeURIComponent(schemaName)}&category=${encodeURIComponent(
        category,
      )}&create=1`,
    );
  }

  function requestDelete(schemaName: string, category: SchemaCategoryKey, itemName: string) {
    setContextMenu(null);
    setDeleteError(null);
    setPendingDelete({ schema: schemaName, category, name: itemName });
  }

  async function confirmDelete() {
    if (!pendingDelete || activeConnectionId === undefined) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await dropObject(
        activeConnectionId,
        pendingDelete.schema,
        pendingDelete.category,
        pendingDelete.name,
      );
      const wasActiveObject =
        activeSchema === pendingDelete.schema &&
        ((pendingDelete.category === 'tables' || pendingDelete.category === 'views')
          ? activeTable === pendingDelete.name
          : activeCategory === pendingDelete.category && activeItem === pendingDelete.name);

      setPendingDelete(null);
      notifyExplorerRefresh();
      if (wasActiveObject) {
        router.replace(`/explorer?schema=${encodeURIComponent(pendingDelete.schema)}`);
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Falha ao excluir o objeto');
    } finally {
      setDeleting(false);
    }
  }

  function openCategoryContextMenu(
    e: ReactMouseEvent,
    schemaName: string,
    category: SchemaCategoryKey,
  ) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'category',
      schema: schemaName,
      category,
    });
  }

  function openItemContextMenu(
    e: ReactMouseEvent,
    schemaName: string,
    category: SchemaCategoryKey,
    itemName: string,
  ) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'item',
      schema: schemaName,
      category,
      itemName,
    });
  }

  if (!active) {
    return <span className="px-2.5 py-1.5 text-[11px] text-ink-muted">Sem conexão</span>;
  }

  const db = active.database;

  return (
    <div className="flex flex-col gap-px leading-tight">
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => setDatabaseOpen((prev) => !prev)}
          aria-expanded={databaseOpen}
          className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-left font-mono text-xs text-ink-secondary transition-colors hover:bg-muted/70 hover:text-ink"
        >
          <span className="flex items-center gap-1.5 truncate">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 text-ink-muted transition-transform duration-150 ${
                databaseOpen ? 'rotate-90' : ''
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
          {!loadingSchemas && (
            <span className="font-sans text-[10px] text-ink-muted">{schemas.length}</span>
          )}
        </button>

        {databaseOpen && (
          <div className="ml-3 flex flex-col gap-px border-l border-line py-0.5 pl-2">
            {loadingSchemas && (
              <span className="px-2 py-0.5 text-[11px] text-ink-muted">
                Carregando schemas...
              </span>
            )}
            {!loadingSchemas && schemas.length === 0 && (
              <span className="px-2 py-0.5 text-[11px] text-ink-muted">Nenhum schema</span>
            )}
            {!loadingSchemas &&
              schemas.map((schema) => {
                const schemaOpen = Boolean(openSchemas[schema.name]);

                return (
                  <div key={schema.name} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => toggleSchema(schema.name)}
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
                          const categoryKey = `${schema.name}:${category.key}`;
                          const categoryOpen = Boolean(openCategories[categoryKey]);
                          const items = getSchemaCategoryItems(schema, category.key);

                          return (
                            <div key={category.key} className="flex flex-col">
                              <div
                                onContextMenu={(e) =>
                                  openCategoryContextMenu(e, schema.name, category.key)
                                }
                                className="group flex items-center justify-between gap-1 rounded-md pr-1 transition-colors hover:bg-muted/70"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleCategory(schema.name, category.key)}
                                  aria-expanded={categoryOpen}
                                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 px-2 py-0.5 text-left font-mono text-[11px] text-ink-secondary group-hover:text-ink"
                                >
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
                                </button>

                                <div className="flex shrink-0 items-center justify-end">
                                  <button
                                    type="button"
                                    aria-label={`Adicionar ${categorySingularLabels[category.key]} em ${schema.name}`}
                                    title={`Nova ${categorySingularLabels[category.key]}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigateToCreate(schema.name, category.key);
                                    }}
                                    className="hidden h-4 w-4 cursor-pointer items-center justify-center rounded text-ink-muted transition-colors hover:bg-muted hover:text-ink group-hover:inline-flex"
                                  >
                                    <svg
                                      viewBox="0 0 16 16"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.75"
                                      aria-hidden="true"
                                      className="h-3 w-3"
                                    >
                                      <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
                                    </svg>
                                  </button>
                                  <span className="font-sans text-[10px] text-ink-muted group-hover:hidden">
                                    {items.length}
                                  </span>
                                </div>
                              </div>

                              {categoryOpen && (
                                <ul className="ml-3 flex flex-col gap-px border-l border-line py-0.5 pl-2">
                                  {items.map((item) => {
                                    const isTabular =
                                      category.key === 'tables' || category.key === 'views';
                                    const selected =
                                      !activeCreate &&
                                      activeSchema === schema.name &&
                                      (isTabular
                                        ? activeTable === item.name
                                        : activeCategory === category.key &&
                                          activeItem === item.name);

                                    const currentTab = searchParams.get('tab');
                                    const tabSuffix =
                                      category.key === 'tables' &&
                                      (currentTab === 'structure' || currentTab === 'data')
                                        ? `&tab=${currentTab}`
                                        : '';
                                    const href = isTabular
                                      ? `/explorer?schema=${encodeURIComponent(
                                          schema.name,
                                        )}&category=${encodeURIComponent(
                                          category.key,
                                        )}&table=${encodeURIComponent(item.name)}&kind=${
                                          item.kind ?? 'table'
                                        }${tabSuffix}`
                                      : `/explorer?schema=${encodeURIComponent(
                                          schema.name,
                                        )}&category=${encodeURIComponent(
                                          category.key,
                                        )}&item=${encodeURIComponent(item.name)}`;

                                    return (
                                      <li
                                        key={item.name}
                                        onContextMenu={(e) =>
                                          openItemContextMenu(
                                            e,
                                            schema.name,
                                            category.key,
                                            item.name,
                                          )
                                        }
                                        className={`group flex items-center justify-between gap-1 rounded-md pr-1 transition-colors ${
                                          selected
                                            ? 'bg-cta font-semibold text-cta-fg'
                                            : 'text-ink-secondary hover:bg-muted/70 hover:text-ink'
                                        }`}
                                      >
                                        <Link
                                          href={href}
                                          aria-current={selected ? 'page' : undefined}
                                          className="flex min-w-0 flex-1 items-center px-2 py-0.5 font-mono text-[11px]"
                                        >
                                          <span className="truncate">{item.name}</span>
                                        </Link>

                                        <div className="flex shrink-0 items-center justify-end">
                                          <button
                                            type="button"
                                            aria-label={`Excluir ${item.name}`}
                                            title={`Excluir ${item.name}`}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              requestDelete(schema.name, category.key, item.name);
                                            }}
                                            className={`hidden h-4 w-4 cursor-pointer items-center justify-center rounded transition-colors group-hover:inline-flex ${
                                              selected
                                                ? 'text-cta-fg/80 hover:bg-cta-fg/20 hover:text-cta-fg'
                                                : 'text-ink-muted hover:bg-danger/15 hover:text-danger'
                                            }`}
                                          >
                                            <svg
                                              viewBox="0 0 16 16"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="1.5"
                                              aria-hidden="true"
                                              className="h-3 w-3"
                                            >
                                              <path
                                                d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.5 8.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                              />
                                            </svg>
                                          </button>
                                        </div>
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

      {contextMenu && (
        <div
          role="menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 min-w-[175px] rounded-lg border border-line bg-panel p-1 shadow-card"
        >
          {contextMenu.type === 'category' ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => navigateToCreate(contextMenu.schema, contextMenu.category)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-ink transition-colors hover:bg-muted"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
                className="h-3.5 w-3.5 text-ink-secondary"
              >
                <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
              </svg>
              <span>Nova {categorySingularLabels[contextMenu.category]}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => navigateToCreate(contextMenu.schema, contextMenu.category)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-ink transition-colors hover:bg-muted"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-ink-secondary"
                >
                  <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
                </svg>
                <span>Nova {categorySingularLabels[contextMenu.category]}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  contextMenu.itemName &&
                  requestDelete(contextMenu.schema, contextMenu.category, contextMenu.itemName)
                }
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-danger transition-colors hover:bg-danger/10"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                >
                  <path
                    d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.5 8.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Excluir {contextMenu.itemName}</span>
              </button>
            </>
          )}
        </div>
      )}

      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-object-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-card">
            <h2 id="delete-object-title" className="text-sm font-semibold text-ink">
              Excluir {categorySingularLabels[pendingDelete.category]}
            </h2>
            <p className="mt-1.5 text-xs text-ink-secondary">
              Tem certeza que deseja remover{' '}
              <strong className="font-mono text-ink">
                {pendingDelete.schema}.{pendingDelete.name}
              </strong>
              ? Esta operação executará <code className="font-mono">DROP</code> no banco de dados.
            </p>

            {deleteError && (
              <p role="alert" className="mt-3 text-xs font-medium text-danger">
                {deleteError}
              </p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="cursor-pointer rounded-md border border-line bg-subtle px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="cursor-pointer rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

