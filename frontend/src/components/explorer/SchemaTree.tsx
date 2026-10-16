import type { SchemaInfo, TableKind } from '@/services/explorer';

const kindLabels: Record<TableKind, string> = {
  table: 'tabela',
  view: 'view',
  materialized_view: 'view materializada',
};

export function SchemaTree({ schemas }: { schemas: SchemaInfo[] }) {
  if (schemas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-brand-300 p-8 text-center text-sm text-brand-700">
        Nenhum schema encontrado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {schemas.map((schema) => (
        <details key={schema.name} className="rounded-xl border border-brand-300 bg-white" open={schema.name === 'public'}>
          <summary className="cursor-pointer px-4 py-3 font-medium text-brand-900">
            {schema.name}
            <span className="ml-2 text-xs font-normal text-brand-700">
              {schema.tables.length} {schema.tables.length === 1 ? 'objeto' : 'objetos'}
            </span>
          </summary>
          <ul className="border-t border-brand-300">
            {schema.tables.map((table) => (
              <li
                key={table.name}
                className="flex items-center justify-between border-b border-brand-300 px-6 py-2 text-sm last:border-b-0"
              >
                <span className="font-mono">{table.name}</span>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                  {kindLabels[table.kind]}
                </span>
              </li>
            ))}
            {schema.tables.length === 0 && (
              <li className="px-6 py-3 text-sm text-brand-700">Schema vazio.</li>
            )}
          </ul>
        </details>
      ))}
    </div>
  );
}
