import type { SchemaInfo, TableKind } from '@/services/explorer';

const kindLabels: Record<TableKind, string> = {
  table: 'tabela',
  view: 'view',
  materialized_view: 'view materializada',
};

export function SchemaTree({ schemas }: { schemas: SchemaInfo[] }) {
  if (schemas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-brand-300/80 bg-white/60 p-10 text-center text-xs font-medium text-brand-700 shadow-card">
        Nenhum schema encontrado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {schemas.map((schema) => (
        <details
          key={schema.name}
          className="group overflow-hidden rounded-2xl border border-brand-300/60 bg-white/95 shadow-card transition-shadow hover:shadow-card-hover"
          open={schema.name === 'public'}
        >
          <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 font-display text-sm font-semibold text-brand-900 select-none">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-brand-500" />
              <span>{schema.name}</span>
            </div>
            <span className="rounded-full border border-brand-300/50 bg-brand-50 px-2.5 py-0.5 font-sans text-[11px] font-medium text-brand-700">
              {schema.tables.length} {schema.tables.length === 1 ? 'objeto' : 'objetos'}
            </span>
          </summary>
          <ul className="divide-y divide-brand-300/35 border-t border-brand-300/45 bg-brand-50/25">
            {schema.tables.map((table) => (
              <li
                key={table.name}
                className="flex items-center justify-between px-6 py-2.5 transition-colors hover:bg-white"
              >
                <span className="font-mono text-xs font-medium text-brand-900">{table.name}</span>
                <span className="rounded-full border border-brand-300/50 bg-white px-2.5 py-0.5 font-display text-[10px] font-semibold tracking-wider text-brand-700 uppercase">
                  {kindLabels[table.kind]}
                </span>
              </li>
            ))}
            {schema.tables.length === 0 && (
              <li className="px-6 py-3 text-xs text-brand-700">Schema vazio.</li>
            )}
          </ul>
        </details>
      ))}
    </div>
  );
}
