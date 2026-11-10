import type { HTMLAttributes } from 'react';

interface ResizeHandleProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: number;
  min: number;
  max: number;
}

export function ResizeHandle({ label, value, min, max, ...handlers }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={Math.round(Math.max(min, max))}
      tabIndex={0}
      title={`${label} (arraste, use as setas ou dê um duplo clique para restaurar)`}
      className="group flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
      {...handlers}
    >
      <span className="h-1 w-10 rounded-full bg-line transition-colors group-hover:bg-line-strong group-active:bg-cta" />
    </div>
  );
}
