/**
 * Sign-in rules for Sand Bench cases (apps/api/src/catalog/sandbench-identity.ts),
 * the identity lane a worker gives each execution, and the shared administrator
 * session of the HTTP runner. Together they are what lets cases that sign in run
 * side by side on an application that ends every session of a user on sign-out,
 * caps sessions per user and throttles failed sign-ins per client address.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applySandbenchIdentityRules, syntheticClientAddress } from '../apps/api/src/catalog/sandbench-identity.js';
import { SANDBENCH_ALL_CASES } from '../apps/api/src/catalog/sandbench-catalog.js';
import { withIdentityLane } from '../apps/worker/src/identity-lane.js';
import type { CaseDef } from '../apps/api/src/catalog/types.js';

const evidenceDir = mkdtempSync(path.join(tmpdir(), 'te-identity-'));
process.env.EVIDENCE_DIR = evidenceDir;
const { runHttp, clearSharedSessions } = await import('../apps/worker/src/runners/http.js');

function caseOf(partial: Partial<CaseDef>): CaseDef {
  return {
    key: 'SB-T-CASE', name: 'n', objective: 'o', description: 'd', suiteKey: 's', testType: 'api', method: 'http',
    severity: 'low', priority: 'p3', preconditions: 'p', tags: [], dataProfile: { profile: 'x', data: 'x', source: 'x' }, expected: 'e',
    ...partial,
  } as CaseDef;
}
const login = (username: string, password: string, extra: Record<string, unknown> = {}) => ({
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login', body: { username, password }, ...extra,
});

describe('made-up client address', () => {
  it('is stable per case and inside the benchmarking range no real client comes from', () => {
    const a = syntheticClientAddress('SB-PT-LOGIN-WRONG-PASSWORD');
    assert.equal(a, syntheticClientAddress('SB-PT-LOGIN-WRONG-PASSWORD'));
    assert.match(a, /^198\.(18|19)\.\d{1,3}\.\d{1,3}$/);
    const last = Number(a.split('.')[3]);
    assert.ok(last >= 1 && last <= 254);
  });

  it('gives different cases different addresses, so one case cannot use up another\'s allowance', () => {
    const seen = new Set((SANDBENCH_ALL_CASES as CaseDef[]).slice(0, 2000).map((c) => syntheticClientAddress(c.key)));
    assert.ok(seen.size > 1900, `only ${seen.size} distinct addresses for 2000 cases`);
  });
});

describe('sign-in rules applied to cases', () => {
  it('shares one administrator session per worker instead of a sign-in per case', () => {
    const [c] = applySandbenchIdentityRules([caseOf({
      steps: [login('{{admin_username}}', '{{admin_password}}', { expected_status: 200, save: { adminToken: 'token' } })],
    })]);
    assert.deepEqual((c!.steps![0] as any).reuse_session, { check_url: '{{api}}/api/v1/session/me', token_path: 'token' });
  });

  it('leaves an operator sign-in as a real sign-in: every case starts with its own session', () => {
    const [c] = applySandbenchIdentityRules([caseOf({
      steps: [login('{{username}}', '{{password}}', { expected_status: 200, save: { token: 'token' } })],
    })]);
    assert.equal((c!.steps![0] as any).reuse_session, undefined);
    assert.equal((c!.steps![0] as any).headers, undefined);
    assert.equal(c!.cleanupSteps, undefined);
  });

  it('sends a sign-in that is meant to fail from the case\'s own made-up address', () => {
    const [c] = applySandbenchIdentityRules([caseOf({
      key: 'SB-T-UNKNOWN-USER',
      steps: [login('nobody', 'x', { expected_status: 401, headers: { 'x-request-id': 'r1' } })],
    })]);
    assert.deepEqual((c!.steps![0] as any).headers, { 'x-request-id': 'r1', 'x-forwarded-for': syntheticClientAddress('SB-T-UNKNOWN-USER') });
    assert.equal(c!.cleanupSteps, undefined, 'an unknown user has no account whose failure count needs restoring');
  });

  it('restores the operator\'s failure count after a deliberate wrong password', () => {
    const [c] = applySandbenchIdentityRules([caseOf({
      steps: [login('{{username}}', 'not-the-password', { expected_status: 401 })],
    })]);
    const restore = c!.cleanupSteps!.at(-1) as any;
    assert.equal(restore.url, '{{api}}/api/v1/session/login');
    assert.deepEqual(restore.body, { username: '{{username}}', password: '{{password}}' });
    assert.equal(restore.expected_status, 200);
    assert.ok(restore.text && restore.expected, 'the cleanup step is written out in plain words');
  });

  it('does the same for a load case that hammers the sign-in with bad credentials', () => {
    const [c] = applySandbenchIdentityRules([caseOf({
      key: 'SB-T-PERF-REJECT', method: 'performance',
      validationRules: { url: '{{api}}/api/v1/session/login', method: 'POST', expect_status: [401, 429], body: { username: 'nobody', password: 'x' } },
    })]);
    assert.equal((c!.validationRules as any).headers['x-forwarded-for'], syntheticClientAddress('SB-T-PERF-REJECT'));
  });

  it('gives a browser case that types a wrong password its own address and restores the operator afterwards', () => {
    const [c] = applySandbenchIdentityRules([caseOf({
      key: 'SB-T-GUI-WRONG', method: 'playwright',
      validationRules: { browser: 'chromium' },
      steps: [
        { action: 'type', selector: '#gate #username', value: '{{username}}' },
        { action: 'type', selector: '#gate #password', value: 'not-the-right-password' },
        { action: 'click', selector: '#gate #login' },
      ],
    })]);
    assert.deepEqual((c!.validationRules as any).extra_http_headers, { 'x-forwarded-for': syntheticClientAddress('SB-T-GUI-WRONG') });
    assert.equal((c!.validationRules as any).browser, 'chromium');
    assert.equal((c!.cleanupSteps!.at(-1) as any).expected_status, 200);
  });

  it('does not treat a browser case that types the real password as a deliberate failure', () => {
    const [c] = applySandbenchIdentityRules([caseOf({
      method: 'playwright',
      steps: [
        { action: 'type', selector: '#gate #username', value: '{{username}}' },
        { action: 'type', selector: '#gate #password', value: '{{password}}' },
      ],
    })]);
    assert.equal((c!.validationRules as any)?.extra_http_headers, undefined);
    assert.equal(c!.cleanupSteps, undefined);
  });

  it('is idempotent', () => {
    const cases = [caseOf({ steps: [login('{{username}}', 'bad', { expected_status: 401 }), login('{{admin_username}}', '{{admin_password}}', { expected_status: 200 })] })];
    const once = JSON.stringify(applySandbenchIdentityRules(cases));
    assert.equal(JSON.stringify(applySandbenchIdentityRules(cases)), once);
  });

  it('holds for the whole catalogue: no deliberate sign-in failure goes out from the worker\'s own address, and nobody signs the administrator out', () => {
    const cases = applySandbenchIdentityRules(structuredClone(SANDBENCH_ALL_CASES) as CaseDef[]);
    const offenders: string[] = [];
    for (const c of cases) {
      const steps = [...((c.steps || []) as any[]), ...((c.cleanupSteps || []) as any[])];
      for (const s of steps) {
        const url = String(s?.url || '');
        const expected = (Array.isArray(s?.expected_status) ? s.expected_status : [s?.expected_status ?? 200]).map(Number);
        if (s?.action === 'request' && /\/api\/v1\/session\/login/.test(url) && !expected.every((n: number) => n === 200)) {
          if (!Object.keys(s.headers || {}).some((k) => k.toLowerCase() === 'x-forwarded-for')) offenders.push(`${c.key}: sign-in failure from the worker's address`);
        }
        if (s?.action === 'request' && /\/api\/v1\/session\/logout/.test(url) && /\{\{\s*adminToken\s*\}\}/.test(JSON.stringify(s.headers || {}))) {
          offenders.push(`${c.key}: signs the shared administrator out`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });
});

describe('identity lane', () => {
  const vars = { username: 'operator', password: 'p', pool_user_0: 'pool.op0', pool_pass_0: 'pw0', pool_user_3: 'pool.op3', pool_pass_3: 'pw3' };

  it('makes the lane\'s pool operator the identity of every case in the execution', () => {
    assert.deepEqual(withIdentityLane(vars, 3), { ...vars, identity_lane: '3', username: 'pool.op3', password: 'pw3' });
    assert.equal(withIdentityLane(vars, '0').username, 'pool.op0');
  });

  it('keeps the environment\'s own identity when there is no lane or no pool entry for it', () => {
    assert.equal(withIdentityLane(vars, undefined), vars);
    assert.equal(withIdentityLane(vars, null), vars);
    assert.equal(withIdentityLane(vars, 7), vars);
    assert.equal(withIdentityLane(vars, -1), vars);
    assert.equal(withIdentityLane(vars, 'x'), vars);
  });
});

describe('shared session in the HTTP runner', () => {
  let server: Server;
  let base = '';
  let logins = 0;
  let checks = 0;
  const live = new Set<string>();

  before(async () => {
    server = createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      if (req.method === 'POST' && req.url === '/api/v1/session/login') {
        logins++;
        const token = `session-${logins}`;
        live.add(token);
        return res.end(JSON.stringify({ token, user: { username: 'admin' } }));
      }
      if (req.url === '/api/v1/session/me') {
        checks++;
        const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
        res.statusCode = live.has(token) ? 200 : 401;
        return res.end(JSON.stringify({ token }));
      }
      res.statusCode = 404;
      res.end('{}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    base = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : '';
  });
  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(evidenceDir, { recursive: true, force: true });
  });

  const adminCase = () => runHttp({
    baseUrl: base,
    vars: { api: base },
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login', body: { username: 'admin', password: 'pw' }, expected_status: 200,
        save: { adminToken: 'token' }, reuse_session: { check_url: '{{api}}/api/v1/session/me' }, description: 'admin login' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/session/me', headers: { authorization: 'Bearer {{adminToken}}' }, expected_status: 200, description: 'use the session' },
    ],
  });

  it('signs in once and hands the same session to the next case after checking it', async () => {
    clearSharedSessions();
    logins = 0;
    const first = await adminCase();
    const second = await adminCase();
    assert.equal(first.status, 'passed', first.message);
    assert.equal(second.status, 'passed', second.message);
    assert.equal(logins, 1, 'the second case must not open a second administrator session');
    assert.ok(second.remarks!.some((line) => /checked and reused/.test(line)), 'the remark says the session was reused');
  });

  it('signs in again when the shared session has ended, and only then', async () => {
    clearSharedSessions();
    logins = 0;
    await adminCase();
    live.clear();
    const afterEviction = await adminCase();
    assert.equal(afterEviction.status, 'passed', afterEviction.message);
    assert.equal(logins, 2);
  });

  it('opens one session for cases that start together', async () => {
    clearSharedSessions();
    logins = 0;
    const results = await Promise.all([adminCase(), adminCase(), adminCase(), adminCase()]);
    assert.ok(results.every((r) => r.status === 'passed'));
    assert.equal(logins, 1);
  });

  it('does not share a sign-in that was not asked to be shared', async () => {
    clearSharedSessions();
    logins = 0;
    const plain = () => runHttp({ baseUrl: base, vars: { api: base }, steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login', body: { username: 'op', password: 'pw' }, expected_status: 200, save: { token: 'token' } },
    ] });
    await plain();
    await plain();
    assert.equal(logins, 2);
  });
});
