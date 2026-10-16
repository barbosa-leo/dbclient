import type { ColumnInfo } from '@/services/schemas';

export function TableStructure({ columns }: { columns: ColumnInfo[] }) {
  if (columns.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-brand-300/80 bg-white/60 p-10 text-center text-xs font-medium text-brand-700 shadow-card">
        Nenhuma coluna encontrada para este objeto.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-300/60 bg-white/95 shadow-card backdrop-blur-sm">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-brand-300/50 bg-brand-900 font-display text-[10px] font-semibold tracking-wider text-brand-50 uppercase">
          <tr>
            <th className="px-5 py-3">Coluna</th>
            <th className="px-5 py-3">Tipo</th>
            <th className="px-5 py-3">Nulo</th>
            <th className="px-5 py-3">Padrão</th>
            <th className="px-5 py-3 text-right">Chave</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-300/30 font-mono text-[11px]">
          {columns.map((column) => (
            <tr key={column.name} className="transition-colors hover:bg-brand-50/50">
              <td className="px-5 py-2.5 font-semibold text-brand-900">{column.name}</td>
              <td className="px-5 py-2.5 text-brand-700">{column.dataType}</td>
              <td className="px-5 py-2.5 font-sans">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    column.nullable
                      ? 'bg-brand-50 text-brand-700'
                      : 'border border-brand-300/60 bg-white text-brand-900'
                  }`}
                >
                  {column.nullable ? 'YES' : 'NO'}
                </span>
              </td>
              <td className="px-5 py-2.5 text-brand-700">
                {column.defaultValue ?? (
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-500">
                    NULL
                  </span>
                )}
              </td>
              <td className="px-5 py-2.5 text-right font-display">
                {column.isPrimaryKey && (
                  <span className="rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase shadow-xs">
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
