import type { ReactNode, RefObject } from 'react';
import { Button } from '@/components/ui/Button';
import { MAX_SQL_LENGTH } from '@/services/query';
import { SqlAutocompleteEditor } from './SqlAutocompleteEditor';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  databaseName: string | null;
  connectionId: number | null;
  metadataRevision: number;
  onRun: (statement: string) => void;
  running: boolean;
  disabled: boolean;
  readOnly: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  height: number;
  fill: boolean;
  editorAreaRef: RefObject<HTMLDivElement | null>;
  resizeHandle: ReactNode;
}

export function SqlEditor({
  value,
  onChange,
  databaseName,
  connectionId,
  metadataRevision,
  onRun,
  running,
  disabled,
  readOnly,
  collapsed,
  onToggleCollapse,
  height,
  fill,
  editorAreaRef,
  resizeHandle,
}: SqlEditorProps) {
  const nearLimit = value.length >= MAX_SQL_LENGTH * 0.9;
  const expanded = !collapsed;

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-line bg-panel px-2.5 pt-2.5 shadow-card sm:px-3 sm:pt-3 ${
        expanded && fill ? 'min-h-0 flex-1' : 'shrink-0'
      } ${expanded ? 'pb-0.5' : 'pb-2.5 sm:pb-3'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-ink-secondary">
          <span className="font-medium">Banco:</span>
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono font-medium text-ink">
            {databaseName ?? '—'}
          </span>
          {readOnly && (
            <span
              title="Sua permissão neste ambiente é somente leitura: as consultas rodam em transação somente leitura, um comando por vez."
              className="rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-ink-secondary"
            >
              Somente leitura
            </span>
          )}
          {collapsed && value.trim() && (
            <span className="hidden max-w-[200px] truncate font-mono text-[11px] text-ink-muted sm:inline md:max-w-md">
              {value.replace(/\s+/g, ' ').slice(0, 50)}...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className={`hidden font-mono text-[11px] sm:inline ${nearLimit ? 'text-danger' : 'text-ink-muted'}`}>
            {value.length}/{MAX_SQL_LENGTH}
            <span className="hidden md:inline"> · Ctrl+Enter</span>
          </span>

          {expanded && value && (
            <button
              type="button"
              onClick={() => onChange('')}
              title="Limpar o editor e o rascunho salvo desta conexão"
              className="flex h-7 cursor-pointer items-center rounded-md border border-line bg-subtle px-2 text-[11px] font-medium text-ink transition-colors hover:bg-muted"
            >
              Limpar
            </button>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Mostrar editor SQL' : 'Ocultar editor SQL'}
            title={collapsed ? 'Mostrar editor SQL' : 'Ocultar editor SQL para ver mais dados'}
            className="flex h-7 cursor-pointer items-center gap-1 rounded-md border border-line bg-subtle px-2 text-[11px] font-medium text-ink transition-colors hover:bg-muted"
          >
            <span>{collapsed ? 'Mostrar editor' : 'Ocultar'}</span>
            <span aria-hidden="true" className="text-ink-muted">
              {collapsed ? '▾' : '▴'}
            </span>
          </button>

          <Button
            size="sm"
            onClick={() => onRun(value)}
            disabled={disabled || running || !value.trim()}
          >
            {running ? 'Executando...' : 'Executar'}
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          <div
            ref={editorAreaRef}
            style={fill ? undefined : { height }}
            className={fill ? 'min-h-0 flex-1' : undefined}
          >
            <SqlAutocompleteEditor
              value={value}
              onChange={onChange}
              onRun={(statement) => {
                if (!running) onRun(statement);
              }}
              connectionId={connectionId}
              metadataRevision={metadataRevision}
              disabled={disabled}
              height="100%"
            />
          </div>
          {resizeHandle}
        </>
      )}
    </div>
  );
}
