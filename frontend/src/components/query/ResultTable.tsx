'use client';

import { useEffect, useRef, useState } from 'react';
import type { QueryResult } from '@/services/query';

export type SortDirection = 'asc' | 'desc';

export interface ColumnSort {
  column: string;
  direction: SortDirection;
}

type CopyFormat = 'csv' | 'json' | 'sql';

interface ResultTableProps {
  result: QueryResult;
  tableName?: string;
  sort?: ColumnSort | null;
  onSortChange?: (sort: ColumnSort | null) => void;
  filters?: Record<string, string>;
  onFilterChange?: (column: string, value: string) => void;
}

function formatCell(value: unknown): string {
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function quoteSqlIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function formatSqlTarget(tableName: string): string {
  return tableName
    .split('.')
    .filter(Boolean)
    .map(quoteSqlIdentifier)
    .join('.');
}

function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function serializeRows(
  columns: string[],
  rows: unknown[][],
  format: CopyFormat,
  tableName = 'table_name',
): string {
  if (format === 'csv') {
    const header = columns.map(escapeCsvCell).join(',');
    const body = rows.map((row) => row.map(escapeCsvCell).join(','));
    return [header, ...body].join('\n');
  }

  if (format === 'json') {
    const objects = rows.map((row) => {
      const entry: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        entry[col] = row[idx] ?? null;
      });
      return entry;
    });
    return JSON.stringify(objects, null, 2);
  }

  const target = formatSqlTarget(tableName);
  const colList = columns.map(quoteSqlIdentifier).join(', ');
  const valuesList = rows.map((row) => `(${row.map(formatSqlValue).join(', ')})`).join(',\n  ');
  return `INSERT INTO ${target} (${colList})\nVALUES\n  ${valuesList};`;
}

function SortIcon({ direction }: { direction: SortDirection | null }) {
  if (direction === 'asc') {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-ink"
      >
        <path d="M8 12.5V3.5M4.5 7 8 3.5 11.5 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (direction === 'desc') {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-ink"
      >
        <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 text-ink-muted transition-colors group-hover/sort:text-ink"
    >
      <path d="M5.5 6 8 3.5 10.5 6M5.5 10 8 12.5 10.5 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ResultTable({
  result,
  tableName,
  sort = null,
  onSortChange,
  filters,
  onFilterChange,
}: ResultTableProps) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set());
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [filterDraft, setFilterDraft] = useState('');
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<CopyFormat | null>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedRows(new Set());
    setCopyMenuOpen(false);
  }, [result]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (copyMenuRef.current && !copyMenuRef.current.contains(event.target as Node)) {
        setCopyMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (result.columns.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-panel p-4 text-xs font-medium text-ink shadow-card">
        Comando executado
        {result.rowsAffected !== null && ` — ${result.rowsAffected} linha(s) afetada(s)`} em{' '}
        <span className="font-mono font-semibold text-online">{result.durationMs} ms</span>.
      </p>
    );
  }

  const totalRows = result.rows.length;
  const selectedCount = selectedRows.size;
  const allSelected = totalRows > 0 && selectedCount === totalRows;

  function toggleAllRows() {
    if (totalRows === 0) return;
    if (allSelected) {
      setSelectedRows(new Set());
      return;
    }
    setSelectedRows(new Set(result.rows.map((_, idx) => idx)));
  }

  function toggleRow(rowIndex: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  }

  function cycleSort(column: string) {
    if (!onSortChange) return;
    if (!sort || sort.column !== column) {
      onSortChange({ column, direction: 'asc' });
    } else if (sort.direction === 'asc') {
      onSortChange({ column, direction: 'desc' });
    } else {
      onSortChange(null);
    }
  }

  function startEditing(column: string) {
    if (!onFilterChange) return;
    setEditingCol(column);
    setFilterDraft(filters?.[column] ?? '');
  }

  function commitFilter(column: string, value: string) {
    setEditingCol(null);
    onFilterChange?.(column, value.trim());
  }

  async function handleCopyAs(format: CopyFormat) {
    if (selectedCount === 0) return;
    const orderedIndices = Array.from(selectedRows).sort((a, b) => a - b);
    const chosenRows = orderedIndices
      .map((idx) => result.rows[idx])
      .filter((row): row is unknown[] => row !== undefined);

    const payload = serializeRows(result.columns, chosenRows, format, tableName || 'table_name');
    await navigator.clipboard.writeText(payload);
    setCopyMenuOpen(false);
    setCopiedFormat(format);
    setTimeout(() => {
      setCopiedFormat((prev) => (prev === format ? null : prev));
    }, 2000);
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {selectedCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs shadow-card">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-medium text-ink">
              <strong>{selectedCount}</strong> linha(s) selecionada(s)
            </span>
            <button
              type="button"
              onClick={() => setSelectedRows(new Set())}
              className="cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-ink-muted transition-colors hover:bg-muted hover:text-ink"
            >
              Limpar
            </button>
          </div>

          <div ref={copyMenuRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={copyMenuOpen}
              onClick={() => setCopyMenuOpen((prev) => !prev)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-subtle px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-muted"
            >
              <span>
                {copiedFormat ? `Copiado (${copiedFormat.toUpperCase()})` : 'Copiar como'}
              </span>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className={`h-3.5 w-3.5 text-ink-muted transition-transform duration-150 ${
                  copyMenuOpen ? 'rotate-180' : ''
                }`}
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {copyMenuOpen && (
              <div
                role="menu"
                aria-label="Formatos de cópia"
                className="absolute right-0 top-full z-30 mt-1 w-36 rounded-xl border border-line bg-panel p-1 shadow-card-hover"
              >
                {(
                  [
                    { format: 'csv', label: 'CSV' },
                    { format: 'json', label: 'JSON' },
                    { format: 'sql', label: 'SQL (INSERT)' },
                  ] as const
                ).map(({ format, label }) => (
                  <button
                    key={format}
                    type="button"
                    role="menuitem"
                    onClick={() => void handleCopyAs(format)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-mono text-[11px] text-ink-secondary transition-colors hover:bg-muted hover:text-ink"
                  >
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="min-h-0 overflow-auto rounded-xl border border-line bg-panel shadow-card">
        <table className="w-full text-left font-mono text-[11px] leading-tight">
          <thead className="sticky top-0 z-10 border-b border-line bg-subtle font-sans text-[11px] font-medium text-ink-muted">
            <tr>
              <th
                scope="col"
                onClick={toggleAllRows}
                title={allSelected ? 'Desmarcar todas as linhas' : 'Selecionar toda a tabela'}
                aria-label={allSelected ? 'Desmarcar todas as linhas' : 'Selecionar toda a tabela'}
                className={`w-10 cursor-pointer border-r border-line px-2 py-1.5 text-center font-mono text-[10px] transition-colors select-none ${
                  allSelected
                    ? 'bg-cta font-semibold text-cta-fg'
                    : selectedCount > 0
                      ? 'bg-muted font-semibold text-ink hover:bg-muted/80'
                      : 'text-ink-muted hover:bg-muted/70 hover:text-ink'
                }`}
              >
                #
              </th>
              {result.columns.map((column) => {
                const colSort = sort?.column === column ? sort.direction : null;
                const activeFilter = filters?.[column]?.trim() ?? '';
                const isEditing = editingCol === column;

                return (
                  <th key={column} scope="col" className="whitespace-nowrap px-3.5 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      {onFilterChange ? (
                        <div className="relative flex min-w-0 flex-1 items-center">
                          <button
                            type="button"
                            onClick={() => startEditing(column)}
                            title={`Clique para filtrar por ${column}`}
                            tabIndex={isEditing ? -1 : 0}
                            className={`flex min-w-0 flex-1 cursor-text items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/80 hover:text-ink ${
                              isEditing ? 'invisible' : ''
                            }`}
                          >
                            <span className={activeFilter ? 'font-semibold text-ink' : ''}>
                              {column}
                            </span>
                            {activeFilter && (
                              <span className="max-w-[120px] truncate rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] font-normal text-ink">
                                {activeFilter}
                              </span>
                            )}
                          </button>

                          {isEditing && (
                            <input
                              type="text"
                              autoFocus
                              size={1}
                              value={filterDraft}
                              placeholder={column}
                              aria-label={`Filtrar coluna ${column}`}
                              onChange={(e) => setFilterDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  commitFilter(column, filterDraft);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setEditingCol(null);
                                }
                              }}
                              onBlur={() => setEditingCol(null)}
                              className="absolute inset-0 w-full min-w-0 rounded border border-line-strong bg-panel px-1 py-0.5 font-mono text-[11px] font-normal text-ink outline-none"
                            />
                          )}
                        </div>
                      ) : (
                        <span>{column}</span>
                      )}

                      {onSortChange && (
                        <button
                          type="button"
                          onClick={() => cycleSort(column)}
                          aria-label={`Ordenar por ${column}`}
                          title={
                            colSort === 'asc'
                              ? 'Ordenado crescente (clique para decrescente)'
                              : colSort === 'desc'
                                ? 'Ordenado decrescente (clique para desativar)'
                                : 'Ordenar crescente'
                          }
                          className={`group/sort shrink-0 cursor-pointer rounded p-0.5 transition-colors hover:bg-muted ${
                            colSort ? 'bg-muted/80 text-ink' : ''
                          }`}
                        >
                          <SortIcon direction={colSort} />
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.rows.map((row, rowIndex) => {
              const isSelected = selectedRows.has(rowIndex);
              return (
                <tr
                  key={rowIndex}
                  onClick={() => toggleRow(rowIndex)}
                  aria-selected={isSelected}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-muted/90 hover:bg-muted' : 'hover:bg-muted/40'
                  }`}
                >
                  <td
                    className={`w-10 border-r border-line px-2 py-1 text-center text-[10px] select-none ${
                      isSelected
                        ? 'bg-cta/10 font-semibold text-ink'
                        : 'bg-subtle/60 text-ink-muted'
                    }`}
                  >
                    {rowIndex + 1}
                  </td>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="whitespace-nowrap px-3.5 py-1 text-ink">
                      {cell === null ? (
                        <span className="rounded bg-muted px-1 py-0.2 text-[10px] font-medium text-ink-muted">
                          NULL
                        </span>
                      ) : (
                        formatCell(cell)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {result.rows.length === 0 && (
          <p className="p-5 text-center font-sans text-xs text-ink-muted">
            A consulta não retornou linhas.
          </p>
        )}
      </div>
    </div>
  );
}

