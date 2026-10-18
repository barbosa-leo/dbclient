'use client';

import type { KeyboardEvent } from 'react';
import { useEffect, useState } from 'react';
import { MAX_SQL_LENGTH } from '@/services/query';

interface ObjectDefinitionEditorProps {
  definition: string;
  objectLabel: string;
  isNewTemplate?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  onSave?: (sql: string) => Promise<void> | void;
  saving?: boolean;
  savedMessage?: string | null;
}

export function ObjectDefinitionEditor({
  definition,
  objectLabel,
  isNewTemplate = false,
  onRefresh,
  refreshing = false,
  onSave,
  saving = false,
  savedMessage = null,
}: ObjectDefinitionEditorProps) {
  const [draft, setDraft] = useState(definition);

  useEffect(() => {
    setDraft(definition);
  }, [definition]);

  const hasChanges =
    draft.trim().length > 0 && (isNewTemplate || draft.trim() !== definition.trim());
  const canRefresh = Boolean(onRefresh) && !isNewTemplate && !refreshing && !saving;
  const canSaveOrCancel = Boolean(onSave) && hasChanges && !saving;
  const nearLimit = draft.length >= MAX_SQL_LENGTH * 0.9;

  async function handleSave() {
    if (!onSave || !canSaveOrCancel) return;
    await onSave(draft);
  }

  function handleCancel() {
    setDraft(definition);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (canSaveOrCancel) {
        void handleSave();
      }
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs shadow-card">
        <div className="flex min-w-0 flex-wrap items-center gap-3 font-mono text-[11px] text-ink-muted">
          {hasChanges ? (
            <span className="font-semibold text-ink">
              Definição modificada · Salve para aplicar no banco
            </span>
          ) : savedMessage ? (
            <span className="font-semibold text-online">{savedMessage}</span>
          ) : (
            <span>
              Edite a definição SQL de <strong className="text-ink">{objectLabel}</strong> · Ctrl/⌘
              + Enter para salvar
            </span>
          )}
          <span className={nearLimit ? 'text-danger' : 'text-ink-muted'}>
            {draft.length}/{MAX_SQL_LENGTH} caracteres
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={!canRefresh}
            aria-label="Atualizar definição"
            title="Atualizar definição"
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
            aria-label="Salvar definição"
            title="Salvar definição (Ctrl/⌘ + Enter)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void handleSave()}
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
            aria-label="Cancelar alterações"
            title="Cancelar alterações"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCancel}
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

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-panel shadow-card">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_SQL_LENGTH}
          disabled={saving}
          spellCheck={false}
          aria-label={`Editor SQL de ${objectLabel}`}
          className="h-full min-h-[360px] w-full flex-1 resize-none bg-subtle/40 p-4 font-mono text-xs leading-relaxed text-ink outline-none focus:bg-panel disabled:opacity-60"
        />
      </div>
    </div>
  );
}
