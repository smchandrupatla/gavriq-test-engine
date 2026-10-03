/**
 * Security scans API against a live engine: post a scan, read the overview and the
 * register, then post a later scan where one finding is gone (fixed) and a fixed one
 * is back (reopened). A retried post is a duplicate, not a second scan.
 *
 *   ENGINE_IT_BASE=http://127.0.0.1:8797 npx tsx --test tests/security-scans-api.test.ts
 * Skipped when ENGINE_IT_BASE is unset. Uses its own project name, so real data is untouched.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.ENGINE_IT_BASE?.replace(/\/$/, '');
const project = `it-security-${Date.now().toString(36)}`;

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}

const f = (fingerprint: string, severity = 'high') => ({
  fingerprint, rule: 'code.eval', category: 'code', severity, title: `Finding ${fingerprint.slice(0, 4)}`,
  file: 'apps/x.ts', line: 1, detail: 'eval(x)', status: 'new',
});

const scan = (finishedAt: string, findings: unknown[], result = 'failed') => ({
  schema: 'sandbench.security-scan/v1', project, branch: 'main', commit: finishedAt.slice(11, 19).replace(/:/g, ''),
  trigger: 'gate', failOn: 'medium', result, startedAt: finishedAt, finishedAt, durationMs: 1000,
  tools: [{ name: 'code', status: 'ok', findings: findings.length }], findings, blocking: [],
});

describe('security scans API', { skip: !BASE && 'set ENGINE_IT_BASE to run' }, () => {
  it('records scans and keeps the register open / fixed / reopened', async () => {
    const first = scan('2026-09-29T01:00:00.000Z', [f('aaaa000000000001'), f('aaaa000000000002', 'medium')]);
    const posted = await call('POST', '/api/v1/security-scans', first);
    assert.equal(posted.status, 201);
    assert.match(posted.body.data.key, /^SS-20260929-/);
    assert.equal(posted.body.data.findings.new, 2);

    const retry = await call('POST', '/api/v1/security-scans', first);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.duplicate, true);

    const overview = await call('GET', `/api/v1/security/overview?project=${project}`);
    assert.equal(overview.body.data.latest.result, 'failed');
    assert.equal(overview.body.data.register.openTotal, 2);
    assert.equal(overview.body.data.scans, 1);

    const second = await call('POST', '/api/v1/security-scans', scan('2026-09-29T02:00:00.000Z', [f('aaaa000000000002', 'medium')]));
    assert.equal(second.body.data.findings.fixed, 1);
    const fixed = await call('GET', `/api/v1/security-findings?project=${project}&status=fixed`);
    assert.deepEqual(fixed.body.data.map((x: any) => x.fingerprint), ['aaaa000000000001']);

    const third = await call('POST', '/api/v1/security-scans', scan('2026-09-29T03:00:00.000Z', [f('aaaa000000000001'), f('aaaa000000000002', 'medium')]));
    assert.equal(third.body.data.findings.reopened, 1);
    const open = await call('GET', `/api/v1/security-findings?project=${project}&status=open`);
    const back = open.body.data.find((x: any) => x.fingerprint === 'aaaa000000000001');
    assert.equal(back.reopen_count, 1);

    const detail = await call('GET', `/api/v1/security-scans/${third.body.data.key}`);
    assert.equal(detail.body.data.findings.length, 2);
    const latest = await call('GET', `/api/v1/security-scans/latest?project=${project}`);
    assert.equal(latest.body.data.key, third.body.data.key);
  });

  it('rejects a malformed report', async () => {
    const bad = await call('POST', '/api/v1/security-scans', { project, findings: 'nope', result: 'failed' });
    assert.equal(bad.status, 422);
  });
});
