'use client';

import { useEffect, useRef, useState } from 'react';
import type { QueryResult } from '@/services/query';

export type SortDirection = 'asc' | 'desc';

export interface ColumnSort {
  column: string;
  direction: SortDirection;
}

type CopyFormat = 'csv' | 'json' | 'sql';

export interface CellUpdate {
  rowIndex: number;
  originalRow: unknown[];
  changes: Record<string, unknown>;
}

interface ResultTableProps {
  result: QueryResult;
  tableName?: string;
  sort?: ColumnSort | null;
  onSortChange?: (sort: ColumnSort | null) => void;
  filters?: Record<string, string>;
  onFilterChange?: (column: string, value: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onSaveChanges?: (updates: CellUpdate[]) => Promise<void> | void;
  savingChanges?: boolean;
}

function formatCell(value: unknown): string {
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function parseDraftCellValue(draft: string, originalValue: unknown): unknown {
  if (draft.trim().toUpperCase() === 'NULL') return null;
  if (typeof originalValue === 'number') {
    const parsed = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(parsed)) return parsed;
  }
  if (typeof originalValue === 'boolean') {
    const lower = draft.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return draft;
}

function isSameCellValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  return formatCell(a) === formatCell(b);
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
  onRefresh,
  refreshing = false,
  onSaveChanges,
  savingChanges = false,
}: ResultTableProps) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set());
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [filterDraft, setFilterDraft] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; cellIndex: number } | null>(
    null,
  );
  const [cellDraft, setCellDraft] = useState('');
  const [pendingEdits, setPendingEdits] = useState<Record<number, Record<number, unknown>>>({});
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<CopyFormat | null>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedRows(new Set());
    setEditingCell(null);
    setPendingEdits({});
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

  const pendingRowCount = Object.keys(pendingEdits).length;
  const pendingCellCount = Object.values(pendingEdits).reduce(
    (acc, rowMap) => acc + Object.keys(rowMap).length,
    0,
  );
  const hasPendingChanges = pendingCellCount > 0 || editingCell !== null;
  const canRefresh = Boolean(onRefresh) && !refreshing && !savingChanges;
  const canCopy = selectedCount > 0;
  const canSaveOrCancel = Boolean(onSaveChanges) && hasPendingChanges && !savingChanges;
  const canCancel = hasPendingChanges || selectedCount > 0;

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

  function getEffectiveCellValue(rowIndex: number, cellIndex: number): unknown {
    const rowEdits = pendingEdits[rowIndex];
    if (rowEdits && Object.prototype.hasOwnProperty.call(rowEdits, cellIndex)) {
      return rowEdits[cellIndex];
    }
    return result.rows[rowIndex]?.[cellIndex];
  }

  function startCellEditing(rowIndex: number, cellIndex: number) {
    if (!onSaveChanges) return;
    const currentVal = getEffectiveCellValue(rowIndex, cellIndex);
    setEditingCell({ rowIndex, cellIndex });
    setCellDraft(currentVal === null || currentVal === undefined ? '' : formatCell(currentVal));
  }

  function applyCellDraft(
    baseEdits: Record<number, Record<number, unknown>>,
    rowIndex: number,
    cellIndex: number,
    draft: string,
  ): Record<number, Record<number, unknown>> {
    const originalVal = result.rows[rowIndex]?.[cellIndex];
    const nextVal = parseDraftCellValue(draft, originalVal);
    const next = { ...baseEdits };
    const rowMap = { ...(next[rowIndex] ?? {}) };

    if (isSameCellValue(nextVal, originalVal)) {
      delete rowMap[cellIndex];
    } else {
      rowMap[cellIndex] = nextVal;
    }

    if (Object.keys(rowMap).length === 0) {
      delete next[rowIndex];
    } else {
      next[rowIndex] = rowMap;
    }
    return next;
  }

  function commitCellEdit(rowIndex: number, cellIndex: number, draft: string) {
    setEditingCell(null);
    setPendingEdits((prev) => applyCellDraft(prev, rowIndex, cellIndex, draft));
  }

  function handleCancelAll() {
    setEditingCell(null);
    setPendingEdits({});
    setSelectedRows(new Set());
    setCopyMenuOpen(false);
  }

  async function handleSaveAll() {
    if (!onSaveChanges) return;
    let finalEdits = pendingEdits;
    if (editingCell) {
      finalEdits = applyCellDraft(
        pendingEdits,
        editingCell.rowIndex,
        editingCell.cellIndex,
        cellDraft,
      );
      setEditingCell(null);
      setPendingEdits(finalEdits);
    }

    const updates: CellUpdate[] = Object.entries(finalEdits)
      .map(([rowIdxStr, colMap]) => {
        const rowIndex = Number(rowIdxStr);
        const originalRow = result.rows[rowIndex];
        if (!originalRow) return null;
        const changes: Record<string, unknown> = {};
        for (const [colIdxStr, val] of Object.entries(colMap)) {
          const colName = result.columns[Number(colIdxStr)];
          if (colName !== undefined) {
            changes[colName] = val;
          }
        }
        if (Object.keys(changes).length === 0) return null;
        return { rowIndex, originalRow, changes };
      })
      .filter((item): item is CellUpdate => item !== null);

    if (updates.length === 0) return;
    await onSaveChanges(updates);
  }

  async function handleCopyAs(format: CopyFormat) {
    if (selectedCount === 0) return;
    const orderedIndices = Array.from(selectedRows).sort((a, b) => a - b);
    const chosenRows = orderedIndices
      .map((idx) =>
        result.rows[idx]?.map((_, cellIdx) => getEffectiveCellValue(idx, cellIdx)),
      )
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
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs shadow-card">
        <div className="flex min-w-0 flex-wrap items-center gap-3 font-mono text-[11px] text-ink-muted">
          {selectedCount > 0 && (
            <span className="text-ink">
              <strong className="font-semibold">{selectedCount}</strong> linha(s) selecionada(s)
            </span>
          )}
          {hasPendingChanges && (
            <span className="text-ink">
              {pendingCellCount > 0 ? (
                <>
                  <strong className="font-semibold">{pendingCellCount}</strong> alteração(ões) em{' '}
                  <strong className="font-semibold">{pendingRowCount}</strong> linha(s)
                </>
              ) : (
                'Editando célula...'
              )}
            </span>
          )}
          {selectedCount === 0 && !hasPendingChanges && (
            <span>Selecione linhas para copiar ou dê duplo clique em uma célula para editar</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={!canRefresh}
            aria-label="Atualizar"
            title="Atualizar"
            onClick={() => onRefresh?.()}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-line bg-subtle text-ink transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-subtle"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
            >
              <path
                d="M13.5 8a5.5 5.5 0 1 1-1.35-3.6M13.5 2.5v2.3h-2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div ref={copyMenuRef} className="relative">
            <button
              type="button"
              disabled={!canCopy}
              aria-label="Copiar como"
              title={
                copiedFormat
                  ? `Copiado (${copiedFormat.toUpperCase()})`
                  : 'Copiar linhas selecionadas como...'
              }
              aria-haspopup="menu"
              aria-expanded={copyMenuOpen}
              onClick={() => setCopyMenuOpen((prev) => !prev)}
              className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-line transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                copiedFormat
                  ? 'bg-online/15 text-online'
                  : 'bg-subtle text-ink hover:bg-muted disabled:hover:bg-subtle'
              }`}
            >
              {copiedFormat ? (
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                >
                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                >
                  <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
                  <path
                    d="M10.5 5.5V3.75A1.25 1.25 0 0 0 9.25 2.5h-5.5A1.25 1.25 0 0 0 2.5 3.75v5.5a1.25 1.25 0 0 0 1.25 1.25H5.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>

            {copyMenuOpen && canCopy && (
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

          <button
            type="button"
            disabled={!canSaveOrCancel}
            aria-label="Salvar alterações"
            title="Salvar alterações"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void handleSaveAll()}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-line bg-subtle text-ink transition-colors hover:bg-muted enabled:border-cta enabled:bg-cta enabled:text-cta-fg enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-subtle"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            type="button"
            disabled={!canCancel || savingChanges}
            aria-label="Cancelar"
            title="Cancelar alterações / limpar seleção"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCancelAll}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-line bg-subtle text-ink transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-subtle"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

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
                  {row.map((_, cellIndex) => {
                    const effectiveVal = getEffectiveCellValue(rowIndex, cellIndex);
                    const isCellEditing =
                      editingCell?.rowIndex === rowIndex && editingCell?.cellIndex === cellIndex;
                    const isCellDirty =
                      pendingEdits[rowIndex] !== undefined &&
                      Object.prototype.hasOwnProperty.call(pendingEdits[rowIndex], cellIndex);

                    return (
                      <td
                        key={cellIndex}
                        onDoubleClick={(e) => {
                          if (!onSaveChanges) return;
                          e.stopPropagation();
                          startCellEditing(rowIndex, cellIndex);
                        }}
                        title={onSaveChanges ? 'Duplo clique para editar' : undefined}
                        className={`relative whitespace-nowrap px-3.5 py-1 text-ink ${
                          isCellDirty ? 'bg-online/10 font-semibold' : ''
                        }`}
                      >
                        <span className={isCellEditing ? 'invisible' : ''}>
                          {effectiveVal === null ? (
                            <span className="rounded bg-muted px-1 py-0.2 text-[10px] font-medium text-ink-muted">
                              NULL
                            </span>
                          ) : (
                            formatCell(effectiveVal)
                          )}
                        </span>

                        {isCellEditing && (
                          <input
                            type="text"
                            autoFocus
                            size={1}
                            value={cellDraft}
                            placeholder="NULL"
                            aria-label={`Editar ${result.columns[cellIndex] ?? 'célula'}`}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            onChange={(e) => setCellDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitCellEdit(rowIndex, cellIndex, cellDraft);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingCell(null);
                              }
                            }}
                            onBlur={() => commitCellEdit(rowIndex, cellIndex, cellDraft)}
                            className="absolute inset-0.5 w-[calc(100%-4px)] min-w-0 rounded border border-line-strong bg-panel px-2 py-0.5 font-mono text-[11px] font-normal text-ink outline-none"
                          />
                        )}
                      </td>
                    );
                  })}
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

