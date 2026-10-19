'use client';

import type { KeyboardEvent } from 'react';
import { useId, useMemo, useRef } from 'react';

interface SqlCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  maxLength?: number;
  minHeight?: string;
  className?: string;
  ariaLabel?: string;
}

const SQL_KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'INSERT',
  'INTO',
  'UPDATE',
  'SET',
  'DELETE',
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'FULL',
  'OUTER',
  'CROSS',
  'ON',
  'GROUP',
  'BY',
  'ORDER',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'UNION',
  'ALL',
  'CREATE',
  'ALTER',
  'DROP',
  'TABLE',
  'VIEW',
  'MATERIALIZED',
  'INDEX',
  'PROCEDURE',
  'FUNCTION',
  'TRIGGER',
  'OR',
  'REPLACE',
  'IF',
  'EXISTS',
  'PRIMARY',
  'KEY',
  'FOREIGN',
  'REFERENCES',
  'NOT',
  'NULL',
  'DEFAULT',
  'CHECK',
  'UNIQUE',
  'CONSTRAINT',
  'CASCADE',
  'RESTRICT',
  'ACTION',
  'BEGIN',
  'END',
  'RETURNS',
  'LANGUAGE',
  'AS',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'AND',
  'IN',
  'IS',
  'LIKE',
  'ILIKE',
  'BETWEEN',
  'WITH',
  'VALUES',
  'USING',
  'EXECUTE',
  'ROW',
  'EACH',
  'BEFORE',
  'AFTER',
  'FOR',
  'TRUE',
  'FALSE',
]);

const SQL_TYPES_AND_FUNCS = new Set([
  'BIGINT',
  'BIGSERIAL',
  'INTEGER',
  'INT',
  'SMALLINT',
  'SERIAL',
  'VARCHAR',
  'CHAR',
  'TEXT',
  'BOOLEAN',
  'BOOL',
  'TIMESTAMP',
  'TIMESTAMPTZ',
  'DATE',
  'TIME',
  'NUMERIC',
  'DECIMAL',
  'FLOAT',
  'REAL',
  'JSON',
  'JSONB',
  'UUID',
  'BYTEA',
  'VOID',
  'NOW',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'COALESCE',
  'CAST',
  'PLPGSQL',
]);

function highlightSql(sqlText: string): string {
  if (!sqlText) return '';

  const tokenRegex =
    /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|\$\$[\s\S]*?\$\$|\b\d+(?:\.\d+)?\b|[a-zA-Z_][a-zA-Z0-9_$]*|[^\s\w])/g;

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return sqlText.replace(tokenRegex, (token) => {
    if (token.startsWith('--') || token.startsWith('/*')) {
      return `<span style="color:var(--syntax-comment)" class="italic font-normal">${escapeHtml(token)}</span>`;
    }
    if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('$$') && token.endsWith('$$'))) {
      return `<span style="color:var(--syntax-string)" class="font-normal">${escapeHtml(token)}</span>`;
    }
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      return `<span style="color:var(--syntax-number)" class="font-normal">${escapeHtml(token)}</span>`;
    }
    const upper = token.toUpperCase();
    if (SQL_KEYWORDS.has(upper)) {
      return `<span style="color:var(--syntax-keyword)" class="font-semibold">${escapeHtml(token)}</span>`;
    }
    if (SQL_TYPES_AND_FUNCS.has(upper)) {
      return `<span style="color:var(--syntax-type)" class="font-medium">${escapeHtml(token)}</span>`;
    }
    return escapeHtml(token);
  });
}

export function SqlCodeEditor({
  value,
  onChange,
  onKeyDown,
  placeholder = '',
  readOnly = false,
  disabled = false,
  maxLength,
  minHeight = '140px',
  className = '',
  ariaLabel = 'Editor SQL',
}: SqlCodeEditorProps) {
  const id = useId();
  const preRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const highlightedHtml = useMemo(() => {
    const html = highlightSql(value);
    return html.endsWith('\n') ? `${html} ` : html;
  }, [value]);

  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }

  function handleInternalKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab' && !readOnly && !disabled) {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const nextValue = `${value.substring(0, start)}  ${value.substring(end)}`;
      onChange?.(nextValue);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
      return;
    }
    onKeyDown?.(e);
  }

  return (
    <div
      style={{ minHeight }}
      className={`relative w-full overflow-hidden rounded-lg border border-line bg-subtle font-mono text-base lg:text-xs leading-relaxed transition-colors focus-within:border-line-strong focus-within:bg-panel ${className}`}
    >
      <pre
        ref={preRef}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: highlightedHtml || `<span class="text-ink-muted/40">${placeholder}</span>` }}
        className="pointer-events-none absolute inset-0 m-0 h-full w-full overflow-auto p-4 whitespace-pre-wrap break-words font-mono text-base lg:text-xs leading-relaxed text-ink"
      />
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onScroll={handleScroll}
        onKeyDown={handleInternalKeyDown}
        maxLength={maxLength}
        readOnly={readOnly}
        disabled={disabled}
        spellCheck={false}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="relative z-10 m-0 h-full min-h-[inherit] w-full resize-y overflow-auto bg-transparent p-4 whitespace-pre-wrap break-words font-mono text-base lg:text-xs leading-relaxed text-transparent caret-ink outline-none selection:bg-cta/25 placeholder:text-transparent disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
