import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { parseArgs, assertRunning, isolatedConfig, probeSource } from '../docker.mjs';

test('validation cannot tear down a normal deployment', () => {
  assert.throws(() => parseArgs(['validate']), /requires --isolated/);
  assert.equal(parseArgs(['validate', '--isolated']).isolated, true);
  assert.throws(() => parseArgs(['deploy', '--timeout', 'NaN']), /Timeout/);
  assert.throws(() => parseArgs(['test', '--env-file']), /incomplete/);
});
test('readiness rejects missing, exited, and unhealthy replicas', () => {
  assert.throws(() => assertRunning(['app'], []), /missing/);
  assert.throws(() => assertRunning(['app'], [{ Service: 'app', State: 'exited' }]), /exited/);
  assert.throws(() => assertRunning(['app'], [{ Service: 'app', State: 'running', Health: 'healthy' }, { Service: 'app', State: 'running', Health: 'unhealthy' }]), /unhealthy/);
  assert.doesNotThrow(() => assertRunning(['app', 'worker'], [{ Service: 'app', State: 'running', Health: 'healthy' }, { Service: 'worker', State: 'running', Health: '' }]));
});
test('isolated configuration preserves original and removes published ports', () => {
  const original = { name: 'sample', services: { app: { ports: ['8080:80'], build: { context: '.' }, volumes: [{ type: 'bind', source: './public', target: '/public' }] } } };
  const isolated = isolatedConfig(original, process.cwd());
  assert.equal(isolated.name, 'sample-validation');
  assert.equal(isolated.services.app.ports, undefined);
  assert.deepEqual(original.services.app.ports, ['8080:80']);
  assert.equal(isolated.services.app.build.context, process.cwd());
});
async function checkResponse(status, body) {
  const server = http.createServer((_req, res) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const script = probeSource({ port: server.address().port, checks: [{ name: 'array contract', path: '/test', array: 'data' }] }, false);
    const child = spawn(process.execPath, ['--input-type=module'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.resume(); child.stderr.resume(); child.stdin.end(script);
    const [code] = await once(child, 'exit');
    return code;
  } finally { await new Promise(resolve => server.close(resolve)); }
}
test('test process succeeds only for the expected HTTP status and response shape', async () => {
  assert.equal(await checkResponse(200, { data: [] }), 0);
  assert.notEqual(await checkResponse(500, { data: [] }), 0);
  assert.notEqual(await checkResponse(200, { data: {} }), 0);
});
