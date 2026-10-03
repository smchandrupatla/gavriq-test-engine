#!/usr/bin/env tsx
/**
 * GAVRIQ Test Engine — Control Plane API + Unified UI
 */
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { migrate } from './db/client.js';
import { maybeAutoSeed } from './boot-seed.js';
import { applicationRoutes } from './routes/applications.js';
import { testCaseRoutes } from './routes/test-cases.js';
import { testBenchRoutes } from './routes/test-bench.js';
import { environmentRoutes } from './routes/environments.js';
import { executionRoutes } from './routes/executions.js';
import { workerRoutes } from './routes/workers.js';
import { suitePlanRoutes } from './routes/suites-plans.js';
import { analyticsRoutes } from './routes/analytics.js';
import { intelligenceRoutes } from './routes/intelligence.js';
import { scheduleRoutes } from './routes/schedules.js';
import { buildStatusRoutes } from './routes/build-status.js';
import { metaRoutes } from './routes/meta.js';
import { evidenceRoutes } from './routes/evidence.js';
import { sitCatalogRoutes } from './routes/sit-catalog.js';
import { sitRunRoutes } from './routes/sit-runs.js';
import { opsRoutes } from './routes/ops.js';
import { uiRoutes } from './routes/ui.js';
import { triggerRoutes } from './routes/trigger.js';
import { deploymentRoutes } from './routes/deployments.js';
import { infraRoutes } from './routes/infra.js';
import { infraTick } from './infra.js';
import { settingsRoutes } from './routes/settings.js';
import { reportRoutes } from './routes/reports.js';
import { insightRoutes } from './routes/insights.js';
import { registerEvidenceGate } from './evidence-gate.js';
import { EVIDENCE_RETENTION_DAYS, pruneEvidence } from './evidence-store.js';
import { currentRunRetentionDays, pruneRuns } from './run-retention.js';
import { resolveActorAsync, requirePermission } from './middleware/rbac.js';

const port = Number(process.env.PORT || process.env.TEST_ENGINE_PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const rbacEnabled = process.env.RBAC_ENABLED === 'true';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const publicDir = path.join(root, 'apps/api/public');

function packageVersion(): string {
  try {
    const pkgPath = path.join(root, 'package.json');
    if (existsSync(pkgPath)) {
      return String(JSON.parse(readFileSync(pkgPath, 'utf8')).version || '0.0.0');
    }
  } catch {
    /* ignore */
  }
  return process.env.npm_package_version || '0.3.3';
}

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

const gzipAsync = promisify(gzip);
const COMPRESSIBLE = /^(application\/(json|javascript)|text\/(html|css|plain|javascript)|image\/svg)/;

/** Serve a UI asset with a size/mtime ETag so repeat loads revalidate with a 304 instead of re-downloading. */
function sendPublic(req: FastifyRequest, reply: FastifyReply, rel: string, notFound = 'Not found') {
  const file = path.normalize(path.join(publicDir, rel));
  if (!file.startsWith(publicDir) || !existsSync(file) || !statSync(file).isFile()) {
    return reply.code(404).type('text/plain').send(notFound);
  }
  const st = statSync(file);
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  reply.header('etag', etag).header('cache-control', 'no-cache');
  if (req.headers['if-none-match'] === etag) return reply.code(304).send();
  return reply.type(mimeFor(file)).send(readFileSync(file));
}

async function main() {
  try {
    await migrate();
  } catch (err) {
    console.warn('[boot] migrate warning:', (err as Error).message);
  }

  try {
    await maybeAutoSeed();
  } catch (err) {
    console.warn('[boot] auto-seed warning:', (err as Error).message);
  }

  const app = Fastify({
    logger: true,
    requestTimeout: 120_000,
    bodyLimit: 8 * 1024 * 1024,
  });

  app.addHook('onRequest', async (req) => {
    await resolveActorAsync(req);
  });

  // gzip text responses (JSON catalog payloads shrink ~5-8x); streams and hijacked SSE are untouched.
  app.addHook('onSend', async (req, reply, payload) => {
    if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return payload;
    if (reply.getHeader('content-encoding')) return payload;
    if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) return payload;
    if (!COMPRESSIBLE.test(String(reply.getHeader('content-type') || ''))) return payload;
    if (Buffer.byteLength(payload) < 1024) return payload;
    reply.header('content-encoding', 'gzip');
    reply.header('vary', 'accept-encoding');
    reply.removeHeader('content-length');
    return gzipAsync(payload);
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'gavriq-test-engine',
    version: packageVersion(),
    prompts: '1-10',
    rbac: rbacEnabled,
    jwt: Boolean(process.env.JWT_SECRET),
    ui: true,
    schema: process.env.PG_SCHEMA || 'test_engine',
  }));

  app.get('/ready', async () => ({ status: 'ready' }));

  // Unified shell at / (Overview · SIT · Catalog QA/QC)
  app.get('/', async (req, reply) => sendPublic(req, reply, 'catalog/index.html', 'Unified UI not found'));

  app.get('/console.js', async (req, reply) => sendPublic(req, reply, 'console.js'));
  app.get('/console-ui.js', async (req, reply) => sendPublic(req, reply, 'console-ui.js'));
  app.get('/console-pages.js', async (req, reply) => sendPublic(req, reply, 'console-pages.js'));

  // Same shell also at /catalog/
  app.get('/catalog', async (_req, reply) => reply.redirect('/catalog/'));
  app.get('/catalog/', async (req, reply) => sendPublic(req, reply, 'catalog/index.html', 'Catalog UI not found'));
  app.get('/catalog/*', async (req, reply) => {
    const rel = String((req.params as { '*': string })['*'] || '').replace(/\.\./g, '');
    return sendPublic(req, reply, path.join('catalog', rel));
  });

  if (rbacEnabled) {
    app.addHook('preHandler', async (req, reply) => {
      const pathName = req.url.split('?')[0] ?? req.url;
      const method = req.method;

      if (pathName === '/health' || pathName === '/ready' || pathName === '/' || pathName === '/api/v1/meta') return;
      if ((pathName === '/api/v1/evidence/upload' || pathName === '/api/v1/evidence/prune') && method === 'POST') {
        return requirePermission('workers:manage')(req, reply);
      }
      if (pathName.startsWith('/api/v1/evidence')) return;
      if (pathName.startsWith('/api/v1/runs')) {
        return requirePermission(method === 'GET' ? 'tests:read' : 'executions:run')(req, reply);
      }
      if (pathName.startsWith('/api/v1/deployments')) {
        return requirePermission(method === 'GET' ? 'tests:read' : 'environments:deploy')(req, reply);
      }
      if (pathName.startsWith('/api/v1/infra')) {
        if (method === 'GET') return requirePermission('tests:read')(req, reply);
        // The infra agent authenticates like a worker (X-Worker-Key).
        if (/^\/api\/v1\/infra\/(jobs\/claim|jobs\/[^/]+\/(progress|complete)|agents\/heartbeat)$/.test(pathName)) {
          return requirePermission('workers:manage')(req, reply);
        }
        return requirePermission('environments:deploy')(req, reply);
      }
      // Create/update only — leaves sub-paths like .../run-tests, .../policy untouched.
      if (
        (method === 'POST' && (pathName === '/api/v1/applications' || pathName === '/api/v1/environments')) ||
        ((method === 'PATCH' || method === 'PUT') && /^\/api\/v1\/(applications|environments)\/[^/]+$/.test(pathName))
      ) {
        return requirePermission('environments:write')(req, reply);
      }
      if (pathName.startsWith('/api/v1/workers') && method === 'POST') return;
      if (pathName === '/api/v1/executions/claim') return;
      if (pathName === '/api/v1/build-results' && method === 'POST') return;

      if (method === 'GET' && (pathName.startsWith('/api/v1/test-cases') || pathName.startsWith('/api/v1/applications') || pathName.startsWith('/api/v1/dashboard') || pathName.startsWith('/api/v1/search') || pathName.startsWith('/api/v1/test-status') || pathName.startsWith('/api/v1/build-results') || pathName.startsWith('/api/v1/workers') || pathName.startsWith('/api/v1/executions') || pathName.startsWith('/api/v1/environments') || pathName.startsWith('/api/v1/suites') || pathName.startsWith('/api/v1/release-readiness') || pathName.startsWith('/api/v1/execution-results') || pathName.startsWith('/api/v1/ui/'))) {
        return requirePermission('tests:read')(req, reply);
      }
      if (method === 'POST' && (pathName === '/api/v1/ui/history' || pathName === '/api/v1/reports')) {
        return requirePermission('tests:read')(req, reply);
      }
      if (method === 'POST' && (pathName === '/api/v1/executions' || pathName === '/api/v1/executions/run-all' || pathName === '/api/v1/sit-runs')) {
        return requirePermission('executions:run')(req, reply);
      }
      if (pathName.startsWith('/api/v1/schedules') || pathName.startsWith('/api/v1/insights')) {
        return requirePermission(method === 'GET' ? 'tests:read' : 'executions:run')(req, reply);
      }
      if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && pathName.startsWith('/api/v1/test-cases')) {
        return requirePermission('tests:write')(req, reply);
      }
      if (pathName.startsWith('/api/v1/audit')) {
        return requirePermission('audit:read')(req, reply);
      }
    });
  }

  // Evidence is the exit criterion of a run: verified in front of the result endpoints.
  registerEvidenceGate(app);

  await app.register(metaRoutes);
  await app.register(sitCatalogRoutes);
  await app.register(sitRunRoutes);
  await app.register(applicationRoutes);
  await app.register(testCaseRoutes);
  await app.register(testBenchRoutes);
  await app.register(environmentRoutes);
  await app.register(executionRoutes);
  await app.register(evidenceRoutes);
  await app.register(workerRoutes);
  await app.register(suitePlanRoutes);
  await app.register(analyticsRoutes);
  await app.register(intelligenceRoutes);
  await app.register(scheduleRoutes);
  await app.register(buildStatusRoutes);
  await app.register(uiRoutes);
  await app.register(triggerRoutes);
  await app.register(deploymentRoutes);
  await app.register(infraRoutes);
  await app.register(settingsRoutes);
  await app.register(reportRoutes);
  await app.register(insightRoutes);
  await app.register(opsRoutes);

  await app.listen({ port, host });

  // Evidence retention: once shortly after boot, then daily.
  if (EVIDENCE_RETENTION_DAYS > 0) {
    const prune = () =>
      pruneEvidence(EVIDENCE_RETENTION_DAYS)
        .then((r) => app.log.info(r, 'evidence retention'))
        .catch((err) => app.log.warn({ err }, 'evidence retention failed'));
    setTimeout(prune, 60_000).unref();
    setInterval(prune, 24 * 60 * 60_000).unref();
  }

  // Run retention: reads the configured window fresh each tick, so a change made in the
  // Configuration UI takes effect without a restart.
  const pruneRunsTick = () =>
    currentRunRetentionDays()
      .then((days) => pruneRuns(days))
      .then((r) => app.log.info(r, 'run retention'))
      .catch((err) => app.log.warn({ err }, 'run retention failed'));
  setTimeout(pruneRunsTick, 90_000).unref();
  setInterval(pruneRunsTick, 60 * 60_000).unref();

  // Infrastructure lifecycle: tear managed stacks down after their run / when idle / when up too long,
  // and queue Docker housekeeping on its cadence (infra.ts). Decisions only — the infra agent does the work.
  if (process.env.INFRA_TICK_MS !== '0') {
    let infraBusy = false;
    const infraTickSafe = () => {
      if (infraBusy) return;
      infraBusy = true;
      infraTick()
        .then((r) => {
          if (r.reaped || r.after_run.length || r.teardowns.length || r.prune_queued) app.log.info(r, 'infra tick');
        })
        .catch((err) => app.log.warn({ err }, 'infra tick failed'))
        .finally(() => { infraBusy = false; });
    };
    const every = Math.max(10_000, Number(process.env.INFRA_TICK_MS) || 60_000);
    setTimeout(infraTickSafe, 30_000).unref();
    setInterval(infraTickSafe, every).unref();
  }

  console.log(`GAVRIQ Test Engine API + UI on http://${host}:${port} (rbac=${rbacEnabled} jwt=${Boolean(process.env.JWT_SECRET)})`);
  console.log(`[ui] publicDir=${publicDir} exists=${existsSync(publicDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
