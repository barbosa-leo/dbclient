import type { QueryResult } from '@/services/query';

function formatCell(value: unknown): string {
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function ResultTable({ result }: { result: QueryResult }) {
  if (result.columns.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-panel p-5 text-xs font-medium text-ink shadow-card">
        Comando executado
        {result.rowsAffected !== null && ` — ${result.rowsAffected} linha(s) afetada(s)`} em{' '}
        <span className="font-mono font-semibold text-online">{result.durationMs} ms</span>.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-card">
      <table className="w-full text-left font-mono text-[11px] leading-relaxed">
        <thead className="border-b border-line bg-subtle font-sans text-xs font-medium text-ink-muted">
          <tr>
            {result.columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-4 py-2.5">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {result.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="transition-colors hover:bg-muted/50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="whitespace-nowrap px-4 py-2 text-ink">
                  {cell === null ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
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
        <p className="p-6 text-center font-sans text-xs text-ink-muted">
          A consulta não retornou linhas.
        </p>
      )}
    </div>
  );
}
