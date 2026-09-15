#!/usr/bin/env tsx
/**
 * GAVRIQ Test Engine — Control Plane API + Dashboard UI
 */
import Fastify from 'fastify';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './db/client.js';
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
import { resolveActor, requirePermission } from './middleware/rbac.js';

const port = Number(process.env.PORT || process.env.TEST_ENGINE_PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const rbacEnabled = process.env.RBAC_ENABLED === 'true';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const publicDir = path.join(root, 'apps/api/public');

async function main() {
  try {
    await migrate();
  } catch (err) {
    console.warn('[boot] migrate warning:', (err as Error).message);
  }

  const app = Fastify({
    logger: true,
    requestTimeout: 120_000,
  });

  app.addHook('onRequest', async (req) => {
    resolveActor(req);
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'gavriq-test-engine',
    version: '1.4.0',
    prompts: '1-10',
    rbac: rbacEnabled,
    ui: true,
  }));

  app.get('/ready', async () => ({ status: 'ready' }));

  // Dashboard UI
  app.get('/', async (_req, reply) => {
    const index = path.join(publicDir, 'index.html');
    if (!existsSync(index)) {
      return reply.type('text/plain').send('Dashboard not found. Expected apps/api/public/index.html');
    }
    return reply.type('text/html').send(readFileSync(index, 'utf8'));
  });

  if (rbacEnabled) {
    app.addHook('preHandler', async (req, reply) => {
      const pathName = req.url.split('?')[0];
      const method = req.method;

      if (pathName === '/health' || pathName === '/ready' || pathName === '/') return;
      if (pathName.startsWith('/api/v1/workers') && method === 'POST') return;
      if (pathName === '/api/v1/executions/claim') return;
      if (pathName === '/api/v1/build-results' && method === 'POST') return;

      if (method === 'GET' && (pathName.startsWith('/api/v1/test-cases') || pathName.startsWith('/api/v1/applications') || pathName.startsWith('/api/v1/dashboard') || pathName.startsWith('/api/v1/search') || pathName.startsWith('/api/v1/test-status') || pathName.startsWith('/api/v1/build-results') || pathName.startsWith('/api/v1/workers') || pathName.startsWith('/api/v1/executions') || pathName.startsWith('/api/v1/environments') || pathName.startsWith('/api/v1/suites') || pathName.startsWith('/api/v1/release-readiness'))) {
        return requirePermission('tests:read')(req, reply);
      }
      if (method === 'POST' && pathName === '/api/v1/executions') {
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

  await app.register(applicationRoutes);
  await app.register(testCaseRoutes);
  await app.register(environmentRoutes);
  await app.register(executionRoutes);
  await app.register(workerRoutes);
  await app.register(suitePlanRoutes);
  await app.register(analyticsRoutes);
  await app.register(intelligenceRoutes);
  await app.register(scheduleRoutes);
  await app.register(buildStatusRoutes);

  await app.listen({ port, host });
  console.log(`GAVRIQ Test Engine API + UI on http://${host}:${port} (rbac=${rbacEnabled})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
