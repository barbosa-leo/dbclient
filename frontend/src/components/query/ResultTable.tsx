import type { QueryResult } from '@/services/query';

function formatCell(value: unknown): string {
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function ResultTable({ result }: { result: QueryResult }) {
  if (result.columns.length === 0) {
    return (
      <p className="rounded-xl border border-brand-300 bg-white p-4 text-sm text-brand-900">
        Comando executado
        {result.rowsAffected !== null && ` — ${result.rowsAffected} linha(s) afetada(s)`} em{' '}
        {result.durationMs} ms.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-300 bg-white">
      <table className="w-full text-left font-mono text-xs">
        <thead className="bg-brand-900 text-brand-50">
          <tr>
            {result.columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-brand-300">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="whitespace-nowrap px-3 py-2">
                  {cell === null ? <span className="text-brand-300">NULL</span> : formatCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length === 0 && (
        <p className="p-4 text-center text-sm text-brand-700">A consulta não retornou linhas.</p>
      )}
    </div>
  );
}
