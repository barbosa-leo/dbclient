import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { SqlCodeEditor } from '@/components/ui/SqlCodeEditor';
import { MAX_SQL_LENGTH } from '@/services/query';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  databaseName: string | null;
  onRun: () => void;
  running: boolean;
  disabled: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SqlEditor({
  value,
  onChange,
  databaseName,
  onRun,
  running,
  disabled,
  collapsed = false,
  onToggleCollapse,
}: SqlEditorProps) {
  const [expandedHeight, setExpandedHeight] = useState(false);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onRun();
    }
  }

  const nearLimit = value.length >= MAX_SQL_LENGTH * 0.9;
  const editorHeight = expandedHeight ? '200px' : '105px';

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-2.5 sm:p-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-ink-secondary">
          <span className="font-medium">Banco:</span>
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono font-medium text-ink">
            {databaseName ?? '—'}
          </span>
          {collapsed && value.trim() && (
            <span className="hidden max-w-[200px] md:max-w-md truncate font-mono text-[11px] text-ink-muted sm:inline">
              {value.replace(/\s+/g, ' ').slice(0, 50)}...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className={`hidden font-mono text-[11px] sm:inline ${nearLimit ? 'text-danger' : 'text-ink-muted'}`}>
            {value.length}/{MAX_SQL_LENGTH}
            <span className="hidden md:inline"> · Ctrl+Enter</span>
          </span>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setExpandedHeight(!expandedHeight)}
              aria-label={expandedHeight ? 'Reduzir altura do editor' : 'Aumentar altura do editor'}
              title={expandedHeight ? 'Reduzir altura para 105px' : 'Aumentar altura para 200px'}
              className="flex h-7 cursor-pointer items-center rounded-md border border-line bg-subtle px-2 text-[11px] font-medium text-ink transition-colors hover:bg-muted"
            >
              {expandedHeight ? 'Compactar' : 'Mais linhas'}
            </button>
          )}

          {onToggleCollapse && (
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
          )}

          <Button
            size="sm"
            onClick={onRun}
            disabled={disabled || running || !value.trim()}
          >
            {running ? 'Executando...' : 'Executar'}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <SqlCodeEditor
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          maxLength={MAX_SQL_LENGTH}
          disabled={disabled || running}
          ariaLabel="Consulta SQL"
          placeholder="SELECT * FROM ..."
          height={editorHeight}
        />
      )}
    </div>
  );
}
