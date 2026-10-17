'use client';

import { useEffect, useState } from 'react';
import type { ColumnInfo } from '@/services/explorer';

type EditableColumnField = 'name' | 'dataType' | 'nullable' | 'defaultValue' | 'isPrimaryKey';

export interface ColumnStructureUpdate {
  original: ColumnInfo;
  updated: ColumnInfo;
}

export interface TableStructureChanges {
  updates: ColumnStructureUpdate[];
  added: ColumnInfo[];
  deleted: string[];
}

interface TableStructureProps {
  columns: ColumnInfo[];
  onRefresh?: () => void;
  refreshing?: boolean;
  onSaveChanges?: (changes: TableStructureChanges) => Promise<void> | void;
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
  fallback: ColumnInfo,
  field: EditableColumnField,
  draft: string,
): ColumnInfo[EditableColumnField] {
  const trimmed = draft.trim();
  switch (field) {
    case 'name':
      return trimmed || fallback.name;
    case 'dataType':
      return trimmed || fallback.dataType;
    case 'nullable': {
      const upper = trimmed.toUpperCase();
      if (upper === 'YES' || upper === 'TRUE' || upper === '1' || upper === 'SIM') return true;
      if (upper === 'NO' || upper === 'FALSE' || upper === '0' || upper === 'NAO' || upper === 'NÃO')
        return false;
      return fallback.nullable;
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
      return fallback.isPrimaryKey;
    }
  }
}

function generateDefaultColumnName(existingNames: string[]): string {
  const set = new Set(existingNames.map((n) => n.toLowerCase()));
  let idx = 1;
  while (set.has(`nova_coluna_${idx}`)) {
    idx++;
  }
  return `nova_coluna_${idx}`;
}

export function TableStructure({
  columns,
  onRefresh,
  refreshing = false,
  onSaveChanges,
  savingChanges = false,
}: TableStructureProps) {
  const [editingCell, setEditingCell] = useState<{
    target: 'existing' | 'added';
    rowIndex: number;
    field: EditableColumnField;
  } | null>(null);
  const [cellDraft, setCellDraft] = useState('');
  const [pendingEdits, setPendingEdits] = useState<Record<number, Partial<ColumnInfo>>>({});
  const [addedColumns, setAddedColumns] = useState<ColumnInfo[]>([]);
  const [deletedRows, setDeletedRows] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setEditingCell(null);
    setPendingEdits({});
    setAddedColumns([]);
    setDeletedRows({});
  }, [columns]);

  if (columns.length === 0 && addedColumns.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-panel p-8 text-center text-xs font-medium text-ink-muted shadow-card">
        Nenhuma coluna encontrada para este objeto.
      </p>
    );
  }

  const deletedCount = Object.values(deletedRows).filter(Boolean).length;
  const addedCount = addedColumns.length;
  const editedExistingCount = Object.entries(pendingEdits).filter(
    ([idxStr, patch]) => !deletedRows[Number(idxStr)] && Object.keys(patch).length > 0,
  ).length;
  const totalOperationsCount = editedExistingCount + addedCount + deletedCount;

  const hasPendingChanges = totalOperationsCount > 0 || editingCell !== null;
  const canRefresh = Boolean(onRefresh) && !refreshing && !savingChanges;
  const canAddRow = Boolean(onSaveChanges) && !savingChanges;
  const canSaveOrCancel = Boolean(onSaveChanges) && hasPendingChanges && !savingChanges;

  function getEffectiveColumn(rowIndex: number): ColumnInfo {
    const base = columns[rowIndex]!;
    const patch = pendingEdits[rowIndex];
    return patch ? { ...base, ...patch } : base;
  }

  function isFieldDirty(rowIndex: number, field: EditableColumnField): boolean {
    if (deletedRows[rowIndex]) return false;
    const patch = pendingEdits[rowIndex];
    return Boolean(patch && Object.prototype.hasOwnProperty.call(patch, field));
  }

  function startEditing(
    target: 'existing' | 'added',
    rowIndex: number,
    field: EditableColumnField,
  ) {
    if (!onSaveChanges) return;
    if (target === 'existing' && deletedRows[rowIndex]) return;
    const col =
      target === 'existing' ? getEffectiveColumn(rowIndex) : addedColumns[rowIndex]!;
    setEditingCell({ target, rowIndex, field });
    setCellDraft(formatFieldDraft(col, field));
  }

  function applyExistingDraft(
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

  function applyAddedDraft(
    baseAdded: ColumnInfo[],
    rowIndex: number,
    field: EditableColumnField,
    draft: string,
  ): ColumnInfo[] {
    const current = baseAdded[rowIndex];
    if (!current) return baseAdded;
    const parsed = parseFieldDraft(current, field, draft);
    return baseAdded.map((item, idx) =>
      idx === rowIndex ? { ...item, [field]: parsed } : item,
    );
  }

  function commitEdit(
    target: 'existing' | 'added',
    rowIndex: number,
    field: EditableColumnField,
    draft: string,
  ) {
    setEditingCell(null);
    if (target === 'existing') {
      setPendingEdits((prev) => applyExistingDraft(prev, rowIndex, field, draft));
    } else {
      setAddedColumns((prev) => applyAddedDraft(prev, rowIndex, field, draft));
    }
  }

  function handleAddColumn() {
    if (!canAddRow) return;
    const existingNames = [
      ...columns.map((_, i) => getEffectiveColumn(i).name),
      ...addedColumns.map((c) => c.name),
    ];
    const newCol: ColumnInfo = {
      name: generateDefaultColumnName(existingNames),
      dataType: 'varchar(255)',
      nullable: true,
      defaultValue: null,
      isPrimaryKey: false,
    };
    const nextIndex = addedColumns.length;
    setAddedColumns((prev) => [...prev, newCol]);
    setEditingCell({ target: 'added', rowIndex: nextIndex, field: 'name' });
    setCellDraft(newCol.name);
  }

  function toggleDeleteExistingRow(rowIndex: number) {
    if (!onSaveChanges || savingChanges) return;
    if (editingCell?.target === 'existing' && editingCell.rowIndex === rowIndex) {
      setEditingCell(null);
    }
    setDeletedRows((prev) => {
      const next = { ...prev };
      if (next[rowIndex]) {
        delete next[rowIndex];
      } else {
        next[rowIndex] = true;
      }
      return next;
    });
  }

  function removeAddedRow(rowIndex: number) {
    if (!onSaveChanges || savingChanges) return;
    if (editingCell?.target === 'added') {
      setEditingCell(null);
    }
    setAddedColumns((prev) => prev.filter((_, idx) => idx !== rowIndex));
  }

  function handleCancelAll() {
    setEditingCell(null);
    setPendingEdits({});
    setAddedColumns([]);
    setDeletedRows({});
  }

  async function handleSaveAll() {
    if (!onSaveChanges) return;
    let finalEdits = pendingEdits;
    let finalAdded = addedColumns;

    if (editingCell) {
      if (editingCell.target === 'existing') {
        finalEdits = applyExistingDraft(
          pendingEdits,
          editingCell.rowIndex,
          editingCell.field,
          cellDraft,
        );
        setPendingEdits(finalEdits);
      } else {
        finalAdded = applyAddedDraft(
          addedColumns,
          editingCell.rowIndex,
          editingCell.field,
          cellDraft,
        );
        setAddedColumns(finalAdded);
      }
      setEditingCell(null);
    }

    const updates: ColumnStructureUpdate[] = Object.entries(finalEdits)
      .map(([rowIdxStr, patch]) => {
        const idx = Number(rowIdxStr);
        if (deletedRows[idx]) return null;
        const original = columns[idx];
        if (!original || !patch || Object.keys(patch).length === 0) return null;
        return {
          original,
          updated: { ...original, ...patch },
        };
      })
      .filter((item): item is ColumnStructureUpdate => item !== null);

    const deleted = Object.entries(deletedRows)
      .filter(([, isDel]) => isDel)
      .map(([idxStr]) => columns[Number(idxStr)]?.name)
      .filter((name): name is string => Boolean(name));

    if (updates.length === 0 && finalAdded.length === 0 && deleted.length === 0) return;

    await onSaveChanges({
      updates,
      added: finalAdded,
      deleted,
    });
  }

  function renderEditableOverlay(
    target: 'existing' | 'added',
    rowIndex: number,
    field: EditableColumnField,
    placeholder: string,
    alignRight = false,
  ) {
    if (
      editingCell?.target !== target ||
      editingCell.rowIndex !== rowIndex ||
      editingCell.field !== field
    ) {
      return null;
    }
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
            commitEdit(target, rowIndex, field, cellDraft);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditingCell(null);
          }
        }}
        onBlur={() => commitEdit(target, rowIndex, field, cellDraft)}
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
              {totalOperationsCount > 0 ? (
                <>
                  <strong className="font-semibold">{totalOperationsCount}</strong> coluna(s) com
                  alteração pendente
                </>
              ) : (
                'Editando coluna...'
              )}
            </span>
          ) : (
            <span>Dê duplo clique para editar ou adicione/remova colunas (ALTER TABLE)</span>
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
            disabled={!canAddRow}
            aria-label="Adicionar coluna"
            title="Adicionar coluna"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleAddColumn}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-line bg-subtle text-ink transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-subtle"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
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
              <th className="w-10 px-2 py-1.5 text-center" aria-label="Ações" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line font-mono text-[11px] leading-tight">
            {columns.map((originalCol, rowIndex) => {
              const col = getEffectiveColumn(rowIndex);
              const isDeleted = Boolean(deletedRows[rowIndex]);
              const isEditingName =
                editingCell?.target === 'existing' &&
                editingCell.rowIndex === rowIndex &&
                editingCell.field === 'name';
              const isEditingType =
                editingCell?.target === 'existing' &&
                editingCell.rowIndex === rowIndex &&
                editingCell.field === 'dataType';
              const isEditingNull =
                editingCell?.target === 'existing' &&
                editingCell.rowIndex === rowIndex &&
                editingCell.field === 'nullable';
              const isEditingDefault =
                editingCell?.target === 'existing' &&
                editingCell.rowIndex === rowIndex &&
                editingCell.field === 'defaultValue';
              const isEditingPk =
                editingCell?.target === 'existing' &&
                editingCell.rowIndex === rowIndex &&
                editingCell.field === 'isPrimaryKey';

              return (
                <tr
                  key={originalCol.name}
                  className={`transition-colors ${
                    isDeleted
                      ? 'bg-danger/10 text-danger line-through opacity-75'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <td
                    onDoubleClick={() => startEditing('existing', rowIndex, 'name')}
                    title={onSaveChanges && !isDeleted ? 'Duplo clique para editar nome' : undefined}
                    className={`relative whitespace-nowrap px-4 py-1 font-semibold text-ink ${
                      isFieldDirty(rowIndex, 'name') ? 'bg-online/10' : ''
                    }`}
                  >
                    <span className={isEditingName ? 'invisible' : ''}>{col.name}</span>
                    {renderEditableOverlay('existing', rowIndex, 'name', originalCol.name)}
                  </td>

                  <td
                    onDoubleClick={() => startEditing('existing', rowIndex, 'dataType')}
                    title={onSaveChanges && !isDeleted ? 'Duplo clique para editar tipo' : undefined}
                    className={`relative whitespace-nowrap px-4 py-1 text-ink-secondary ${
                      isFieldDirty(rowIndex, 'dataType') ? 'bg-online/10 font-semibold text-ink' : ''
                    }`}
                  >
                    <span className={isEditingType ? 'invisible' : ''}>{col.dataType}</span>
                    {renderEditableOverlay('existing', rowIndex, 'dataType', originalCol.dataType)}
                  </td>

                  <td
                    onDoubleClick={() => startEditing('existing', rowIndex, 'nullable')}
                    title={
                      onSaveChanges && !isDeleted ? 'Duplo clique para editar (YES / NO)' : undefined
                    }
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
                    {renderEditableOverlay('existing', rowIndex, 'nullable', 'YES / NO')}
                  </td>

                  <td
                    onDoubleClick={() => startEditing('existing', rowIndex, 'defaultValue')}
                    title={
                      onSaveChanges && !isDeleted
                        ? 'Duplo clique para editar valor padrão'
                        : undefined
                    }
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
                    {renderEditableOverlay('existing', rowIndex, 'defaultValue', 'NULL')}
                  </td>

                  <td
                    onDoubleClick={() => startEditing('existing', rowIndex, 'isPrimaryKey')}
                    title={
                      onSaveChanges && !isDeleted
                        ? 'Duplo clique para editar chave (PK / NO)'
                        : undefined
                    }
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
                    {renderEditableOverlay('existing', rowIndex, 'isPrimaryKey', 'PK / NO', true)}
                  </td>

                  <td className="px-2 py-1 text-center font-sans">
                    <button
                      type="button"
                      disabled={!onSaveChanges || savingChanges}
                      aria-label={isDeleted ? `Restaurar coluna ${col.name}` : `Excluir coluna ${col.name}`}
                      title={isDeleted ? 'Desfazer exclusão' : 'Excluir coluna'}
                      onClick={() => toggleDeleteExistingRow(rowIndex)}
                      className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                        isDeleted
                          ? 'text-ink hover:bg-muted'
                          : 'text-ink-muted hover:bg-danger/10 hover:text-danger'
                      }`}
                    >
                      {isDeleted ? (
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-3.5 w-3.5">
                          <path d="M4 7h6a3 3 0 1 1 0 6H6M4 7l2.5-2.5M4 7l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-3.5 w-3.5">
                          <path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.5 8.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}

            {addedColumns.map((col, addedIndex) => {
              const isEditingName =
                editingCell?.target === 'added' &&
                editingCell.rowIndex === addedIndex &&
                editingCell.field === 'name';
              const isEditingType =
                editingCell?.target === 'added' &&
                editingCell.rowIndex === addedIndex &&
                editingCell.field === 'dataType';
              const isEditingNull =
                editingCell?.target === 'added' &&
                editingCell.rowIndex === addedIndex &&
                editingCell.field === 'nullable';
              const isEditingDefault =
                editingCell?.target === 'added' &&
                editingCell.rowIndex === addedIndex &&
                editingCell.field === 'defaultValue';
              const isEditingPk =
                editingCell?.target === 'added' &&
                editingCell.rowIndex === addedIndex &&
                editingCell.field === 'isPrimaryKey';

              return (
                <tr key={`added-${addedIndex}`} className="bg-online/10 transition-colors">
                  <td
                    onDoubleClick={() => startEditing('added', addedIndex, 'name')}
                    title="Duplo clique para editar nome"
                    className="relative whitespace-nowrap px-4 py-1 font-semibold text-ink"
                  >
                    <span className={isEditingName ? 'invisible' : ''}>{col.name}</span>
                    {renderEditableOverlay('added', addedIndex, 'name', 'nome_da_coluna')}
                  </td>

                  <td
                    onDoubleClick={() => startEditing('added', addedIndex, 'dataType')}
                    title="Duplo clique para editar tipo"
                    className="relative whitespace-nowrap px-4 py-1 font-semibold text-ink"
                  >
                    <span className={isEditingType ? 'invisible' : ''}>{col.dataType}</span>
                    {renderEditableOverlay('added', addedIndex, 'dataType', 'varchar(255)')}
                  </td>

                  <td
                    onDoubleClick={() => startEditing('added', addedIndex, 'nullable')}
                    title="Duplo clique para editar (YES / NO)"
                    className="relative whitespace-nowrap px-4 py-1 font-sans"
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
                    {renderEditableOverlay('added', addedIndex, 'nullable', 'YES / NO')}
                  </td>

                  <td
                    onDoubleClick={() => startEditing('added', addedIndex, 'defaultValue')}
                    title="Duplo clique para editar valor padrão"
                    className="relative whitespace-nowrap px-4 py-1 font-semibold text-ink"
                  >
                    <span className={isEditingDefault ? 'invisible' : ''}>
                      {col.defaultValue ?? (
                        <span className="rounded bg-muted px-1 py-0.2 font-normal text-[10px] text-ink-muted">
                          NULL
                        </span>
                      )}
                    </span>
                    {renderEditableOverlay('added', addedIndex, 'defaultValue', 'NULL')}
                  </td>

                  <td
                    onDoubleClick={() => startEditing('added', addedIndex, 'isPrimaryKey')}
                    title="Duplo clique para editar chave (PK / NO)"
                    className="relative whitespace-nowrap px-4 py-1 text-right font-sans"
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
                    {renderEditableOverlay('added', addedIndex, 'isPrimaryKey', 'PK / NO', true)}
                  </td>

                  <td className="px-2 py-1 text-center font-sans">
                    <button
                      type="button"
                      disabled={savingChanges}
                      aria-label={`Remover nova coluna ${col.name}`}
                      title="Remover coluna"
                      onClick={() => removeAddedRow(addedIndex)}
                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-3.5 w-3.5">
                        <path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.5 8.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
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
