#!/usr/bin/env node
/**
 * Consolidated entrypoint for the Test Engine + SIT console single deployable.
 *
 * Both apps keep running as their own, unmodified Node entrypoints (apps/api/src/server.ts
 * and sit/console.mjs), each bound to an internal-only port. This process supervises them
 * as independent child processes (restarting one does not touch the other) and reverse
 * proxies a single external port to whichever child owns a request's path — everything
 * under /sit goes to the console, everything else to the API. That process-level split is
 * what preserves sit-console's documented "keeps reporting the app is down while it's
 * down" property even though both now ship in one image/container: a crash in one child's
 * event loop does not take the other's down, only killing this whole process (i.e.
 * stopping the container) stops both.
 */
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';

const EXTERNAL_PORT = Number(process.env.PORT || 8787);
const EXTERNAL_HOST = process.env.HOST || '0.0.0.0';
const API_INTERNAL_PORT = Number(process.env.API_INTERNAL_PORT || 18787);
const SIT_INTERNAL_PORT = Number(process.env.SIT_INTERNAL_PORT || 18098);
const RESTART_DELAY_MS = 1000;

let shuttingDown = false;
const children = new Map();

function prefixed(name, chunk) {
  return chunk
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => `[${name}] ${line}`)
    .join('\n') + '\n';
}

function startChild(name, command, args, env) {
  const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.set(name, child);
  child.stdout.on('data', (chunk) => process.stdout.write(prefixed(name, chunk)));
  child.stderr.on('data', (chunk) => process.stderr.write(prefixed(name, chunk)));
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[supervisor] ${name} exited (code=${code} signal=${signal}); restarting in ${RESTART_DELAY_MS}ms`);
    setTimeout(() => startChild(name, command, args, env), RESTART_DELAY_MS);
  });
}

startChild('api', 'npx', ['tsx', 'apps/api/src/server.ts'], {
  PORT: String(API_INTERNAL_PORT),
  HOST: '127.0.0.1',
});

startChild('sit', 'node', ['sit/console.mjs'], {
  PORT: String(SIT_INTERNAL_PORT),
});

const proxy = createServer((req, res) => {
  const targetPort = req.url && (req.url === '/sit' || req.url.startsWith('/sit/') || req.url.startsWith('/sit?'))
    ? SIT_INTERNAL_PORT
    : API_INTERNAL_PORT;
  const upstream = httpRequest(
    { host: '127.0.0.1', port: targetPort, path: req.url, method: req.method, headers: req.headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );
  upstream.on('error', (err) => {
    if (res.headersSent) { res.end(); return; }
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'upstream_unavailable', message: err.message }));
  });
  req.pipe(upstream);
});

proxy.listen(EXTERNAL_PORT, EXTERNAL_HOST, () => {
  console.log(`[supervisor] proxy on http://${EXTERNAL_HOST}:${EXTERNAL_PORT} — / -> api:${API_INTERNAL_PORT}, /sit -> sit:${SIT_INTERNAL_PORT}`);
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[supervisor] received ${signal}, shutting down`);
  for (const child of children.values()) child.kill(signal);
  proxy.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
