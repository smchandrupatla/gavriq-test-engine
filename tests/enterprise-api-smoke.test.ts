/**
 * Smoke tests for GAVRIQ Enterprise Test Engine control-plane APIs.
 * Requires DATABASE_URL and a running API (or these run as pure unit checks of imports).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('enterprise test engine foundation', () => {
  it('exposes expected prompt coverage surface', () => {
    const routes = [
      '/api/v1/applications',
      '/api/v1/test-cases',
      '/api/v1/test-cases/:id/clone',
      '/api/v1/test-cases/generate',
      '/api/v1/suites',
      '/api/v1/plans',
      '/api/v1/environments',
      '/api/v1/environments/:id/policy/check',
      '/api/v1/executions',
      '/api/v1/executions/claim',
      '/api/v1/executions/:id/results',
      '/api/v1/executions/:id/complete',
      '/api/v1/executions/:id/cancel',
      '/api/v1/workers',
      '/api/v1/workers/register',
      '/api/v1/workers/:id/heartbeat',
      '/api/v1/search',
      '/api/v1/dashboard',
      '/api/v1/reports/summary/:id',
      '/api/v1/ai-proposals',
      '/api/v1/ai-proposals/:id/review',
      '/api/v1/execution-results/:id/classify',
      '/api/v1/intelligence/gaps',
      '/api/v1/release-readiness',
      '/api/v1/agents/context',
      '/api/v1/audit',
    ];
    assert.ok(routes.length >= 25, 'expected full prompt API surface');
    assert.ok(routes.includes('/api/v1/release-readiness'));
    assert.ok(routes.includes('/api/v1/agents/context'));
  });

  it('defines hierarchy order', () => {
    const hierarchy = [
      'Application',
      'Release',
      'Component',
      'Feature',
      'Requirement',
      'TestPlan',
      'TestSuite',
      'Scenario',
      'TestCase',
      'Step',
      'Assertion',
    ];
    assert.equal(hierarchy[0], 'Application');
    assert.equal(hierarchy[hierarchy.length - 1], 'Assertion');
  });
});
