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
}

export function SqlEditor({
  value,
  onChange,
  databaseName,
  onRun,
  running,
  disabled,
}: SqlEditorProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onRun();
    }
  }

  const nearLimit = value.length >= MAX_SQL_LENGTH * 0.9;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 sm:p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 text-xs text-ink-secondary">
          <span className="font-medium">Banco de dados:</span>
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono font-medium text-ink">
            {databaseName ?? '—'}
          </span>
        </div>

        <span className={`font-mono text-[11px] ${nearLimit ? 'text-danger' : 'text-ink-muted'}`}>
          {value.length}/{MAX_SQL_LENGTH} caracteres
          <span className="hidden sm:inline"> · Ctrl/⌘ + Enter para executar</span>
        </span>
      </div>

      <SqlCodeEditor
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        maxLength={MAX_SQL_LENGTH}
        disabled={disabled || running}
        ariaLabel="Consulta SQL"
        placeholder="SELECT * FROM ..."
        minHeight="160px"
      />

      <div className="flex items-center justify-end">
        <Button
          onClick={onRun}
          disabled={disabled || running || !value.trim()}
          className="w-full sm:w-auto"
        >
          {running ? 'Executando...' : 'Executar'}
        </Button>
      </div>
    </div>
  );
}
