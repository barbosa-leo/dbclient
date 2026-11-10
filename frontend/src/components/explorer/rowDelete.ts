import { MAX_SQL_LENGTH } from '@/services/query';

export class RowDeleteError extends Error {}

interface DeleteTarget {
  schema: string;
  table: string;
  resultColumns: string[];
  primaryKeyColumns: string[];
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function formatKeyValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `'${text.replace(/'/g, "''")}'`;
}

// Rows are matched by primary key only: matching on every column could also delete
// identical rows the user did not select, so tables without a primary key are refused.
export function buildDeleteStatements(target: DeleteTarget, rows: unknown[][]): string[] {
  const { schema, table, resultColumns, primaryKeyColumns } = target;
  if (primaryKeyColumns.length === 0) {
    throw new RowDeleteError(
      'A tabela não tem chave primária, então não é possível identificar as linhas com segurança. Use o Editor SQL para excluir.',
    );
  }

  const keyIndexes = primaryKeyColumns.map((column) => resultColumns.indexOf(column));
  if (keyIndexes.some((index) => index < 0)) {
    throw new RowDeleteError('As colunas da chave primária precisam estar no resultado para excluir linhas.');
  }

  const keys = rows.map((row) => {
    const values = keyIndexes.map((index) => row[index]);
    if (values.some((value) => value === null || value === undefined)) {
      throw new RowDeleteError('Há linhas selecionadas sem valor na chave primária.');
    }
    const literals = values.map(formatKeyValue);
    return literals.length === 1 ? literals[0]! : `(${literals.join(', ')})`;
  });

  const keyColumns = primaryKeyColumns.map(quoteIdentifier);
  const keyExpression = keyColumns.length === 1 ? keyColumns[0]! : `(${keyColumns.join(', ')})`;
  const prefix = `DELETE FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)} WHERE ${keyExpression} IN (`;
  const suffix = ')';

  const statements: string[] = [];
  let batch: string[] = [];
  let length = prefix.length + suffix.length;
  for (const key of keys) {
    const added = key.length + (batch.length > 0 ? 2 : 0);
    if (batch.length > 0 && length + added > MAX_SQL_LENGTH) {
      statements.push(prefix + batch.join(', ') + suffix);
      batch = [];
      length = prefix.length + suffix.length;
    }
    batch.push(key);
    length += key.length + (batch.length > 1 ? 2 : 0);
  }
  if (batch.length > 0) statements.push(prefix + batch.join(', ') + suffix);

  if (statements.some((statement) => statement.length > MAX_SQL_LENGTH)) {
    throw new RowDeleteError('O valor da chave primária é grande demais para excluir pela tabela.');
  }
  return statements;
}
