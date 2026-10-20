import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { listColumns, listSchemas } from '@/services/explorer';
import type { ColumnInfo, SchemaInfo, TableInfo } from '@/services/explorer';

interface Token {
  value: string;
  from: number;
  to: number;
  depth: number;
  kind: 'word' | 'quoted' | 'string' | 'comment' | 'symbol';
}

interface TableRef {
  schema: string;
  table: string;
  alias: string;
}

const START_KEYWORDS = ['SELECT', 'WITH', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP'];
const CLAUSE_KEYWORDS: Record<string, string[]> = {
  SELECT: ['DISTINCT', 'FROM', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'],
  FROM: ['AS', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT'],
  JOIN: ['AS', 'ON', 'USING', 'JOIN', 'WHERE'],
  WHERE: ['AND', 'OR', 'NOT', 'IN', 'IS NULL', 'IS NOT NULL', 'LIKE', 'ILIKE', 'BETWEEN', 'GROUP BY', 'ORDER BY', 'LIMIT'],
  ON: ['AND', 'OR', 'WHERE', 'JOIN', 'GROUP BY', 'ORDER BY'],
  GROUP: ['BY', 'HAVING', 'ORDER BY', 'LIMIT'],
  ORDER: ['BY', 'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST', 'LIMIT', 'OFFSET'],
  HAVING: ['AND', 'OR', 'ORDER BY', 'LIMIT'],
  INSERT: ['INTO'],
  INTO: ['VALUES', 'SELECT', 'RETURNING'],
  UPDATE: ['SET', 'FROM', 'WHERE', 'RETURNING'],
  SET: ['FROM', 'WHERE', 'RETURNING'],
  DELETE: ['FROM', 'WHERE', 'RETURNING'],
  VALUES: ['RETURNING'],
};
const TABLE_CLAUSES = new Set(['FROM', 'JOIN', 'INTO', 'UPDATE']);
const COLUMN_CLAUSES = new Set(['SELECT', 'WHERE', 'ON', 'SET', 'HAVING', 'ORDER', 'GROUP', 'RETURNING']);
const CLAUSE_BOUNDARIES = new Set([...Object.keys(CLAUSE_KEYWORDS), 'RETURNING', 'LIMIT', 'OFFSET', 'UNION']);
const ALIAS_STOP_WORDS = new Set([
  ...CLAUSE_BOUNDARIES,
  'AS', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'OUTER', 'USING', 'VALUES',
]);

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|'(?:''|[^'])*'?|"(?:""|[^"])*"?|[A-Za-z_][A-Za-z_0-9$]*|[.;(),]|\S/g;
  let depth = 0;
  for (const match of sql.matchAll(pattern)) {
    const value = match[0];
    const from = match.index;
    if (value === ')') depth = Math.max(0, depth - 1);
    const kind: Token['kind'] = value.startsWith('--') || value.startsWith('/*')
      ? 'comment'
      : value.startsWith("'")
        ? 'string'
        : value.startsWith('"')
          ? 'quoted'
          : /^[A-Za-z_]/.test(value)
            ? 'word'
            : 'symbol';
    tokens.push({ value, from, to: from + value.length, depth, kind });
    if (value === '(') depth++;
    if (value === ';') depth = 0;
  }
  return tokens;
}

function identifier(token: Token | undefined): string | null {
  if (!token || (token.kind !== 'word' && token.kind !== 'quoted')) return null;
  return token.kind === 'quoted' ? token.value.slice(1, -1).replaceAll('""', '"') : token.value;
}

function quoteIdentifier(name: string): string {
  return /^[a-z_][a-z_0-9]*$/.test(name) ? name : `"${name.replaceAll('"', '""')}"`;
}

function matchesIdentifier(name: string, token: Token | undefined): boolean {
  if (!token) return false;
  return token.kind === 'quoted'
    ? name === identifier(token)
    : token.kind === 'word' && name === token.value.toLowerCase();
}

function statementAt(tokens: Token[], position: number): Token[] {
  let start = 0;
  let end = tokens.length;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.value !== ';' || tokens[i]!.depth !== 0) continue;
    if (tokens[i]!.from < position) start = i + 1;
    else {
      end = i;
      break;
    }
  }
  return tokens.slice(start, end).filter((token) => token.kind !== 'comment' && token.kind !== 'string');
}

function depthAt(tokens: Token[], position: number): number {
  let depth = 0;
  for (const token of tokens) {
    if (token.from >= position) break;
    if (token.value === '(') depth++;
    if (token.value === ')') depth = Math.max(0, depth - 1);
  }
  return depth;
}

function clauseAt(tokens: Token[], position: number, depth: number): string | null {
  let clause: string | null = null;
  for (const token of tokens) {
    if (token.from >= position) break;
    if (token.depth !== depth || token.kind !== 'word') continue;
    const upper = token.value.toUpperCase();
    if (CLAUSE_BOUNDARIES.has(upper)) clause = upper;
  }
  return clause;
}

function tableReferences(tokens: Token[], depth: number, schemas: SchemaInfo[]): TableRef[] {
  const refs: TableRef[] = [];
  let inFromList = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.depth !== depth) continue;
    const upper = token.value.toUpperCase();
    if (upper === 'FROM') inFromList = true;
    else if (CLAUSE_BOUNDARIES.has(upper) && upper !== 'JOIN') inFromList = false;
    if (!TABLE_CLAUSES.has(upper) && !(token.value === ',' && inFromList)) continue;
    const firstToken = tokens[i + 1];
    const first = identifier(firstToken);
    if (!first || tokens[i + 1]?.depth !== depth) continue;
    let tableToken = firstToken;
    let schemaToken: Token | undefined;
    let last = i + 1;
    if (tokens[i + 2]?.value === '.' && tokens[i + 2]?.depth === depth) {
      const secondToken = tokens[i + 3];
      const second = identifier(secondToken);
      if (!second) continue;
      schemaToken = firstToken;
      tableToken = secondToken;
      last = i + 3;
    }
    const matches = schemas.flatMap((item) =>
      item.tables.filter((candidate) => matchesIdentifier(candidate.name, tableToken) && (!schemaToken || matchesIdentifier(item.name, schemaToken)))
        .map((candidate) => ({ schema: item.name, table: candidate.name })),
    );
    if (matches.length !== 1) continue;
    const maybeAs = tokens[last + 1]?.value.toUpperCase() === 'AS' ? last + 2 : last + 1;
    const aliasToken = tokens[maybeAs];
    const aliasName = aliasToken?.depth === depth && !ALIAS_STOP_WORDS.has(aliasToken.value.toUpperCase())
      ? identifier(aliasToken)
      : null;
    refs.push({ schema: matches[0]!.schema, table: matches[0]!.table, alias: aliasName ?? matches[0]!.table });
  }
  return refs;
}

function insertColumnsContext(tokens: Token[], position: number, depth: number): boolean {
  if (depth !== 1 || tokens[0]?.value.toUpperCase() !== 'INSERT') return false;
  const opening = tokens.filter((token) => token.value === '(' && token.depth === 0 && token.from < position).at(-1);
  if (!opening) return false;
  const before = tokens.filter((token) => token.to <= opening.from && token.depth === 0);
  return before.filter((token) => CLAUSE_BOUNDARIES.has(token.value.toUpperCase())).at(-1)?.value.toUpperCase() === 'INTO';
}

function tableOptions(schemas: SchemaInfo[], schemaName?: string): Completion[] {
  return schemas
    .filter((schema) => !schemaName || schema.name === schemaName)
    .flatMap((schema) => schema.tables.map((table: TableInfo) => ({
      label: table.name,
      type: table.kind === 'table' ? 'type' : 'variable',
      detail: `${schema.name} · ${table.kind === 'table' ? 'tabela' : 'view'}`,
      apply: schemaName ? quoteIdentifier(table.name) : `${quoteIdentifier(schema.name)}.${quoteIdentifier(table.name)}`,
      boost: 50,
    })));
}

function columnOptions(columns: ColumnInfo[], ref: TableRef, qualified: boolean): Completion[] {
  return columns.map((column) => ({
    label: column.name,
    type: 'property',
    detail: `${ref.alias} · ${column.dataType}`,
    apply: qualified ? `${quoteIdentifier(ref.alias)}.${quoteIdentifier(column.name)}` : quoteIdentifier(column.name),
    boost: 40,
  }));
}

export class SqlMetadata {
  private schemasPromise: Promise<SchemaInfo[]> | null = null;
  private columns = new Map<string, Promise<ColumnInfo[]>>();

  constructor(private readonly connectionId: number) {}

  schemas(): Promise<SchemaInfo[]> {
    if (!this.schemasPromise) {
      this.schemasPromise = listSchemas(this.connectionId).catch((error: unknown) => {
        this.schemasPromise = null;
        throw error;
      });
    }
    return this.schemasPromise;
  }

  columnsFor(schema: string, table: string): Promise<ColumnInfo[]> {
    const key = `${schema}\0${table}`;
    let pending = this.columns.get(key);
    if (!pending) {
      pending = listColumns(this.connectionId, schema, table).catch((error: unknown) => {
        this.columns.delete(key);
        throw error;
      });
      this.columns.set(key, pending);
    }
    return pending;
  }
}

function completionPosition(context: CompletionContext) {
  const sql = context.state.doc.toString();
  const tokens = tokenize(sql);
  if (tokens.some((token) => (token.kind === 'comment' || token.kind === 'string') && token.from < context.pos && token.to >= context.pos)) {
    return null;
  }
  const statement = statementAt(tokens, context.pos);
  const depth = depthAt(statement, context.pos);
  const before = statement.filter((token) => token.to <= context.pos && token.depth === depth);
  const previous = before.at(-1);
  const qualifier = previous?.value === '.' ? before.at(-2) : undefined;
  const dotted = identifier(qualifier);
  const word = context.matchBefore(/[A-Za-z_][A-Za-z_0-9$]*|"[^"]*"?/);
  const from = word?.from ?? context.pos;
  const hasPrefix = Boolean(word && word.from < word.to);
  const clause = clauseAt(statement, from, depth);
  const afterClause = previous && previous.to <= from ? previous.value.toUpperCase() : null;
  if (!context.explicit && !hasPrefix && !dotted && !TABLE_CLAUSES.has(afterClause ?? '')) return null;
  const tableExpected = TABLE_CLAUSES.has(afterClause ?? '') || (afterClause === ',' && (clause === 'FROM' || clause === 'JOIN'));
  return { statement, depth, dotted, qualifier, from, clause, tableExpected };
}

export function sqlKeywordCompletions(context: CompletionContext): CompletionResult | null {
  const position = completionPosition(context);
  if (!position || position.dotted || position.tableExpected) return null;
  const keywords = position.clause ? CLAUSE_KEYWORDS[position.clause] ?? [] : START_KEYWORDS;
  if (keywords.length === 0) return null;
  return {
    from: position.from,
    options: keywords.map((label) => ({ label, type: 'keyword' })),
    validFor: /^[A-Za-z_0-9$]*$/,
  };
}

export async function sqlMetadataCompletions(
  context: CompletionContext,
  metadata: SqlMetadata | null,
): Promise<CompletionResult | null> {
  const position = completionPosition(context);
  if (!position || !metadata) return null;
  const { statement, depth, dotted, qualifier, from, clause, tableExpected } = position;
  const insertingColumns = insertColumnsContext(statement, context.pos, depth);
  if (!dotted && !tableExpected && !COLUMN_CLAUSES.has(clause ?? '') && !insertingColumns) return null;
  const options: Completion[] = [];
  try {
    const schemas = await metadata.schemas();
    if (context.aborted) return null;
    const refs = tableReferences(statement, insertingColumns ? 0 : depth, schemas);
    if (dotted) {
      const ref = refs.find((item) => matchesIdentifier(item.alias, qualifier));
      if (ref) {
        options.push(...columnOptions(await metadata.columnsFor(ref.schema, ref.table), ref, false));
      } else {
        const schema = schemas.find((item) => matchesIdentifier(item.name, qualifier));
        if (schema) options.push(...tableOptions(schemas, schema.name));
      }
    } else if (tableExpected) {
      options.push(...tableOptions(schemas));
    } else if (COLUMN_CLAUSES.has(clause ?? '') || insertingColumns) {
      const groups = await Promise.all(refs.map(async (ref) => {
        try {
          return columnOptions(await metadata.columnsFor(ref.schema, ref.table), ref, refs.length > 1);
        } catch {
          return [];
        }
      }));
      options.push(...groups.flat());
    }
    if (context.aborted) return null;
  } catch {
    if (context.aborted) return null;
  }

  if (options.length === 0) return null;
  return { from, options, validFor: /^[A-Za-z_0-9$]*$/ };
}
