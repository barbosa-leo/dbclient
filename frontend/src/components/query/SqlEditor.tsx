import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { MAX_SQL_LENGTH } from '@/services/query';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  running: boolean;
  disabled: boolean;
}

export function SqlEditor({ value, onChange, onRun, running, disabled }: SqlEditorProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onRun();
    }
  }

  const nearLimit = value.length >= MAX_SQL_LENGTH * 0.9;

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={MAX_SQL_LENGTH}
        spellCheck={false}
        rows={10}
        aria-label="Consulta SQL"
        placeholder="SELECT * FROM ..."
        className="w-full resize-y rounded-xl border border-brand-300 bg-white p-4 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-accent"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${nearLimit ? 'text-danger' : 'text-brand-700'}`}>
          {value.length}/{MAX_SQL_LENGTH} caracteres · Ctrl/⌘ + Enter para executar
        </span>
        <Button onClick={onRun} disabled={disabled || running || !value.trim()}>
          {running ? 'Executando...' : 'Executar'}
        </Button>
      </div>
    </div>
  );
}
