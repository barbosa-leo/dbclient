import http from 'node:http';

const PORT = Number(process.env.MOCK_API_PORT || 8080);

let nextUserId = 3;
let userList = [
  { id: 1, username: 'admin', role: 'admin', mustChangePassword: false, password: 'admin' },
  { id: 2, username: 'operator', role: 'operator', mustChangePassword: false, password: 'operator' },
];

let nextConnectionId = 3;
let connections = [
  { id: 1, name: 'Local', host: 'localhost', port: 5432, database: 'app', username: 'postgres', sslMode: 'prefer' },
  { id: 2, name: 'Staging', host: 'db.staging.internal', port: 5432, database: 'orders', username: 'readonly', sslMode: 'require' },
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
  },
  { name: 'audit', tables: [{ name: 'events', kind: 'table' }] },
  { name: 'archive', tables: [] },
];

const allRows = Array.from({ length: 120 }, (_, i) => [
  i + 1,
  `Customer ${i + 1}`,
  i % 7 === 0 ? null : `user${i + 1}@example.com`,
  new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
]);

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

function runQuery(body) {
  const sql = String(body.sql || '');
  if (/erro/i.test(sql)) {
    return { status: 400, body: { error: 'ERROR: relation "erro" does not exist' } };
  }
  if (!/^\s*select/i.test(sql)) {
    return {
      status: 200,
      body: { columns: [], rows: [], hasMore: false, rowsAffected: 1, durationMs: 4 },
    };
  }
  const pageSize = Number(body.pageSize) || 50;
  const page = Number(body.page) || 1;
  const start = (page - 1) * pageSize;
  return {
    status: 200,
    body: {
      columns: ['id', 'name', 'email', 'created_at'],
      rows: allRows.slice(start, start + pageSize),
      hasMore: start + pageSize < allRows.length,
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

  if (path === '/api/connections' && req.method === 'GET') return send(res, 200, connections);

  if (path === '/api/connections' && req.method === 'POST') {
    if (!isAdmin) return send(res, 403, { error: 'Acesso negado' });
    const { password: _password, ...fields } = body;
    const created = { id: nextConnectionId++, ...fields };
    connections = [...connections, created];
    return send(res, 201, created);
  }

  const connectionRoute = /^\/api\/connections\/(\d+)(?:\/(\w+))?$/.exec(path);
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
    if (action === 'schemas') return send(res, 200, schemas);
    if (action === 'query' && req.method === 'POST') {
      const result = runQuery(body);
      return send(res, result.status, result.body);
    }
    if (action === 'scripts' && req.method === 'POST') {
      const fileName = /filename="([^"]+)"/.exec(body.raw || '')?.[1] ?? 'script.sql';
      const job = createJob('script', fileName);
      return send(res, 202, jobView(job));
    }
  }

  const jobRoute = /^\/api\/jobs\/([\w-]+)(?:\/(cancel))?$/.exec(path);
  if (jobRoute) {
    const job = jobs.get(jobRoute[1]);
    if (!job) return send(res, 404, { error: 'Job não encontrado' });
    if (jobRoute[2] === 'cancel' && req.method === 'POST') {
      const view = jobView(job);
      if (view.status === 'pending' || view.status === 'running') {
        job.frozen = { ...view, status: 'failed', error: 'Cancelado pelo usuário' };
      }
      return send(res, 200, jobView(job));
    }
    return send(res, 200, jobView(job));
  }

  return send(res, 404, { error: 'Não encontrado' });
});

server.listen(PORT, () => {
  console.log(`Mock API em http://localhost:${PORT} (admin/admin, operator/operator)`);
});
