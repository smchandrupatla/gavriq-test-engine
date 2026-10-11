import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCaseShape } from '../apps/worker/src/case-shape.ts';

const env = { username: 'u0', password: 'p0', api: 'http://e', pool_user_0: 'u0', pool_pass_0: 'p0' };

describe('worker pre-flight: atomic case-shape validator', () => {
  it('passes a well-formed HTTP case whose vars all resolve', () => {
    const tc = {
      execution_method: 'http',
      steps: [
        { action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login', body: { username: '{{username}}', password: '{{password}}' }, save: { token: 'token' } },
        { action: 'request', method: 'GET', url: '{{api}}/api/v1/health', headers: { authorization: 'Bearer {{token}}' } },
      ],
    };
    assert.equal(validateCaseShape(tc, env), null);
  });

  it('refuses a case that references an unresolved var', () => {
    const tc = {
      execution_method: 'http',
      steps: [
        { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules/{{rule_id}}' },
      ],
    };
    const problem = validateCaseShape(tc, env);
    assert.ok(problem, 'expected a shape problem');
    assert.match(problem!, /unresolved \{\{rule_id\}\}/);
  });

  it('allows a cleanup step with skip_if_missing to reference an uncreated var', () => {
    const tc = {
      execution_method: 'http',
      steps: [
        { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', expected_status: [200, 400], save: { run_id: 'id' } },
      ],
      validation_rules: {
        cleanup_steps: [
          { action: 'request', method: 'DELETE', url: '{{api}}/api/v1/runs/{{run_id}}', skip_if_missing: ['run_id'] },
        ],
      },
    };
    assert.equal(validateCaseShape(tc, env), null);
  });

  it('refuses a cleanup step whose var is neither saved nor in skip_if_missing', () => {
    const tc = {
      execution_method: 'http',
      steps: [{ action: 'request', method: 'GET', url: '{{api}}/api/v1/health' }],
      validation_rules: {
        cleanup_steps: [
          { action: 'request', method: 'DELETE', url: '{{api}}/api/v1/runs/{{ghost_id}}' },
        ],
      },
    };
    const problem = validateCaseShape(tc, env);
    assert.ok(problem);
    assert.match(problem!, /\{\{ghost_id\}\}/);
  });

  it('bypasses the var-resolution gate for cases flagged reads-baseline', () => {
    const tc = {
      execution_method: 'http',
      steps: [{ action: 'request', method: 'GET', url: '{{api}}/api/v1/test-cases/TE-API-META' }],
      validation_rules: {
        atomicity_note: { reason: 'reads-baseline', detail: 'inspects seeded catalog case metadata' },
      },
    };
    assert.equal(validateCaseShape(tc, env), null);
  });

  it('skips the check for non-HTTP cases (UI runners use their own substitution)', () => {
    const tc = {
      execution_method: 'playwright',
      steps: [{ action: 'type', selector: '#username', value: '{{anything}}' }],
    };
    assert.equal(validateCaseShape(tc, env), null);
  });
});
