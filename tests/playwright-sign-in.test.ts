import { after, before, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const evidenceDir = mkdtempSync(path.join(tmpdir(), 'te-sign-in-'));
process.env.EVIDENCE_DIR = evidenceDir;
const { runPlaywright, closeBrowserPool } = await import('../apps/worker/src/runners/playwright.js');
let server: Server;
let base = '';
let received: unknown;
let sessionRequests = 0;
const password = 'fixture.value.with.punctuation!';

before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/session') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        sessionRequests++;
        received = JSON.parse(body);
        res.setHeader('content-type', 'application/json');
        if ((received as any).password === password) res.setHeader('set-cookie', 'fixture_session=ok; Path=/');
        res.end(JSON.stringify({ ok: (received as any).password === password }));
      });
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(`<!doctype html><html><body><div id="gate" style="${req.headers.cookie?.includes('fixture_session=ok') ? 'display:none' : ''}"><input id="username"><input id="password" type="password"><button id="login">Sign in</button></div><script>
      document.querySelector('#login').onclick = async () => {
        const r = await fetch('/session', {method:'POST',body:JSON.stringify({username:document.querySelector('#username').value,password:document.querySelector('#password').value})});
        if ((await r.json()).ok) document.querySelector('#gate').style.display='none';
      };
    </script></body></html>`);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(async () => {
  await closeBrowserPool();
  server.close();
  rmSync(evidenceDir, { recursive: true, force: true });
});

it('signs in with the original credential template rather than its narrated wording', async t => {
  const result = await runPlaywright({ baseUrl: base, browser: 'chromium', headless: true, timeoutSeconds: 15,
    signal: AbortSignal.timeout(15000), vars: { web: base, pool_user_0: 'fixture-user', pool_pass_0: password },
    steps: [{ action: 'sign_in', value: '{{pool_user_0}}', expected: 'Expected: {{pool_pass_0}}.' }],
  });
  if (/Executable doesn't exist/.test(result.message)) { t.skip('Install the worker’s Chromium browser to run this regression'); return; }
  assert.equal(result.status, 'passed', result.message);
  assert.deepEqual(received, { username: 'fixture-user', password });
  assert.ok(result.evidence?.length, 'the real browser run must retain evidence');
  const reused = await runPlaywright({ baseUrl: base, browser: 'chromium', headless: true, timeoutSeconds: 15,
    signal: AbortSignal.timeout(15000), vars: { web: base, pool_user_0: 'fixture-user', pool_pass_0: password },
    viewport: { width: 820, height: 1180 },
    steps: [{ action: 'sign_in', value: '{{pool_user_0}}', expected: 'Expected: {{pool_pass_0}}.' }],
  });
  assert.equal(reused.status, 'passed', reused.message);
  assert.equal(sessionRequests, 1, 'the second isolated browser context must reuse the cached session');
});
