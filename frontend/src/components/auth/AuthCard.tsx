import type { ReactNode } from 'react';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-panel p-7 shadow-card">
        <div className="mb-6 flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="DBClient logo"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-md object-contain"
          />
          <h1 className="text-base font-semibold tracking-tight text-ink">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
