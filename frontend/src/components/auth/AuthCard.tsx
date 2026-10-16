import type { ReactNode } from 'react';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-brand-300/60 bg-white/95 p-8 shadow-card backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-900 font-display text-xs font-bold tracking-wider text-white shadow-glow">
            DB
          </span>
          <h1 className="font-display text-lg font-bold tracking-tight text-brand-900">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
