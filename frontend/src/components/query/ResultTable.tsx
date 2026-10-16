import type { QueryResult } from '@/services/query';

function formatCell(value: unknown): string {
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function ResultTable({ result }: { result: QueryResult }) {
  if (result.columns.length === 0) {
    return (
      <p className="rounded-2xl border border-brand-300/60 bg-white/95 p-5 text-xs font-medium text-brand-900 shadow-card">
        Comando executado
        {result.rowsAffected !== null && ` — ${result.rowsAffected} linha(s) afetada(s)`} em{' '}
        <span className="font-mono font-semibold text-brand-700">{result.durationMs} ms</span>.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-300/60 bg-white/95 shadow-card backdrop-blur-sm">
      <table className="w-full text-left font-mono text-[11px] leading-relaxed">
        <thead className="border-b border-brand-300/50 bg-brand-900 font-display text-[10px] font-semibold tracking-wider text-brand-50 uppercase">
          <tr>
            {result.columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-4 py-2.5">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-300/30">
          {result.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="transition-colors hover:bg-brand-50/50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="whitespace-nowrap px-4 py-2 text-brand-900">
                  {cell === null ? (
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-500">
                      NULL
                    </span>
                  ) : (
                    formatCell(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length === 0 && (
        <p className="p-6 text-center font-sans text-xs text-brand-700">
          A consulta não retornou linhas.
        </p>
      )}
    </div>
  );
}
