'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  MAX_ROW_LIMIT,
  MIN_ROW_LIMIT,
  ROW_LIMIT_PRESETS,
  clampRowLimit,
} from '@/services/query';

interface RowLimitSelectorProps {
  value: number;
  autoValue: number;
  rowCount: number;
  disabled: boolean;
  onChange: (limit: number) => void;
}

export function RowLimitSelector({
  value,
  autoValue,
  rowCount,
  disabled,
  onChange,
}: RowLimitSelectorProps) {
  const [draft, setDraft] = useState(String(value));
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function commitValue(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setDraft(String(value));
      return;
    }
    const next = clampRowLimit(Number(trimmed));
    setDraft(String(next));
    if (next !== value) {
      onChange(next);
    }
  }

  function selectOption(target: number) {
    const next = clampRowLimit(target);
    setDraft(String(next));
    setOpen(false);
    if (next !== value) {
      onChange(next);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      setOpen(false);
      commitValue(draft);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setDraft(String(value));
    }
  }

  const isAuto = value === autoValue;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <span className="font-mono text-[11px] text-ink-muted">
        Exibindo <strong className="font-semibold text-ink">{rowCount}</strong> linha(s)
      </span>

      <div className="flex items-center gap-2.5">
        <span className="text-xs font-medium text-ink-secondary">Linhas (limit)</span>

        <div ref={containerRef} className="relative">
          <div className="flex items-center rounded-lg border border-line bg-panel transition-colors focus-within:border-line-strong">
            {isAuto && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-online">
                Auto
              </span>
            )}
            <input
              type="text"
              inputMode="numeric"
              disabled={disabled}
              value={draft}
              aria-label={`Limite de linhas (${MIN_ROW_LIMIT} a ${MAX_ROW_LIMIT})`}
              onFocus={() => setOpen(true)}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
              onBlur={() => commitValue(draft)}
              onKeyDown={handleKeyDown}
              className="w-20 bg-transparent px-2.5 py-1.5 font-mono text-base sm:text-xs font-semibold text-ink outline-none disabled:opacity-50"
            />
            <button
              type="button"
              disabled={disabled}
              aria-label="Opções de limite de linhas"
              aria-expanded={open}
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen((prev) => !prev);
              }}
              className="cursor-pointer border-l border-line px-2.5 py-2 sm:px-2 sm:py-1.5 text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {open && !disabled && (
            <div
              role="listbox"
              aria-label="Opções de limite"
              className="absolute right-0 bottom-full z-20 mb-1.5 max-h-60 w-44 overflow-y-auto rounded-xl border border-line bg-panel p-1 shadow-card-hover"
            >
              <button
                type="button"
                role="option"
                aria-selected={isAuto}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(autoValue);
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 sm:py-1.5 text-left font-mono text-xs sm:text-[11px] transition-colors ${
                  isAuto
                    ? 'bg-muted font-semibold text-ink'
                    : 'text-ink-secondary hover:bg-muted/70 hover:text-ink'
                }`}
              >
                <span>Auto ({autoValue})</span>
                <span className="font-sans text-[10px] font-medium text-online">Tela</span>
              </button>

              <div className="my-1 border-t border-line" />

              {ROW_LIMIT_PRESETS.map((preset) => {
                const selected = value === preset && !isAuto;
                return (
                  <button
                    key={preset}
                    type="button"
                    role="option"
                    aria-selected={value === preset}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectOption(preset);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 sm:py-1.5 text-left font-mono text-xs sm:text-[11px] transition-colors ${
                      value === preset
                        ? 'bg-muted font-semibold text-ink'
                        : 'text-ink-secondary hover:bg-muted/70 hover:text-ink'
                    }`}
                  >
                    <span>{preset.toLocaleString('pt-BR')}</span>
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-online" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <span className="hidden font-mono text-[10px] text-ink-muted sm:inline">
          ({MIN_ROW_LIMIT}–{MAX_ROW_LIMIT.toLocaleString('pt-BR')})
        </span>
      </div>
    </div>
  );
}
