import type { FastifyInstance } from 'fastify';
import { kitPush, kitSnapshot, kitSubscribe } from '../kit-log.js';
import { query } from '../db/client.js';

function sitConsoleBase() {
  return (
    process.env.SIT_CONSOLE_BASE ||
    process.env.SIT_CONSOLE_URL ||
    'http://127.0.0.1:8098'
  ).replace(/\/$/, '');
}

async function sitFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${sitConsoleBase()}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts?.headers || {}) },
    signal: AbortSignal.timeout(8000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastLogLen = 0;

function startStatusPoll() {
  if (pollTimer) return;
  lastLogLen = 0;
  pollTimer = setInterval(async () => {
    try {
      const { ok, body } = await sitFetch('/api/status');
      if (!ok) return;
      const log: string[] = body.log || [];
      if (log.length < lastLogLen) lastLogLen = 0;
      for (const line of log.slice(lastLogLen)) kitPush(line, 'sit-runner');
      lastLogLen = log.length;
      if (!body.running && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        kitPush(`SIT runner idle${body.lastRun ? ` · last ${body.lastRun.passed}/${body.lastRun.total} passed` : ''}`, 'sit-runner');
      }
    } catch {
      /* console may be down */
    }
  }, 2000);
}

export async function sitRunRoutes(app: FastifyInstance) {
  app.get('/api/v1/kit-log', async (req, reply) => {
    const q = req.query as { limit?: string };
    return reply.send({ data: kitSnapshot(Number(q.limit) || 200), sit_console: sitConsoleBase() });
  });

  app.get('/api/v1/kit-log/stream', async (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    for (const entry of kitSnapshot(80)) {
      reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
    }
    const off = kitSubscribe(reply.raw);
    req.raw.on('close', off);
  });

  app.get('/api/v1/sit-status', async (_req, reply) => {
    try {
      const { ok, status, body } = await sitFetch('/api/status');
      return reply.status(ok ? 200 : status).send({
        reachable: ok,
        base: sitConsoleBase(),
        data: body,
      });
    } catch (err) {
      return reply.send({
        reachable: false,
        base: sitConsoleBase(),
        error: String((err as Error).message || err),
      });
    }
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/sit-runs', async (req, reply) => {
    const b = req.body || {};
    const caseNames = Array.isArray(b.caseNames) ? (b.caseNames as string[]).filter((s) => typeof s === 'string' && s.trim()) : [];
    const files = Array.isArray(b.files) ? (b.files as string[]).filter((s) => typeof s === 'string' && s.trim()) : [];
    const suites = Array.isArray(b.suites) ? (b.suites as string[]) : undefined;
    const groups = Array.isArray(b.groups) ? (b.groups as string[]) : undefined;

    kitPush(
      `SIT run requested · names=${caseNames.length || 'all'} files=${files.length || 'auto'}`,
      'engine'
    );

    try {
      const { ok, status, body } = await sitFetch('/api/run', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(Object.entries({ caseNames, files, suites, groups }).filter(([, v]) => Array.isArray(v) && v.length))),
      });
      if (ok && body.started) {
        startStatusPoll();
        kitPush('Handed to sit/lib/runner via SIT console /api/run', 'sit-runner');
        return reply.status(202).send({
          data: { via: 'sit-console', base: sitConsoleBase(), ...body },
        });
      }
      if (status === 409) {
        kitPush(body.reason || 'SIT runner already busy', 'sit-runner');
        return reply.status(409).send({ error: body.reason || 'already running', data: body });
      }
      kitPush(`SIT console rejected run (${status}): ${body.error || body.reason || 'unknown'}`, 'sit-runner');
    } catch (err) {
      kitPush(`SIT console unreachable (${sitConsoleBase()}): ${(err as Error).message}`, 'engine');
    }

    const names = caseNames.length ? caseNames : [];
    let rows: { id: string; key: string; name: string }[] = [];
    try {
      if (names.length) {
        const { rows: found } = await query<{ id: string; key: string; name: string }>(
          `SELECT id, key, name FROM test_cases
           WHERE (key LIKE 'SIT-%' OR 'sit' = ANY(tags))
             AND name = ANY($1::text[])`,
          [names]
        );
        rows = found;
      } else if (files.length) {
        const like = files.map((f) => `%${f.replace(/^sit\/cases\//, '')}%`);
        const { rows: found } = await query<{ id: string; key: string; name: string }>(
          `SELECT id, key, name FROM test_cases
           WHERE (key LIKE 'SIT-%' OR 'sit' = ANY(tags))
             AND script LIKE ANY($1::text[])`,
          [like]
        );
        rows = found;
      }
    } catch {
      rows = [];
    }

    if (!rows.length) {
      return reply.status(503).send({
        error: 'SIT console unreachable and no matching SIT-* repository rows to queue',
        sit_console: sitConsoleBase(),
      });
    }

    const key = `sit-${Date.now().toString(36)}`;
    const exec = await query(
      `INSERT INTO executions (
         key, requested_by, test_case_ids, environment_id, status, trigger_source, metadata
       ) VALUES ($1,'operator',$2,'local-dev','queued','manual',$3::jsonb)
       RETURNING *`,
      [key, rows.map((r) => r.id), JSON.stringify({ via: 'engine-fallback', caseNames: names, files })]
    );
    kitPush(`Queued engine fallback ${key} · ${rows.length} SIT case(s)`, 'engine');
    return reply.status(202).send({
      data: { via: 'engine-fallback', execution: exec.rows[0], cases: rows },
    });
  });
}
