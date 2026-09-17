import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function packageVersion(): string {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    return String(pkg.version || '0.0.0');
  } catch {
    return process.env.npm_package_version || '0.0.0';
  }
}

export async function metaRoutes(app: FastifyInstance) {
  app.get('/api/v1/meta', async () => ({
    service: 'gavriq-test-engine',
    version: packageVersion(),
    control_plane: true,
    capabilities: {
      repository: true,
      executions: true,
      workers: true,
      schedules: true,
      build_status: true,
      release_readiness: true,
      ai_proposals: true,
      agents: true,
      rbac: process.env.RBAC_ENABLED === 'true',
      jwt: Boolean(process.env.JWT_SECRET),
      dashboard: true,
    },
    runners: ['selenium', 'playwright', 'http', 'rest', 'api', 'performance', 'sit', 'mq', 'kafka', 'database'],
    endpoints: {
      health: '/health',
      dashboard: '/',
      applications: '/api/v1/applications',
      test_cases: '/api/v1/test-cases',
      executions: '/api/v1/executions',
      workers: '/api/v1/workers',
      environments: '/api/v1/environments',
      suites: '/api/v1/suites',
      schedules: '/api/v1/schedules',
      build_results: '/api/v1/build-results',
      test_status: '/api/v1/test-status',
      dashboard_kpi: '/api/v1/dashboard',
      release_readiness: '/api/v1/release-readiness',
      reports_summary: '/api/v1/reports/summary/:id',
      agents_context: '/api/v1/agents/context',
      preflight: '/api/v1/preflight',
      meta: '/api/v1/meta',
    },
  }));
}
