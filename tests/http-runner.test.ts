import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { autoAttachCleanups } from '../apps/api/src/catalog/user-pool.js';

// The runner writes its transcript into EVIDENCE_DIR, read when the module loads.
const evidenceDir = mkdtempSync(path.join(tmpdir(), 'te-http-runner-'));
process.env.EVIDENCE_DIR = evidenceDir;
const { runHttp } = await import('../apps/worker/src/runners/http.ts');

let server: Server;
let base = '';
let hits: string[] = [];
const createdRecords = new Set<string>();
const savedPolicy = { timeout_ms: 4321, transactional: false, tags: ['first', 'second'], nested: { enabled: true }, label: 'quoted "value"' };
let policy = structuredClone(savedPolicy);

before(async () => {
  server = createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`);
    res.setHeader('content-type', 'application/json');
    if (req.url === '/policy') {
      if (req.method === 'PUT') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => { policy = JSON.parse(body); res.end(JSON.stringify({ data: policy })); });
        return;
      }
      return res.end(JSON.stringify({ data: policy }));
    }
    if (req.url === '/api/v1/runs' && req.method === 'POST') {
      const runId = String(req.headers['x-record-id']);
      createdRecords.add(runId);
      res.statusCode = 202;
      return res.end(JSON.stringify({ runId }));
    }
    if (req.url?.startsWith('/api/v1/runs/')) {
      const id = req.url.slice('/api/v1/runs/'.length);
      if (req.method === 'DELETE') {
        res.statusCode = createdRecords.delete(id) ? 200 : 404;
        return res.end(JSON.stringify({ id }));
      }
      res.statusCode = createdRecords.has(id) ? 200 : 404;
      return res.end(JSON.stringify({ id }));
    }
    if (req.url?.startsWith('/events')) {
      const data: Array<{ eventCode: string; context: { assetId: string }; occurredAt?: string }> = [
        { eventCode: 'wanted', context: { assetId: 'other' } },
        { eventCode: 'other', context: { assetId: 'owned' } },
      ];
      if (req.url.includes('match=true')) data.push({ eventCode: 'wanted', context: { assetId: 'owned' },
        occurredAt: req.url.includes('stale=true') ? '1970-01-01T00:00:00.000Z' : new Date().toISOString() });
      return res.end(JSON.stringify({ data }));
    }
    if (req.method === 'POST' && req.url?.startsWith('/records/')) {
      const id = req.url.slice('/records/'.length);
      createdRecords.add(id);
      res.statusCode = 201;
      return res.end(JSON.stringify({ id }));
    }
    if (req.method === 'GET' && req.url?.startsWith('/records/')) {
      const id = req.url.slice('/records/'.length);
      res.statusCode = createdRecords.has(id) ? 200 : 404;
      return res.end(JSON.stringify(createdRecords.has(id) ? { id, etag: 'fresh-etag' } : { error: 'missing' }));
    }
    if (req.method === 'DELETE' && req.url === '/cleanup-fail') {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: 'cleanup failed' }));
    }
    if (req.method === 'DELETE' && req.url?.startsWith('/records/')) {
      const id = req.url.slice('/records/'.length);
      const deleted = createdRecords.delete(id);
      res.statusCode = deleted ? 200 : 404;
      return res.end(JSON.stringify({ deleted }));
    }
    if (req.url === '/fail') {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: 'expected failure' }));
    }
    if (req.url === '/slow') {
      return setTimeout(() => res.end(JSON.stringify({ ready: true })), 1000);
    }
    if (req.url === '/fixtures') {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: 'not seeded' }));
    }
    res.end(JSON.stringify({ total: 3, ready: true, items: ['a', 'b', 'c'], sha: 'e12be848', name: 'three' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(() => {
  server.close();
  rmSync(evidenceDir, { recursive: true, force: true });
});

const get = (urlPath: string, extra: Record<string, unknown> = {}) => ({ action: 'request', method: 'GET', url: `{{base}}${urlPath}`, ...extra });

describe('http runner', () => {
  it('restores a captured JSON object with its original types after pass and failure', async () => {
    for (const shouldFail of [false, true]) {
      policy = structuredClone(savedPolicy);
      try {
        const result = await runHttp({ baseUrl: base, steps: [
          get('/policy', { save: { before: 'data' } }),
          { action: 'request', method: 'PUT', url: '{{base}}/policy', body: { timeout_ms: 100, transactional: true }, expected_status: 200 },
          ...(shouldFail ? [get('/fail')] : []),
        ], cleanupSteps: [
          { action: 'request', method: 'PUT', url: '{{base}}/policy', body_json: '{{before}}', expected_status: 200 },
        ] });
        assert.equal(result.status, shouldFail ? 'failed' : 'passed', result.message);
        assert.deepEqual(policy, savedPolicy);
      } finally { policy = structuredClone(savedPolicy); }
    }
  });

  it('reports invalid JSON cleanup and still attempts later restoration', async () => {
    policy = structuredClone(savedPolicy);
    try {
      const result = await runHttp({ baseUrl: base, steps: [
        get('/policy', { save: { before: 'data' } }),
        { action: 'request', method: 'PUT', url: '{{base}}/policy', body: { transactional: true }, expected_status: 200 },
      ], cleanupSteps: [
        { action: 'request', method: 'PUT', url: '{{base}}/policy', body_json: '{{not_captured}}', expected_status: 200 },
        { action: 'request', method: 'PUT', url: '{{base}}/policy', body_json: '{{before}}', expected_status: 200 },
      ] });
      assert.equal(result.status, 'failed');
      assert.match(result.message, /body_json did not resolve to valid JSON/);
      assert.deepEqual(policy, savedPolicy);
    } finally { policy = structuredClone(savedPolicy); }
  });

  it('keeps raw request bodies literal and refuses an ambiguous JSON body', async () => {
    policy = structuredClone(savedPolicy);
    try {
      const literal = await runHttp({ baseUrl: base, vars: { replacement: 'changed' }, steps: [
        { action: 'request', method: 'PUT', url: '{{base}}/policy', body_raw: '{"label":"{{replacement}}"}', expected_status: 200 },
      ] });
      assert.equal(literal.status, 'passed', literal.message);
      assert.equal(policy.label, '{{replacement}}');
      const ambiguous = await runHttp({ baseUrl: base, steps: [
        { action: 'request', method: 'PUT', url: '{{base}}/policy', body_json: '{}', body: { unexpected: true } },
      ] });
      assert.equal(ambiguous.status, 'failed');
      assert.match(ambiguous.message, /body_json must not be combined/);
      assert.equal(policy.label, '{{replacement}}', 'an ambiguous body must not be sent');
    } finally { policy = structuredClone(savedPolicy); }
  });
  it('captures the real Sand Bench runId and verifies run deletion after pass or failure', async () => {
    for (const shouldFail of [false, true]) {
      const id = `run-${Date.now()}-${Math.random()}`;
      const fixture = { key: id, method: 'http', cleanupSteps: [] as any[], steps: [
        { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: { 'x-record-id': id },
          expected_status: 202, save: { ownedRun: 'id' } },
        { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{ownedRun}}', expected_status: 200 },
        ...(shouldFail ? [get('/fail')] : []),
      ] };
      try {
        autoAttachCleanups([fixture]);
        autoAttachCleanups([fixture]);
        const result = await runHttp({ baseUrl: base, vars: { api: base }, steps: fixture.steps, cleanupSteps: fixture.cleanupSteps });
        assert.equal(result.status, shouldFail ? 'failed' : 'passed', result.message);
        assert.equal(createdRecords.has(id), false, 'the generated run must not remain in the baseline');
        assert.equal(fixture.cleanupSteps.length, 2, 're-seeding must not duplicate cleanup actions');
      } finally { createdRecords.delete(id); }
    }
  });
  it('attaches no Sand Bench run cleanup to a case that starts runs on the engine itself', () => {
    const fixture = { key: 'engine-run', method: 'http', cleanupSteps: [] as any[], steps: [
      { action: 'request', method: 'POST', url: '{{engine}}/api/v1/runs', body: { dry_run: true }, expected_status: 200 },
    ] };
    autoAttachCleanups([fixture]);
    assert.equal(fixture.cleanupSteps.length, 0, 'the engine has no run-delete route and no {{api}}/{{token}}');
    assert.deepEqual(Object.keys((fixture.steps[0] as any).save ?? {}), [], 'the step must not gain a save either');
    assert.doesNotMatch(JSON.stringify(fixture), /\{\{(api|token)\}\}/);
  });
  it('requires all event fields to match one entry instead of unrelated rows', async () => {
    const expect_json = [{ path: 'data', some: { eventCode: 'wanted', 'context.assetId': '{{ownedId}}' } }];
    const vars = { ownedId: 'owned' };
    const wrongRows = await runHttp({ baseUrl: base, vars, steps: [get('/events', { expect_json })] });
    assert.equal(wrongRows.status, 'failed');
    assert.match(wrongRows.message, /no single entry matches/);
    const matchingRow = await runHttp({ baseUrl: base, vars, steps: [get('/events?match=true', { expect_json })] });
    assert.equal(matchingRow.status, 'passed', matchingRow.message);
    const emptyMatch = await runHttp({ baseUrl: base, steps: [get('/events', { expect_json: [{ path: 'data', some: {} }] })] });
    assert.equal(emptyMatch.status, 'failed', 'an empty field set must not turn presence into a pass');
    const fresh = [{ path: 'data', some: { eventCode: 'wanted', 'context.assetId': 'owned', occurredAt: { at_or_after: '{{ts}}' } } }];
    const stale = await runHttp({ baseUrl: base, steps: [get('/events?match=true&stale=true', { expect_json: fresh })] });
    assert.equal(stale.status, 'failed', 'an old matching event must not prove the current action succeeded');
    const current = await runHttp({ baseUrl: base, steps: [get('/events?match=true', { expect_json: fresh })] });
    assert.equal(current.status, 'passed', current.message);
  });

  it('removes a created record even when its creation response fails an assertion', async () => {
    const id = `creation-assertion-${Date.now()}-${Math.random()}`;
    try {
      const result = await runHttp({
        baseUrl: base,
        steps: [{ action: 'request', method: 'POST', url: `{{base}}/records/${id}`, expected_status: 201,
          expect_json: [{ path: 'missingField', exists: true }], save: { recordId: 'id' } }],
        cleanupSteps: [{ action: 'request', method: 'DELETE', url: '{{base}}/records/{{recordId}}', expected_status: 200 }],
      });
      assert.equal(result.status, 'failed');
      assert.match(result.message, /missingField/);
      assert.equal(createdRecords.has(id), false, 'a failed assertion must not discard the created identity');
    } finally { createdRecords.delete(id); }
  });

  it('restores fixtures created before a later prerequisite is found missing', async () => {
    const id = `late-prerequisite-${Date.now()}-${Math.random()}`;
    try {
      const result = await runHttp({
        baseUrl: base,
        steps: [
          { action: 'request', method: 'POST', url: `{{base}}/records/${id}`, expected_status: 201, save: { recordId: 'id' } },
          get('/fixtures', { precondition: true }),
        ],
        cleanupSteps: [{ action: 'request', method: 'DELETE', url: '{{base}}/records/{{recordId}}', expected_status: 200 }],
      });
      assert.equal(result.status, 'skipped');
      assert.equal(createdRecords.has(id), false, 'missing prerequisites must not bypass cleanup of earlier setup');
    } finally { createdRecords.delete(id); }
  });

  it('fails a skipped case when cleanup fails and still attempts the remaining cleanup', async () => {
    const id = `skipped-cleanup-${Date.now()}-${Math.random()}`;
    try {
      const result = await runHttp({
        baseUrl: base,
        steps: [
          { action: 'request', method: 'POST', url: `{{base}}/records/${id}`, expected_status: 201, save: { recordId: 'id' } },
          get('/fixtures', { precondition: true }),
        ],
        cleanupSteps: [
          { action: 'request', method: 'DELETE', url: '{{base}}/cleanup-fail', expected_status: 200 },
          { action: 'request', method: 'DELETE', url: '{{base}}/records/{{recordId}}', expected_status: 200 },
        ],
      });
      assert.equal(result.status, 'failed');
      assert.match(result.message, /Precondition not met/);
      assert.match(result.message, /cleanup failed/);
      assert.equal(createdRecords.has(id), false);
    } finally { createdRecords.delete(id); }
  });

  it('reports a case as skipped when a precondition step is not met, and stops there', async () => {
    hits = [];
    const result = await runHttp({ baseUrl: base, steps: [get('/fixtures', { precondition: true, description: 'fixtures are seeded' }), get('/never')] });
    assert.equal(result.status, 'skipped');
    assert.match(result.message, /^Precondition not met — step 1 \(fixtures are seeded\): expected status 200 got 404/);
    assert.deepEqual(hits, ['GET /fixtures']);
    assert.equal(result.evidence?.length, 1, 'a skipped case still leaves its transcript');
  });

  it('still fails a case whose ordinary step is not met', async () => {
    const result = await runHttp({ baseUrl: base, steps: [get('/fixtures')] });
    assert.equal(result.status, 'failed');
  });

  it('fails, not skips, when the target of a precondition step does not answer', async () => {
    const result = await runHttp({ baseUrl: 'http://127.0.0.1:9', steps: [{ action: 'request', method: 'GET', url: 'http://127.0.0.1:9/x', precondition: true }], timeoutSeconds: 5 });
    assert.equal(result.status, 'failed');
    assert.equal(result.classification, 'network_failure');
  });

  it('bounds numbers and lengths from above and matches patterns', async () => {
    const pass = await runHttp({
      baseUrl: base,
      steps: [get('/data', { expect_json: [{ path: 'total', max: 3 }, { path: 'items', max_length: 3 }, { path: 'sha', matches: '^[0-9a-f]{8}$' }, { path: 'total', matches: '^3$' }] })],
    });
    assert.equal(pass.status, 'passed', pass.message);
    for (const expectation of [{ path: 'total', max: 2 }, { path: 'items', max_length: 2 }, { path: 'name', matches: '^\\d+$' }, { path: 'missing', max: 5 }, { path: 'missing', max_length: 5 }]) {
      const fail = await runHttp({ baseUrl: base, steps: [get('/data', { expect_json: [expectation] })] });
      assert.equal(fail.status, 'failed', `should reject ${JSON.stringify(expectation)}`);
    }
  });

  it('compares a captured value with a number or boolean as text, and leaves literal comparisons strict', async () => {
    const captured = await runHttp({
      baseUrl: base,
      steps: [get('/data', { save: { total: 'total', ready: 'ready' } }), get('/data', { expect_json: [{ path: 'total', equals: '{{total}}' }, { path: 'ready', equals: '{{ready}}' }, { path: 'total', matches: '^{{total}}$' }] })],
    });
    assert.equal(captured.status, 'passed', captured.message);
    const overwritten = await runHttp({
      baseUrl: base, vars: { total: '4' },
      steps: [get('/data', { save: { total: 'total' }, expect_json: [{ path: 'total', equals: '{{total}}' }] })],
    });
    assert.equal(overwritten.status, 'failed', 'saving the new total must not overwrite the comparison with the old total');
    const literal = await runHttp({ baseUrl: base, steps: [get('/data', { expect_json: [{ path: 'total', equals: '3' }] })] });
    assert.equal(literal.status, 'failed', 'a literal "3" is not the number 3');
  });

  it('compares totals against captured numeric bounds and rejects unresolved bounds', async () => {
    const preserved = await runHttp({ baseUrl: base, steps: [
      get('/data', { save: { before: 'total' } }),
      get('/data', { expect_json: [{ path: 'total', min: '{{before}}', max: '{{before}}' }] }),
    ] });
    assert.equal(preserved.status, 'passed', preserved.message);
    for (const bound of [{ min: '{{before}}' }, { max: '{{before}}' }, { min: '{{missing}}' }, { max: '{{missing}}' }]) {
      const result = await runHttp({ baseUrl: base, vars: { before: bound.min ? '4' : '2' },
        steps: [get('/data', { expect_json: [{ path: 'total', ...bound }] })] });
      assert.equal(result.status, 'failed', `must reject a shrinking total, an exceeded maximum or an unresolved bound: ${JSON.stringify(bound)}`);
    }
  });

  it('cleans up case-owned records after both pass and assertion failure', async () => {
    const cleanupSteps = [{ action: 'request', method: 'DELETE', url: '{{base}}/records/{{recordId}}', expected_status: 200 }];
    for (const shouldFail of [false, true]) {
      const id = `case-${Date.now()}-${Math.random()}`;
      const result = await runHttp({
        baseUrl: base,
        steps: [
          { action: 'request', method: 'POST', url: `{{base}}/records/${id}`, expected_status: 201, save: { recordId: 'id' } },
          ...(shouldFail ? [get('/fail')] : []),
        ],
        cleanupSteps,
      });
      assert.equal(result.status, shouldFail ? 'failed' : 'passed', result.message);
      assert.equal(createdRecords.has(id), false, 'case-owned record must be removed');
    }
  });

  it('runs every cleanup action and reports cleanup failure', async () => {
    const id = `cleanup-${Date.now()}-${Math.random()}`;
    const result = await runHttp({
      baseUrl: base,
      steps: [{ action: 'request', method: 'POST', url: `{{base}}/records/${id}`, expected_status: 201, save: { recordId: 'id' } }, get('/fail')],
      cleanupSteps: [
        { action: 'request', method: 'DELETE', url: '{{base}}/cleanup-fail', expected_status: 200 },
        { action: 'request', method: 'DELETE', url: '{{base}}/records/{{recordId}}', expected_status: 200 },
      ],
    });
    assert.equal(result.status, 'failed');
    assert.match(result.message, /cleanup failed/);
    assert.equal(createdRecords.has(id), false, 'later cleanup must run after an earlier cleanup fails');
  });

  it('skips an idempotent delete when the resource was already removed', async () => {
    hits = [];
    const result = await runHttp({
      baseUrl: base,
      steps: [get('/data')],
      cleanupSteps: [{
        action: 'request', method: 'DELETE', url: '{{base}}/records/already-deleted',
        skip_if_missing: ['cleanup_etag'], expected_status: 200,
      }],
    });
    assert.equal(result.status, 'passed', result.message);
    assert.deepEqual(hits, ['GET /data']);
  });

  it('runs cleanup-only cases without making a default request to the base URL', async () => {
    hits = [];
    const result = await runHttp({
      baseUrl: base,
      cleanupSteps: [{ action: 'request', method: 'DELETE', url: '{{base}}/cleanup-fail', expected_status: 500 }],
    });
    assert.equal(result.status, 'passed', result.message);
    assert.deepEqual(hits, ['DELETE /cleanup-fail']);
  });

  it('passes values captured during cleanup to later cleanup steps', async () => {
    const id = `etag-${Date.now()}-${Math.random()}`;
    let deleteEtag = '';
    const original = server.listeners('request')[0] as (req: any, res: any) => void;
    const listener = (req: any, res: any) => {
      if (req.method === 'DELETE' && req.url === `/records/${id}`) deleteEtag = String(req.headers['if-match'] || '');
      return original(req, res);
    };
    server.removeListener('request', original);
    server.on('request', listener);
    try {
      const result = await runHttp({
        baseUrl: base,
        steps: [{ action: 'request', method: 'POST', url: `{{base}}/records/${id}`, expected_status: 201, save: { recordId: 'id' } }],
        cleanupSteps: [
          { action: 'request', method: 'GET', url: '{{base}}/records/{{recordId}}', expected_status: 200, save: { cleanupEtag: 'etag' } },
          { action: 'request', method: 'DELETE', url: '{{base}}/records/{{recordId}}', headers: { 'if-match': '{{cleanupEtag}}' }, expected_status: 200 },
        ],
      });
      assert.equal(result.status, 'passed', result.message);
      assert.equal(deleteEtag, 'fresh-etag');
    } finally {
      server.removeListener('request', listener);
      server.on('request', original);
      createdRecords.delete(id);
    }
  });

  it('runs cleanup after cancellation without reusing the aborted test signal', async () => {
    const id = `cancel-${Date.now()}-${Math.random()}`;
    const controller = new AbortController();
    // Cancel only after setup has completed and the next request is in flight.
    // A fixed timer could fire while the creation response is still travelling.
    const cancelInFlight = (req: import('node:http').IncomingMessage) => {
      if (req.url === '/slow') controller.abort();
    };
    server.on('request', cancelInFlight);
    try {
    const running = runHttp({
      baseUrl: base,
      signal: controller.signal,
      steps: [
        { action: 'request', method: 'POST', url: `{{base}}/records/${id}`, expected_status: 201, save: { recordId: 'id' } },
        get('/slow'),
      ],
      cleanupSteps: [{ action: 'request', method: 'DELETE', url: '{{base}}/records/{{recordId}}', expected_status: 200 }],
    });
    const result = await running;
    assert.equal(result.status, 'failed');
    assert.equal(createdRecords.has(id), false, 'cancellation must not skip cleanup');
    } finally {
      server.removeListener('request', cancelInFlight);
      createdRecords.delete(id);
    }
  });
});
