import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { MAX_SQL_LENGTH } from '@/services/query';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  databases: readonly string[];
  selectedDatabase: string;
  onSelectDatabase: (database: string) => void;
  onRun: () => void;
  running: boolean;
  disabled: boolean;
}

export function SqlEditor({
  value,
  onChange,
  databases,
  selectedDatabase,
  onSelectDatabase,
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
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-secondary">Banco de dados</span>
          <select
            value={selectedDatabase}
            disabled={disabled || running || databases.length === 0}
            onChange={(e) => onSelectDatabase(e.target.value)}
            className="h-8 cursor-pointer rounded-lg border border-line bg-panel px-2.5 font-mono text-xs font-medium text-ink transition-colors outline-none hover:bg-muted focus:border-line-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {databases.map((db) => (
              <option key={db} value={db}>
                {db}
              </option>
            ))}
          </select>
        </label>

        <span className={`font-mono text-[11px] ${nearLimit ? 'text-danger' : 'text-ink-muted'}`}>
          {value.length}/{MAX_SQL_LENGTH} caracteres · Ctrl/⌘ + Enter para executar
        </span>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={MAX_SQL_LENGTH}
        spellCheck={false}
        rows={6}
        aria-label="Consulta SQL"
        placeholder="SELECT * FROM ..."
        className="w-full resize-y rounded-lg border border-line bg-subtle p-4 font-mono text-xs leading-relaxed text-ink transition-colors outline-none focus:border-line-strong focus:bg-panel"
      />

      <div className="flex items-center justify-end">
        <Button onClick={onRun} disabled={disabled || running || !selectedDatabase || !value.trim()}>
          {running ? 'Executando...' : 'Executar'}
        </Button>
      </div>
    </div>
  );
}
