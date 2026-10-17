'use client';

import { useEffect, useState } from 'react';
import type { ColumnInfo } from '@/services/explorer';

type EditableColumnField = 'name' | 'dataType' | 'nullable' | 'defaultValue' | 'isPrimaryKey';

export interface ColumnStructureUpdate {
  original: ColumnInfo;
  updated: ColumnInfo;
}

interface TableStructureProps {
  columns: ColumnInfo[];
  onRefresh?: () => void;
  refreshing?: boolean;
  onSaveChanges?: (updates: ColumnStructureUpdate[]) => Promise<void> | void;
  savingChanges?: boolean;
}

function formatFieldDraft(column: ColumnInfo, field: EditableColumnField): string {
  switch (field) {
    case 'name':
      return column.name;
    case 'dataType':
      return column.dataType;
    case 'nullable':
      return column.nullable ? 'YES' : 'NO';
    case 'defaultValue':
      return column.defaultValue ?? '';
    case 'isPrimaryKey':
      return column.isPrimaryKey ? 'PK' : '';
  }
}

function parseFieldDraft(
  original: ColumnInfo,
  field: EditableColumnField,
  draft: string,
): ColumnInfo[EditableColumnField] {
  const trimmed = draft.trim();
  switch (field) {
    case 'name':
      return trimmed || original.name;
    case 'dataType':
      return trimmed || original.dataType;
    case 'nullable': {
      const upper = trimmed.toUpperCase();
      if (upper === 'YES' || upper === 'TRUE' || upper === '1' || upper === 'SIM') return true;
      if (upper === 'NO' || upper === 'FALSE' || upper === '0' || upper === 'NAO' || upper === 'NÃO')
        return false;
      return original.nullable;
    }
    case 'defaultValue':
      if (!trimmed || trimmed.toUpperCase() === 'NULL') return null;
      return trimmed;
    case 'isPrimaryKey': {
      const upper = trimmed.toUpperCase();
      if (upper === 'PK' || upper === 'YES' || upper === 'TRUE' || upper === '1' || upper === 'SIM')
        return true;
      if (upper === '' || upper === 'NO' || upper === 'FALSE' || upper === '0' || upper === 'NULL')
        return false;
      return original.isPrimaryKey;
    }
  }
}

export function TableStructure({
  columns,
  onRefresh,
  refreshing = false,
  onSaveChanges,
  savingChanges = false,
}: TableStructureProps) {
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    field: EditableColumnField;
  } | null>(null);
  const [cellDraft, setCellDraft] = useState('');
  const [pendingEdits, setPendingEdits] = useState<Record<number, Partial<ColumnInfo>>>({});

  useEffect(() => {
    setEditingCell(null);
    setPendingEdits({});
  }, [columns]);

  if (columns.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-panel p-8 text-center text-xs font-medium text-ink-muted shadow-card">
        Nenhuma coluna encontrada para este objeto.
      </p>
    );
  }

  const pendingRowCount = Object.keys(pendingEdits).length;
  const pendingCellCount = Object.values(pendingEdits).reduce(
    (acc, rowPatch) => acc + Object.keys(rowPatch).length,
    0,
  );
  const hasPendingChanges = pendingCellCount > 0 || editingCell !== null;
  const canRefresh = Boolean(onRefresh) && !refreshing && !savingChanges;
  const canSaveOrCancel = Boolean(onSaveChanges) && hasPendingChanges && !savingChanges;

  function getEffectiveColumn(rowIndex: number): ColumnInfo {
    const base = columns[rowIndex]!;
    const patch = pendingEdits[rowIndex];
    return patch ? { ...base, ...patch } : base;
  }

  function isFieldDirty(rowIndex: number, field: EditableColumnField): boolean {
    const patch = pendingEdits[rowIndex];
    return Boolean(patch && Object.prototype.hasOwnProperty.call(patch, field));
  }

  function startEditing(rowIndex: number, field: EditableColumnField) {
    if (!onSaveChanges) return;
    const effective = getEffectiveColumn(rowIndex);
    setEditingCell({ rowIndex, field });
    setCellDraft(formatFieldDraft(effective, field));
  }

  function applyDraft(
    baseEdits: Record<number, Partial<ColumnInfo>>,
    rowIndex: number,
    field: EditableColumnField,
    draft: string,
  ): Record<number, Partial<ColumnInfo>> {
    const original = columns[rowIndex];
    if (!original) return baseEdits;
    const parsed = parseFieldDraft(original, field, draft);
    const next = { ...baseEdits };
    const rowPatch: Partial<ColumnInfo> = { ...(next[rowIndex] ?? {}) };

    if (parsed === original[field]) {
      delete rowPatch[field];
    } else {
      (rowPatch as Record<EditableColumnField, unknown>)[field] = parsed;
    }

    if (Object.keys(rowPatch).length === 0) {
      delete next[rowIndex];
    } else {
      next[rowIndex] = rowPatch;
    }
    return next;
  }

  function commitEdit(rowIndex: number, field: EditableColumnField, draft: string) {
    setEditingCell(null);
    setPendingEdits((prev) => applyDraft(prev, rowIndex, field, draft));
  }

  function handleCancelAll() {
    setEditingCell(null);
    setPendingEdits({});
  }

  async function handleSaveAll() {
    if (!onSaveChanges) return;
    let finalEdits = pendingEdits;
    if (editingCell) {
      finalEdits = applyDraft(
        pendingEdits,
        editingCell.rowIndex,
        editingCell.field,
        cellDraft,
      );
      setEditingCell(null);
      setPendingEdits(finalEdits);
    }

    const updates: ColumnStructureUpdate[] = Object.entries(finalEdits)
      .map(([rowIdxStr, patch]) => {
        const idx = Number(rowIdxStr);
        const original = columns[idx];
        if (!original || !patch || Object.keys(patch).length === 0) return null;
        return {
          original,
          updated: { ...original, ...patch },
        };
      })
      .filter((item): item is ColumnStructureUpdate => item !== null);

    if (updates.length === 0) return;
    await onSaveChanges(updates);
  }

  function renderEditableOverlay(
    rowIndex: number,
    field: EditableColumnField,
    placeholder: string,
    alignRight = false,
  ) {
    if (editingCell?.rowIndex !== rowIndex || editingCell.field !== field) return null;
    return (
      <input
        type="text"
        autoFocus
        size={1}
        value={cellDraft}
        placeholder={placeholder}
        aria-label={`Editar ${field}`}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onChange={(e) => setCellDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitEdit(rowIndex, field, cellDraft);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditingCell(null);
          }
        }}
        onBlur={() => commitEdit(rowIndex, field, cellDraft)}
        className={`absolute inset-0.5 w-[calc(100%-4px)] min-w-0 rounded border border-line-strong bg-panel px-2 py-0.5 font-mono text-[11px] font-normal text-ink outline-none ${
          alignRight ? 'text-right' : ''
        }`}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs shadow-card">
        <div className="flex min-w-0 flex-wrap items-center gap-3 font-mono text-[11px] text-ink-muted">
          {hasPendingChanges ? (
            <span className="text-ink">
              {pendingCellCount > 0 ? (
                <>
                  <strong className="font-semibold">{pendingCellCount}</strong> alteração(ões) em{' '}
                  <strong className="font-semibold">{pendingRowCount}</strong> coluna(s)
                </>
              ) : (
                'Editando coluna...'
              )}
            </span>
          ) : (
            <span>Dê duplo clique em uma célula para editar a estrutura (ALTER TABLE)</span>
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

          <button
            type="button"
            disabled={!canSaveOrCancel}
            aria-label="Salvar alterações"
            title="Salvar alterações (ALTER TABLE)"
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
            disabled={!canSaveOrCancel}
            aria-label="Cancelar"
            title="Cancelar alterações"
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
        <table className="w-full text-left text-xs leading-tight">
          <thead className="sticky top-0 z-10 border-b border-line bg-subtle text-[11px] font-medium text-ink-muted">
            <tr>
              <th className="px-4 py-1.5">Coluna</th>
              <th className="px-4 py-1.5">Tipo</th>
              <th className="px-4 py-1.5">Nulo</th>
              <th className="px-4 py-1.5">Padrão</th>
              <th className="px-4 py-1.5 text-right">Chave</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line font-mono text-[11px] leading-tight">
            {columns.map((originalCol, rowIndex) => {
              const col = getEffectiveColumn(rowIndex);
              const isEditingName =
                editingCell?.rowIndex === rowIndex && editingCell.field === 'name';
              const isEditingType =
                editingCell?.rowIndex === rowIndex && editingCell.field === 'dataType';
              const isEditingNull =
                editingCell?.rowIndex === rowIndex && editingCell.field === 'nullable';
              const isEditingDefault =
                editingCell?.rowIndex === rowIndex && editingCell.field === 'defaultValue';
              const isEditingPk =
                editingCell?.rowIndex === rowIndex && editingCell.field === 'isPrimaryKey';

              return (
                <tr key={originalCol.name} className="transition-colors hover:bg-muted/50">
                  <td
                    onDoubleClick={() => startEditing(rowIndex, 'name')}
                    title={onSaveChanges ? 'Duplo clique para editar nome' : undefined}
                    className={`relative whitespace-nowrap px-4 py-1 font-semibold text-ink ${
                      isFieldDirty(rowIndex, 'name') ? 'bg-online/10' : ''
                    }`}
                  >
                    <span className={isEditingName ? 'invisible' : ''}>{col.name}</span>
                    {renderEditableOverlay(rowIndex, 'name', originalCol.name)}
                  </td>

                  <td
                    onDoubleClick={() => startEditing(rowIndex, 'dataType')}
                    title={onSaveChanges ? 'Duplo clique para editar tipo' : undefined}
                    className={`relative whitespace-nowrap px-4 py-1 text-ink-secondary ${
                      isFieldDirty(rowIndex, 'dataType') ? 'bg-online/10 font-semibold text-ink' : ''
                    }`}
                  >
                    <span className={isEditingType ? 'invisible' : ''}>{col.dataType}</span>
                    {renderEditableOverlay(rowIndex, 'dataType', originalCol.dataType)}
                  </td>

                  <td
                    onDoubleClick={() => startEditing(rowIndex, 'nullable')}
                    title={onSaveChanges ? 'Duplo clique para editar (YES / NO)' : undefined}
                    className={`relative whitespace-nowrap px-4 py-1 font-sans ${
                      isFieldDirty(rowIndex, 'nullable') ? 'bg-online/10' : ''
                    }`}
                  >
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-medium ${
                        isEditingNull ? 'invisible' : ''
                      } ${
                        col.nullable
                          ? 'bg-muted text-ink-secondary'
                          : 'border border-line bg-panel text-ink'
                      }`}
                    >
                      {col.nullable ? 'YES' : 'NO'}
                    </span>
                    {renderEditableOverlay(rowIndex, 'nullable', 'YES / NO')}
                  </td>

                  <td
                    onDoubleClick={() => startEditing(rowIndex, 'defaultValue')}
                    title={onSaveChanges ? 'Duplo clique para editar valor padrão' : undefined}
                    className={`relative whitespace-nowrap px-4 py-1 text-ink-secondary ${
                      isFieldDirty(rowIndex, 'defaultValue')
                        ? 'bg-online/10 font-semibold text-ink'
                        : ''
                    }`}
                  >
                    <span className={isEditingDefault ? 'invisible' : ''}>
                      {col.defaultValue ?? (
                        <span className="rounded bg-muted px-1 py-0.2 text-[10px] text-ink-muted">
                          NULL
                        </span>
                      )}
                    </span>
                    {renderEditableOverlay(rowIndex, 'defaultValue', 'NULL')}
                  </td>

                  <td
                    onDoubleClick={() => startEditing(rowIndex, 'isPrimaryKey')}
                    title={onSaveChanges ? 'Duplo clique para editar chave (PK / NO)' : undefined}
                    className={`relative whitespace-nowrap px-4 py-1 text-right font-sans ${
                      isFieldDirty(rowIndex, 'isPrimaryKey') ? 'bg-online/10' : ''
                    }`}
                  >
                    <span className={isEditingPk ? 'invisible' : ''}>
                      {col.isPrimaryKey ? (
                        <span className="rounded bg-cta px-1.5 py-0.2 text-[10px] font-semibold text-cta-fg">
                          PK
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-muted">—</span>
                      )}
                    </span>
                    {renderEditableOverlay(rowIndex, 'isPrimaryKey', 'PK / NO', true)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

