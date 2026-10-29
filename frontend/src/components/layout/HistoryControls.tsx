'use client';

import type { ReactNode } from 'react';

interface HistoryButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
}

function HistoryButton({ label, onClick, children }: HistoryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-muted hover:text-ink lg:h-8 lg:w-8"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-[17px] w-[17px]"
      >
        {children}
      </svg>
    </button>
  );
}

export function HistoryControls() {
  return (
    <div className="flex items-center gap-0.5">
      <HistoryButton label="Voltar" onClick={() => window.history.back()}>
        <path d="m15 18-6-6 6-6" />
      </HistoryButton>
      <HistoryButton label="Avançar" onClick={() => window.history.forward()}>
        <path d="m9 18 6-6-6-6" />
      </HistoryButton>
      <HistoryButton label="Recarregar" onClick={() => window.location.reload()}>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v4h-4" />
      </HistoryButton>
    </div>
  );
}
