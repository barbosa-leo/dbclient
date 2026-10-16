import type { ReactNode } from 'react';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-brand-300 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-brand-900">{title}</h1>
        {children}
      </div>
    </main>
  );
}
