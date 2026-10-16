import type { ColumnInfo } from '@/services/schemas';

export function TableStructure({ columns }: { columns: ColumnInfo[] }) {
  if (columns.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-panel p-10 text-center text-xs font-medium text-ink-muted shadow-card">
        Nenhuma coluna encontrada para este objeto.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-line bg-subtle text-xs font-medium text-ink-muted">
          <tr>
            <th className="px-5 py-3">Coluna</th>
            <th className="px-5 py-3">Tipo</th>
            <th className="px-5 py-3">Nulo</th>
            <th className="px-5 py-3">Padrão</th>
            <th className="px-5 py-3 text-right">Chave</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line font-mono text-[11px]">
          {columns.map((column) => (
            <tr key={column.name} className="transition-colors hover:bg-muted/50">
              <td className="px-5 py-2.5 font-semibold text-ink">{column.name}</td>
              <td className="px-5 py-2.5 text-ink-secondary">{column.dataType}</td>
              <td className="px-5 py-2.5 font-sans">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                    column.nullable
                      ? 'bg-muted text-ink-secondary'
                      : 'border border-line bg-panel text-ink'
                  }`}
                >
                  {column.nullable ? 'YES' : 'NO'}
                </span>
              </td>
              <td className="px-5 py-2.5 text-ink-secondary">
                {column.defaultValue ?? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-ink-muted">
                    NULL
                  </span>
                )}
              </td>
              <td className="px-5 py-2.5 text-right font-sans">
                {column.isPrimaryKey && (
                  <span className="rounded-md bg-cta px-2 py-0.5 text-[10px] font-semibold text-cta-fg">
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
