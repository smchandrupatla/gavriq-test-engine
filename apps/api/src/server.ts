#!/usr/bin/env tsx
/**
 * GAVRIQ Test Engine — Control Plane API
 * Prompts 1–10 foundation server
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

const port = Number(process.env.PORT || process.env.TEST_ENGINE_PORT || 8787);
const host = process.env.HOST || '0.0.0.0';

async function main() {
  // Ensure schema on boot (idempotent)
  try {
    await migrate();
  } catch (err) {
    console.warn('[boot] migrate warning (DB may not be ready yet):', (err as Error).message);
  }

  const app = Fastify({
    logger: true,
    requestTimeout: 120_000,
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'gavriq-test-engine',
    version: '1.0.0',
    prompts: '1-10-foundation',
  }));

  app.get('/ready', async () => ({ status: 'ready' }));

  await app.register(applicationRoutes);
  await app.register(testCaseRoutes);
  await app.register(environmentRoutes);
  await app.register(executionRoutes);
  await app.register(workerRoutes);
  await app.register(suitePlanRoutes);
  await app.register(analyticsRoutes);
  await app.register(intelligenceRoutes);

  await app.listen({ port, host });
  console.log(`GAVRIQ Test Engine API listening on http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
