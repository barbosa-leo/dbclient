import http from 'node:http';

const PORT = Number(process.env.MOCK_API_PORT || 8080);

let nextUserId = 3;
let userList = [
  { id: 1, username: 'admin', role: 'admin', mustChangePassword: false, password: 'admin' },
  { id: 2, username: 'operator', role: 'operator', mustChangePassword: false, password: 'operator' },
];

let nextEnvironmentId = 4;
let environments = [
  { id: 1, name: 'Development' },
  { id: 2, name: 'Staging' },
  { id: 3, name: 'Production' },
];

let nextConnectionId = 4;
let connections = [
  { id: 1, environmentId: 1, name: 'Local', host: 'localhost', port: 5432, database: 'app', username: 'postgres', sslMode: 'prefer' },
  { id: 2, environmentId: 2, name: 'Staging', host: 'db.staging.internal', port: 5432, database: 'orders', username: 'readonly', sslMode: 'require' },
  { id: 3, environmentId: 3, name: 'Primary', host: 'db.prod.internal', port: 5432, database: 'app', username: 'app_user', sslMode: 'verify-full' },
];

const schemas = [
  {
    name: 'public',
    tables: [
      { name: 'customers', kind: 'table' },
      { name: 'orders', kind: 'table' },
      { name: 'order_totals', kind: 'view' },
      { name: 'daily_revenue', kind: 'materialized_view' },
    ],
    procedures: ['sp_reconcile_orders', 'sp_archive_inactive_customers'],
    functions: ['fn_calculate_tax', 'fn_customer_lifetime_value'],
    triggers: ['trg_orders_updated_at', 'trg_customers_audit'],
  },
  {
    name: 'audit',
    tables: [{ name: 'events', kind: 'table' }],
    procedures: ['sp_purge_old_events'],
    functions: ['fn_format_audit_payload'],
    triggers: ['trg_events_immutable'],
  },
  {
    name: 'archive',
    tables: [],
    procedures: [],
    functions: [],
    triggers: [],
  },
];

const allRows = Array.from({ length: 500 }, (_, i) => [
  i + 1,
  `Customer ${i + 1}`,
  i % 7 === 0 ? null : `user${i + 1}@example.com`,
  new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
]);

const defaultColumns = [
  { name: 'id', dataType: 'bigint', nullable: false, defaultValue: "nextval('customers_id_seq'::regclass)", isPrimaryKey: true },
  { name: 'name', dataType: 'character varying(120)', nullable: false, defaultValue: null, isPrimaryKey: false },
  { name: 'email', dataType: 'character varying(255)', nullable: true, defaultValue: null, isPrimaryKey: false },
  { name: 'created_at', dataType: 'timestamp with time zone', nullable: false, defaultValue: 'now()', isPrimaryKey: false },
];

const ordersColumns = [
  { name: 'id', dataType: 'bigint', nullable: false, defaultValue: "nextval('orders_id_seq'::regclass)", isPrimaryKey: true },
  { name: 'customer_id', dataType: 'bigint', nullable: false, defaultValue: null, isPrimaryKey: false },
  { name: 'total_cents', dataType: 'integer', nullable: false, defaultValue: '0', isPrimaryKey: false },
  { name: 'status', dataType: 'character varying(32)', nullable: false, defaultValue: "'pending'::varchar", isPrimaryKey: false },
  { name: 'placed_at', dataType: 'timestamp with time zone', nullable: false, defaultValue: 'now()', isPrimaryKey: false },
];

const tableColumnsStore = new Map();

function columnsForTable(tableName) {
  if (!tableColumnsStore.has(tableName)) {
    const template = tableName === 'orders' ? ordersColumns : defaultColumns;
    tableColumnsStore.set(
      tableName,
      template.map((c) => ({ ...c })),
    );
  }
  return tableColumnsStore.get(tableName);
}

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({ raw });
      }
    });
  });
}

const jobs = new Map();
let nextJobId = 1;

function createJob(kind, fileName) {
  const job = {
    id: String(nextJobId++),
    kind,
    fileName,
    startedAt: Date.now(),
    shouldFail: /falha/i.test(fileName),
  };
  jobs.set(job.id, job);
  return job;
}

function jobView(job) {
  if (job.frozen) return job.frozen;
  const elapsed = Date.now() - job.startedAt;
  const progress = Math.min(100, Math.floor((elapsed / 8000) * 100));
  const base = { id: job.id, kind: job.kind, fileName: job.fileName, progress, error: null };
  if (job.shouldFail && progress >= 50) {
    return { ...base, progress: 50, status: 'failed', error: 'ERROR: syntax error at or near "SELEC"' };
  }
  if (progress >= 100) return { ...base, status: 'done' };
  return { ...base, status: elapsed < 1000 ? 'pending' : 'running' };
}

function publicUser({ password: _password, ...user }) {
  return user;
}

function sessionUser(req) {
  const match = /mock_user=(\w+)/.exec(req.headers.cookie || '');
  const found = match && userList.find((u) => u.username === match[1]);
  return found ? publicUser(found) : undefined;
}

function parseMockSqlLiteral(raw) {
  const trimmed = raw.trim();
  if (/^NULL$/i.test(trimmed)) return null;
  if (/^TRUE$/i.test(trimmed)) return true;
  if (/^FALSE$/i.test(trimmed)) return false;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  const num = Number(trimmed);
  if (!Number.isNaN(num)) return num;
  return trimmed;
}

function parseColumnAssignments(clause) {
  const pairs = [];
  const regex = /"([^"]+)"\s*(?:=\s*('(?:''|[^'])*'|[^\s,]+)|IS\s+(NULL))/gi;
  let m;
  while ((m = regex.exec(clause)) !== null) {
    const col = m[1];
    const rawVal = m[3] ? 'NULL' : m[2];
    pairs.push([col, parseMockSqlLiteral(rawVal)]);
  }
  return pairs;
}

function applyMockAlterTable(sql) {
  const tableMatch = /^\s*ALTER\s+TABLE\s+(?:"[^"]+"\.)?"([^"]+)"\s+(.+)$/is.exec(sql);
  if (!tableMatch) return false;
  const tableName = tableMatch[1];
  const action = tableMatch[2].trim();
  const cols = columnsForTable(tableName);

  const renameMatch = /^RENAME\s+COLUMN\s+"([^"]+)"\s+TO\s+"([^"]+)"$/i.exec(action);
  if (renameMatch) {
    const col = cols.find((c) => c.name === renameMatch[1]);
    if (col) col.name = renameMatch[2];
    return true;
  }

  const typeMatch = /^ALTER\s+COLUMN\s+"([^"]+)"\s+TYPE\s+(.+)$/i.exec(action);
  if (typeMatch) {
    const col = cols.find((c) => c.name === typeMatch[1]);
    if (col) col.dataType = typeMatch[2].trim();
    return true;
  }

  const nullMatch = /^ALTER\s+COLUMN\s+"([^"]+)"\s+(DROP|SET)\s+NOT\s+NULL$/i.exec(action);
  if (nullMatch) {
    const col = cols.find((c) => c.name === nullMatch[1]);
    if (col) col.nullable = nullMatch[2].toUpperCase() === 'DROP';
    return true;
  }

  const dropDefMatch = /^ALTER\s+COLUMN\s+"([^"]+)"\s+DROP\s+DEFAULT$/i.exec(action);
  if (dropDefMatch) {
    const col = cols.find((c) => c.name === dropDefMatch[1]);
    if (col) col.defaultValue = null;
    return true;
  }

  const setDefMatch = /^ALTER\s+COLUMN\s+"([^"]+)"\s+SET\s+DEFAULT\s+(.+)$/i.exec(action);
  if (setDefMatch) {
    const col = cols.find((c) => c.name === setDefMatch[1]);
    if (col) col.defaultValue = setDefMatch[2].trim();
    return true;
  }

  if (/^DROP\s+CONSTRAINT/i.test(action)) {
    for (const col of cols) col.isPrimaryKey = false;
    return true;
  }

  const addPkMatch = /^ADD\s+PRIMARY\s+KEY\s*\((.+)\)$/i.exec(action);
  if (addPkMatch) {
    const pkNames = Array.from(addPkMatch[1].matchAll(/"([^"]+)"/g)).map((m) => m[1]);
    for (const col of cols) {
      col.isPrimaryKey = pkNames.includes(col.name);
    }
    return true;
  }

  return true;
}

function runQuery(body) {
  const sql = String(body.sql || '');
  if (/erro/i.test(sql)) {
    return { status: 400, body: { error: 'ERROR: relation "erro" does not exist' } };
  }
  const columns = ['id', 'name', 'email', 'created_at'];

  if (applyMockAlterTable(sql)) {
    return {
      status: 200,
      body: { columns: [], rows: [], rowsAffected: 0, durationMs: 6 },
    };
  }

  const updateMatch = /^\s*UPDATE\s+.+?\s+SET\s+(.+?)\s+WHERE\s+(.+)$/is.exec(sql);
  if (updateMatch) {
    const setPairs = parseColumnAssignments(updateMatch[1]);
    const wherePairs = parseColumnAssignments(updateMatch[2]);
    let affected = 0;

    for (const row of allRows) {
      const matches = wherePairs.every(([col, val]) => {
        const idx = columns.indexOf(col);
        if (idx === -1) return false;
        return row[idx] === val || String(row[idx]) === String(val);
      });
      if (matches) {
        for (const [col, val] of setPairs) {
          const idx = columns.indexOf(col);
          if (idx !== -1) {
            row[idx] = val;
          }
        }
        affected++;
      }
    }

    return {
      status: 200,
      body: { columns: [], rows: [], rowsAffected: affected, durationMs: 5 },
    };
  }

  if (!/^\s*select/i.test(sql)) {
    return {
      status: 200,
      body: { columns: [], rows: [], rowsAffected: 1, durationMs: 4 },
    };
  }
  let rows = [...allRows];

  const ilikeRegex = /"([^"]+)"\s*(?:\)|)\s*ILIKE\s*'%((?:''|[^'])*)%'/gi;
  let match;
  while ((match = ilikeRegex.exec(sql)) !== null) {
    const colName = match[1];
    const term = match[2].replace(/''/g, "'").toLowerCase();
    const colIdx = columns.indexOf(colName);
    if (colIdx !== -1) {
      rows = rows.filter((row) => {
        const val = row[colIdx];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
    }
  }

  const orderMatch = /ORDER\s+BY\s+(?:"[^"]+"\.)*"([^"]+)"\s+(ASC|DESC)/i.exec(sql);
  if (orderMatch) {
    const colIdx = columns.indexOf(orderMatch[1]);
    const dir = orderMatch[2].toUpperCase() === 'DESC' ? -1 : 1;
    if (colIdx !== -1) {
      rows.sort((a, b) => {
        const va = a[colIdx];
        const vb = b[colIdx];
        if (va === vb) return 0;
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        if (typeof va === 'number' && typeof vb === 'number') {
          return (va - vb) * dir;
        }
        return String(va).localeCompare(String(vb)) * dir;
      });
    }
  }

  const rawLimit = Number(body.limit) || 50;
  const limit = Math.min(10000, Math.max(10, Math.floor(rawLimit)));
  return {
    status: 200,
    body: {
      columns,
      rows: rows.slice(0, limit),
      rowsAffected: null,
      durationMs: 12,
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const body = req.method === 'GET' ? {} : await readBody(req);

  if (path === '/healthz') return send(res, 200, { status: 'ok' });

  if (path === '/api/auth/login' && req.method === 'POST') {
    const found = userList.find((u) => u.username === body.username);
    if (!found || found.password !== body.password) {
      return send(res, 401, { error: 'Usuário ou senha inválidos' });
    }
    return send(res, 200, publicUser(found), {
      'Set-Cookie': `mock_user=${found.username}; Path=/; HttpOnly`,
    });
  }

  if (path === '/api/auth/logout' && req.method === 'POST') {
    return send(res, 204, undefined, { 'Set-Cookie': 'mock_user=; Path=/; Max-Age=0' });
  }

  const user = sessionUser(req);
  if (!user) return send(res, 401, { error: 'Não autenticado' });
  const isAdmin = user.role === 'admin';

  if (path === '/api/auth/me') return send(res, 200, user);
  if (path === '/api/auth/password') return send(res, 204);

  if (path === '/api/users' && req.method === 'GET') {
    if (!isAdmin) return send(res, 403, { error: 'Acesso negado' });
    return send(res, 200, userList.map(publicUser));
  }

  if (path === '/api/users' && req.method === 'POST') {
    if (!isAdmin) return send(res, 403, { error: 'Acesso negado' });
    if (userList.some((u) => u.username === body.username)) {
      return send(res, 409, { error: 'Já existe um usuário com esse nome' });
    }
    const created = {
      id: nextUserId++,
      username: body.username,
      role: body.role,
      password: body.password,
      mustChangePassword: true,
    };
    userList = [...userList, created];
    return send(res, 201, publicUser(created));
  }

  const userRoute = /^\/api\/users\/(\d+)$/.exec(path);
  if (userRoute) {
    if (!isAdmin) return send(res, 403, { error: 'Acesso negado' });
    const id = Number(userRoute[1]);
    if (req.method === 'PUT') {
      userList = userList.map((u) =>
        u.id === id
          ? { ...u, role: body.role ?? u.role, ...(body.password ? { password: body.password, mustChangePassword: true } : {}) }
          : u,
      );
      return send(res, 200, publicUser(userList.find((u) => u.id === id)));
    }
    if (req.method === 'DELETE') {
      userList = userList.filter((u) => u.id !== id);
      return send(res, 204);
    }
  }

  if (path === '/api/environments' && req.method === 'GET') {
    return send(res, 200, environments);
  }

  if (path === '/api/environments' && req.method === 'POST') {
    if (!isAdmin) return send(res, 403, { error: 'Acesso negado' });
    const name = String(body.name || '').trim();
    if (!name) return send(res, 400, { error: 'Nome do environment é obrigatório' });
    if (environments.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      return send(res, 409, { error: 'Já existe um environment com esse nome' });
    }
    const created = { id: nextEnvironmentId++, name };
    environments = [...environments, created];
    return send(res, 201, created);
  }

  const envRoute = /^\/api\/environments\/(\d+)$/.exec(path);
  if (envRoute && req.method === 'DELETE') {
    if (!isAdmin) return send(res, 403, { error: 'Acesso negado' });
    const envId = Number(envRoute[1]);
    if (connections.some((c) => c.environmentId === envId)) {
      return send(res, 409, { error: 'Remova ou mova as conexões deste environment antes de excluí-lo' });
    }
    environments = environments.filter((e) => e.id !== envId);
    return send(res, 204);
  }

  if (path === '/api/connections' && req.method === 'GET') {
    const envParam = Number(url.searchParams.get('environmentId'));
    if (envParam) {
      return send(res, 200, connections.filter((c) => c.environmentId === envParam));
    }
    return send(res, 200, connections);
  }

  if (path === '/api/connections' && req.method === 'POST') {
    if (!isAdmin) return send(res, 403, { error: 'Acesso negado' });
    const { password: _password, ...fields } = body;
    const environmentId = Number(fields.environmentId) || environments[0]?.id || 1;
    const created = { id: nextConnectionId++, ...fields, environmentId };
    connections = [...connections, created];
    return send(res, 201, created);
  }

  const connectionRoute = /^\/api\/connections\/(\d+)(?:\/([\w/]+))?$/.exec(path);
  if (connectionRoute) {
    const id = Number(connectionRoute[1]);
    const action = connectionRoute[2];

    if (!action && req.method === 'PUT') {
      if (!isAdmin) return send(res, 403, { error: 'Acesso negado' });
      const { password: _password, ...fields } = body;
      connections = connections.map((c) => (c.id === id ? { ...c, ...fields, id } : c));
      return send(res, 200, connections.find((c) => c.id === id));
    }
    if (!action && req.method === 'DELETE') {
      if (!isAdmin) return send(res, 403, { error: 'Acesso negado' });
      connections = connections.filter((c) => c.id !== id);
      return send(res, 204);
    }
    if (action === 'schemas') {
      return send(res, 200, schemas);
    }
    const columnsMatch = /^schemas\/([^/]+)\/tables\/([^/]+)\/columns$/.exec(action || '');
    if (columnsMatch && req.method === 'GET') {
      const tableName = decodeURIComponent(columnsMatch[2]);
      return send(res, 200, columnsForTable(tableName));
    }
    if (action === 'query' && req.method === 'POST') {
      const result = runQuery(body);
      return send(res, result.status, result.body);
    }
    if (action === 'scripts' && req.method === 'POST') {
      const fileName = /filename="([^"]+)"/.exec(body.raw || '')?.[1] ?? 'script.sql';
      const job = createJob('script', fileName);
      return send(res, 202, jobView(job));
    }
    if (action === 'dumps/export' && req.method === 'POST') {
      const conn = connections.find((c) => c.id === id);
      const dbName = conn ? conn.database : 'database';
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const job = createJob('dump_export', `${dbName}-${stamp}.sql`);
      return send(res, 202, jobView(job));
    }
    if (action === 'dumps/import' && req.method === 'POST') {
      const fileName = /filename="([^"]+)"/.exec(body.raw || '')?.[1] ?? 'dump.sql';
      const job = createJob('dump_import', fileName);
      return send(res, 202, jobView(job));
    }
  }

  const jobRoute = /^\/api\/jobs\/([\w-]+)(?:\/(cancel|download))?$/.exec(path);
  if (jobRoute) {
    const job = jobs.get(jobRoute[1]);
    if (!job) return send(res, 404, { error: 'Job não encontrado' });
    const subAction = jobRoute[2];
    if (subAction === 'cancel' && req.method === 'POST') {
      const view = jobView(job);
      if (view.status === 'pending' || view.status === 'running') {
        job.frozen = { ...view, status: 'failed', error: 'Cancelado pelo usuário' };
      }
      return send(res, 200, jobView(job));
    }
    if (subAction === 'download' && req.method === 'GET') {
      const view = jobView(job);
      if (job.kind !== 'dump_export' || view.status !== 'done') {
        return send(res, 409, { error: 'Dump ainda não está disponível para download' });
      }
      const sqlContent = `-- PostgreSQL database dump (${job.fileName})\nSET statement_timeout = 0;\nCREATE TABLE IF NOT EXISTS public.customers (id serial PRIMARY KEY, name text);\n`;
      res.writeHead(200, {
        'Content-Type': 'application/sql; charset=utf-8',
        'Content-Disposition': `attachment; filename="${job.fileName}"`,
      });
      res.end(sqlContent);
      return;
    }
    return send(res, 200, jobView(job));
  }

  return send(res, 404, { error: 'Não encontrado' });
});

server.listen(PORT, () => {
  console.log(`Mock API em http://localhost:${PORT} (admin/admin, operator/operator)`);
});
