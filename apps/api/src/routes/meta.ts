import type { FastifyInstance } from 'fastify';

export async function metaRoutes(app: FastifyInstance) {
  app.get('/api/v1/meta', async () => ({
    service: 'gavriq-test-engine',
    version: '0.2.4',
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
    runners: ['selenium', 'playwright', 'http', 'rest', 'api', 'performance'],
    endpoints: {
      health: '/health',
      dashboard: '/',
      sit_catalog: '/api/v1/sit-catalog',
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
      meta: '/api/v1/meta',
    },
  }));
}
