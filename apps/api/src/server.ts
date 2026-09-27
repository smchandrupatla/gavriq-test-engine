#!/usr/bin/env tsx
/**
 * GAVRIQ Test Engine — Control Plane API + Unified UI
 */
import Fastify from 'fastify';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './db/client.js';
import { maybeAutoSeed } from './boot-seed.js';
import { applicationRoutes } from './routes/applications.js';
import { testCaseRoutes } from './routes/test-cases.js';
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

function readPublic(rel: string): { body: Buffer; type: string } | null {
  const file = path.normalize(path.join(publicDir, rel));
  if (!file.startsWith(publicDir) || !existsSync(file)) return null;
  return { body: readFileSync(file), type: mimeFor(file) };
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
  app.get('/', async (_req, reply) => {
    const file = readPublic('catalog/index.html');
    if (!file) {
      return reply.type('text/plain').send('Unified UI not found');
    }
    return reply.type(file.type).send(file.body);
  });

  app.get('/console.js', async (_req, reply) => {
    const file = readPublic('console.js');
    if (!file) return reply.code(404).send('Not found');
    return reply.type(file.type).send(file.body);
  });
  app.get('/console-ui.js', async (_req, reply) => {
    const file = readPublic('console-ui.js');
    if (!file) return reply.code(404).send('Not found');
    return reply.type(file.type).send(file.body);
  });
  app.get('/console-pages.js', async (_req, reply) => {
    const file = readPublic('console-pages.js');
    if (!file) return reply.code(404).send('Not found');
    return reply.type(file.type).send(file.body);
  });

  // Same shell also at /catalog/
  app.get('/catalog', async (_req, reply) => reply.redirect('/catalog/'));
  app.get('/catalog/', async (_req, reply) => {
    const file = readPublic('catalog/index.html');
    if (!file) return reply.code(404).type('text/plain').send('Catalog UI not found');
    return reply.type(file.type).send(file.body);
  });
  app.get('/catalog/*', async (req, reply) => {
    const rel = String((req.params as { '*': string })['*'] || '').replace(/\.\./g, '');
    const file = readPublic(path.join('catalog', rel));
    if (!file) return reply.code(404).send('Not found');
    return reply.type(file.type).send(file.body);
  });

  if (rbacEnabled) {
    app.addHook('preHandler', async (req, reply) => {
      const pathName = req.url.split('?')[0] ?? '';
      const method = req.method;

      if (pathName === '/health' || pathName === '/ready' || pathName === '/' || pathName === '/api/v1/meta') return;
      if (pathName.startsWith('/api/v1/evidence')) return;
      if (pathName.startsWith('/api/v1/workers') && method === 'POST') return;
      if (pathName === '/api/v1/executions/claim') return;
      if (pathName === '/api/v1/build-results' && method === 'POST') return;

      if (method === 'GET' && (pathName.startsWith('/api/v1/test-cases') || pathName.startsWith('/api/v1/applications') || pathName.startsWith('/api/v1/dashboard') || pathName.startsWith('/api/v1/search') || pathName.startsWith('/api/v1/test-status') || pathName.startsWith('/api/v1/build-results') || pathName.startsWith('/api/v1/workers') || pathName.startsWith('/api/v1/executions') || pathName.startsWith('/api/v1/environments') || pathName.startsWith('/api/v1/suites') || pathName.startsWith('/api/v1/release-readiness') || pathName.startsWith('/api/v1/execution-results'))) {
        return requirePermission('tests:read')(req, reply);
      }
      if (method === 'POST' && (pathName === '/api/v1/executions' || pathName === '/api/v1/sit-runs' || pathName.startsWith('/api/v1/schedules'))) {
        return requirePermission('executions:run')(req, reply);
      }
      if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && pathName.startsWith('/api/v1/test-cases')) {
        return requirePermission('tests:write')(req, reply);
      }
      if (pathName.startsWith('/api/v1/audit')) {
        return requirePermission('audit:read')(req, reply);
      }
    });
  }

  await app.register(metaRoutes);
  await app.register(sitCatalogRoutes);
  await app.register(sitRunRoutes);
  await app.register(applicationRoutes);
  await app.register(testCaseRoutes);
  await app.register(environmentRoutes);
  await app.register(executionRoutes);
  await app.register(evidenceRoutes);
  await app.register(workerRoutes);
  await app.register(suitePlanRoutes);
  await app.register(analyticsRoutes);
  await app.register(intelligenceRoutes);
  await app.register(scheduleRoutes);
  await app.register(buildStatusRoutes);
  await app.register(opsRoutes);

  await app.listen({ port, host });
  console.log(`GAVRIQ Test Engine API + UI on http://${host}:${port} (rbac=${rbacEnabled} jwt=${Boolean(process.env.JWT_SECRET)})`);
  console.log(`[ui] publicDir=${publicDir} exists=${existsSync(publicDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
