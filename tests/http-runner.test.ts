import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The runner writes its transcript into EVIDENCE_DIR, read when the module loads.
const evidenceDir = mkdtempSync(path.join(tmpdir(), 'te-http-runner-'));
process.env.EVIDENCE_DIR = evidenceDir;
const { runHttp } = await import('../apps/worker/src/runners/http.ts');

let server: Server;
let base = '';
let hits: string[] = [];
const createdRecords = new Set<string>();

before(async () => {
  server = createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`);
    res.setHeader('content-type', 'application/json');
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
    const literal = await runHttp({ baseUrl: base, steps: [get('/data', { expect_json: [{ path: 'total', equals: '3' }] })] });
    assert.equal(literal.status, 'failed', 'a literal "3" is not the number 3');
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
    const running = runHttp({
      baseUrl: base,
      signal: controller.signal,
      steps: [
        { action: 'request', method: 'POST', url: `{{base}}/records/${id}`, expected_status: 201, save: { recordId: 'id' } },
        get('/slow'),
      ],
      cleanupSteps: [{ action: 'request', method: 'DELETE', url: '{{base}}/records/{{recordId}}', expected_status: 200 }],
    });
    setTimeout(() => controller.abort(), 25);
    const result = await running;
    assert.equal(result.status, 'failed');
    assert.equal(createdRecords.has(id), false, 'cancellation must not skip cleanup');
  });
});
