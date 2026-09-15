#!/usr/bin/env tsx
/**
 * GAVRIQ Test Engine — Control Plane API
 */
import Fastify from 'fastify';
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
import { resolveActor, requirePermission } from './middleware/rbac.js';

const port = Number(process.env.PORT || process.env.TEST_ENGINE_PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const rbacEnabled = process.env.RBAC_ENABLED === 'true';

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
    version: '1.2.0',
    prompts: '1-10',
    rbac: rbacEnabled,
  }));

  app.get('/ready', async () => ({ status: 'ready' }));

  if (rbacEnabled) {
    app.addHook('preHandler', async (req, reply) => {
      const path = req.url.split('?')[0];
      const method = req.method;

      if (path === '/health' || path === '/ready') return;
      if (path.startsWith('/api/v1/workers') && method === 'POST') return;
      if (path === '/api/v1/executions/claim') return;

      if (method === 'GET' && (path.startsWith('/api/v1/test-cases') || path.startsWith('/api/v1/applications') || path.startsWith('/api/v1/dashboard') || path.startsWith('/api/v1/search'))) {
        return requirePermission('tests:read')(req, reply);
      }
      if (method === 'POST' && path === '/api/v1/executions') {
        return requirePermission('executions:run')(req, reply);
      }
      if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && path.startsWith('/api/v1/test-cases')) {
        return requirePermission('tests:write')(req, reply);
      }
      if (path.startsWith('/api/v1/audit')) {
        return requirePermission('audit:read')(req, reply);
      }
      if (path.startsWith('/api/v1/release-readiness')) {
        return requirePermission('release:decide')(req, reply);
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

  await app.listen({ port, host });
  console.log(`GAVRIQ Test Engine API listening on http://${host}:${port} (rbac=${rbacEnabled})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
