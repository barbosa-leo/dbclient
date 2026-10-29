export interface StatementRange {
  from: number;
  to: number;
}

const DOLLAR_TAG = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/;
const IDENTIFIER_CHAR = /[A-Za-z0-9_$]/;

function skipQuoted(sql: string, start: number, quote: string, backslashEscapes = false): number {
  let i = start + 1;
  while (i < sql.length) {
    if (backslashEscapes && sql[i] === '\\') {
      i += 2;
      continue;
    }
    if (sql[i] === quote) {
      if (sql[i + 1] !== quote) return i + 1;
      i += 2;
      continue;
    }
    i += 1;
  }
  return sql.length;
}

function skipBlockComment(sql: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < sql.length) {
    if (sql.startsWith('/*', i)) {
      depth += 1;
      i += 2;
    } else if (sql.startsWith('*/', i)) {
      depth -= 1;
      i += 2;
      if (depth === 0) return i;
    } else {
      i += 1;
    }
  }
  return sql.length;
}

function skipLineComment(sql: string, start: number): number {
  const end = sql.indexOf('\n', start);
  return end === -1 ? sql.length : end;
}

// Statement ranges span from the first code token (leading comments excluded) to the `;` inclusive.
export function splitStatements(sql: string): StatementRange[] {
  const ranges: StatementRange[] = [];
  let codeStart = -1;
  let i = 0;

  while (i < sql.length) {
    const char = sql.charAt(i);

    if (char === '-' && sql[i + 1] === '-') {
      i = skipLineComment(sql, i);
      continue;
    }
    if (char === '/' && sql[i + 1] === '*') {
      i = skipBlockComment(sql, i);
      continue;
    }
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (codeStart === -1) codeStart = i;

    if (char === ';') {
      ranges.push({ from: codeStart, to: i + 1 });
      codeStart = -1;
      i += 1;
    } else if (char === "'" || char === '"') {
      const escapeString = char === "'" && /[eE]/.test(sql[i - 1] ?? '') && !IDENTIFIER_CHAR.test(sql[i - 2] ?? '');
      i = skipQuoted(sql, i, char, escapeString);
    } else if (char === '$' && !IDENTIFIER_CHAR.test(sql[i - 1] ?? '')) {
      const tag = DOLLAR_TAG.exec(sql.slice(i))?.[0];
      if (!tag) {
        i += 1;
        continue;
      }
      const close = sql.indexOf(tag, i + tag.length);
      i = close === -1 ? sql.length : close + tag.length;
    } else {
      i += 1;
    }
  }

  if (codeStart !== -1) {
    let end = sql.length;
    while (end > codeStart && /\s/.test(sql.charAt(end - 1))) end -= 1;
    ranges.push({ from: codeStart, to: end });
  }

  return ranges;
}

function lineOf(sql: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset; i += 1) {
    if (sql[i] === '\n') line += 1;
  }
  return line;
}

// Between statements, the cursor belongs to the previous one only when it sits on the line
// where that statement ends (e.g. `SELECT 1; |`); otherwise the next statement wins, so that
// comment lines above a statement select it.
export function statementAt(sql: string, cursor: number): StatementRange | null {
  const ranges = splitStatements(sql);
  if (ranges.length === 0) return null;

  const containing = ranges.find((range) => cursor >= range.from && cursor <= range.to);
  if (containing) return containing;

  const nextIndex = ranges.findIndex((range) => range.from > cursor);
  const previous = nextIndex === -1 ? ranges[ranges.length - 1] : ranges[nextIndex - 1];
  const next = nextIndex === -1 ? undefined : ranges[nextIndex];

  if (previous && (!next || lineOf(sql, previous.to) === lineOf(sql, cursor))) return previous;
  return next ?? null;
}
