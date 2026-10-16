import type { ColumnInfo } from '@/services/explorer';

export function TableStructure({ columns }: { columns: ColumnInfo[] }) {
  if (columns.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-panel p-8 text-center text-xs font-medium text-ink-muted shadow-card">
        Nenhuma coluna encontrada para este objeto.
      </p>
    );
  }

  return (
    <div className="min-h-0 overflow-auto rounded-xl border border-line bg-panel shadow-card">
      <table className="w-full text-left text-xs leading-tight">
        <thead className="sticky top-0 z-10 border-b border-line bg-subtle text-[11px] font-medium text-ink-muted">
          <tr>
            <th className="px-4 py-1.5">Coluna</th>
            <th className="px-4 py-1.5">Tipo</th>
            <th className="px-4 py-1.5">Nulo</th>
            <th className="px-4 py-1.5">Padrão</th>
            <th className="px-4 py-1.5 text-right">Chave</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line font-mono text-[11px] leading-tight">
          {columns.map((column) => (
            <tr key={column.name} className="transition-colors hover:bg-muted/50">
              <td className="px-4 py-1 font-semibold text-ink">{column.name}</td>
              <td className="px-4 py-1 text-ink-secondary">{column.dataType}</td>
              <td className="px-4 py-1 font-sans">
                <span
                  className={`rounded px-1.5 py-0.2 text-[10px] font-medium ${
                    column.nullable
                      ? 'bg-muted text-ink-secondary'
                      : 'border border-line bg-panel text-ink'
                  }`}
                >
                  {column.nullable ? 'YES' : 'NO'}
                </span>
              </td>
              <td className="px-4 py-1 text-ink-secondary">
                {column.defaultValue ?? (
                  <span className="rounded bg-muted px-1 py-0.2 text-[10px] text-ink-muted">
                    NULL
                  </span>
                )}
              </td>
              <td className="px-4 py-1 text-right font-sans">
                {column.isPrimaryKey && (
                  <span className="rounded bg-cta px-1.5 py-0.2 text-[10px] font-semibold text-cta-fg">
                    PK
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
