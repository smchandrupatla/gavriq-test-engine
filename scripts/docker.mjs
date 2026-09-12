import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export function parseArgs(args) {
  const options = { action: args[0] || 'help', isolated: false, build: true, timeout: 180, envFile: '.env' };
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--isolated') options.isolated = true;
    else if (arg === '--no-build') options.build = false;
    else if (arg === '--env-file' && args[i + 1]) options.envFile = args[++i];
    else if (arg === '--timeout' && args[i + 1]) options.timeout = Number(args[++i]);
    else throw new Error(`Unknown or incomplete option: ${arg}`);
  }
  if (!['help', 'config', 'deploy', 'health', 'test', 'stop', 'validate'].includes(options.action)) throw new Error('Unknown action');
  if (!Number.isInteger(options.timeout) || options.timeout < 1 || options.timeout > 1800) throw new Error('Timeout must be 1–1800 seconds');
  if (options.action === 'validate' && !options.isolated) throw new Error('validate requires --isolated; use deploy, health and test for a normal deployment');
  return options;
}

export function assertRunning(expected, rows) {
  for (const service of expected) {
    const matches = rows.filter(row => row.Service === service);
    if (!matches.length) throw new Error(`${service}: container missing`);
    for (const row of matches) {
      if (row.State !== 'running') throw new Error(`${service}: ${row.State || 'unknown state'}`);
      if (row.Health && row.Health !== 'healthy') throw new Error(`${service}: ${row.Health}`);
    }
  }
}

export function isolatedConfig(config, root) {
  const result = structuredClone(config);
  result.name = `${config.name}-validation`;
  for (const service of Object.values(result.services)) {
    delete service.ports;
    service.restart = 'no';
    if (service.build) service.build.context = path.resolve(root, service.build.context);
    for (const mount of service.volumes || []) if (mount.type === 'bind') mount.source = path.resolve(root, mount.source);
  }
  // Use the disposable viewer database instead of connecting to a user's target database.
  if (result.services.dbviewer && result.services['dbviewer-db']) result.services.dbviewer.environment.DATABASE_URL = 'postgres://dbviewer:dbviewer@dbviewer-db:5432/dbviewer';
  return result;
}

export function probeSource(config, healthOnly) {
  const tests = healthOnly ? config.checks.filter(check => check.path === '/health') : config.checks;
  if (!tests.length) throw new Error('No tests configured');
  return `import test from 'node:test';
import assert from 'node:assert/strict';
const checks = ${JSON.stringify(tests)};
for (const check of checks) await test(check.name, async () => {
  const response = await fetch('http://127.0.0.1:${config.port}' + check.path, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, check.status || 200, check.path + ' returned unexpected HTTP status');
  if (check.kind === 'html') { assert.match(await response.text(), /<html[\\s>]/i); return; }
  const body = await response.json();
  assert.ok(body && typeof body === 'object', 'Expected a JSON object');
  if (check.array) assert.ok(Array.isArray(body[check.array]), 'Expected array: ' + check.array);
  if (check.field) assert.notEqual(body[check.field], undefined, 'Missing field: ' + check.field);
});
`;
}

export function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.action === 'help') {
    console.log('node scripts/docker.mjs <config|deploy|health|test|stop|validate> [--env-file FILE] [--isolated] [--no-build] [--timeout SECONDS]\nvalidate requires --isolated and stops its temporary containers even on test failure. Volumes are retained. Node.js 22+ and Docker Compose v2 are required.');
    return;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'compose.yaml'), 'utf8'));
  const checks = JSON.parse(fs.readFileSync(path.join(root, 'scripts/docker-checks.json'), 'utf8'));
  if (!config.services[checks.service]) throw new Error('Test service is absent from compose.yaml');
  const envFile = path.resolve(root, options.envFile);
  if (!fs.existsSync(envFile)) throw new Error(`Missing ${options.envFile}. Copy .env.example to .env and configure it, or explicitly pass --env-file .env.example for local evaluation.`);
  const reportDir = path.join(root, '.docker-results');
  fs.mkdirSync(reportDir, { recursive: true });
  const project = options.isolated ? `${config.name}-validation` : config.name;
  let composeFile = path.join(root, 'compose.yaml');
  if (options.isolated) {
    composeFile = path.join(reportDir, 'compose-isolated.json');
    fs.writeFileSync(composeFile, JSON.stringify(isolatedConfig(config, root), null, 2));
  }
  const base = ['compose', '--project-directory', root, '--env-file', envFile, '-p', project, '-f', composeFile];
  const evidence = { repository: config.name, action: options.action, project, isolated: options.isolated, at: new Date().toISOString(), passed: false, commands: [], scope: checks.scope };
  const run = (extra, { input, timeout = 1200000, quiet = false } = {}) => {
    const result = spawnSync('docker', [...base, ...extra], { cwd: root, input, encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', quiet ? 'pipe' : 'inherit', quiet ? 'pipe' : 'inherit'] });
    evidence.commands.push({ command: extra.filter(arg => arg !== input), exitCode: result.status, error: result.error?.message });
    if (!quiet) { if (result.stdout) process.stdout.write(result.stdout); if (result.stderr) process.stderr.write(result.stderr); }
    if (result.error || result.status !== 0) throw new Error(`Docker ${extra[0]} failed (${result.status ?? result.error?.code})`);
    return result.stdout;
  };
  const expected = Object.entries(config.services).filter(([, value]) => !value.profiles?.length).map(([name]) => name);
  const deploy = () => run(['up', '-d', ...(options.build ? ['--build'] : ['--no-build']), '--wait', '--wait-timeout', String(options.timeout)]);
  const health = () => {
    const text = run(['ps', '--all', '--format', 'json'], { quiet: true, timeout: 30000 }).trim();
    const rows = text.startsWith('[') ? JSON.parse(text) : text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    assertRunning(expected, rows);
    run(['exec', '-T', checks.service, 'node', '--input-type=module'], { input: probeSource(checks, true), timeout: 60000 });
    console.log(`Health passed for ${expected.length} services.`);
  };
  const test = () => {
    for (const suite of checks.suites || []) {
      const source = fs.readFileSync(path.join(root, suite.file), 'utf8');
      run(['exec', '-T', checks.service, 'node', '--input-type=module'], { input: source, timeout: 180000 });
    }
    run(['exec', '-T', checks.service, 'node', '--input-type=module'], { input: probeSource(checks, false), timeout: 180000 });
    console.log('Configured test cases passed. Coverage: ' + checks.scope);
  };
  let cleanup = false;
  try {
    run(['config', '--quiet'], { timeout: 30000 });
    if (options.action === 'deploy') deploy();
    if (options.action === 'health') health();
    if (options.action === 'test') { health(); test(); }
    if (options.action === 'stop') run(['down', '--timeout', '20']);
    if (options.action === 'validate') { cleanup = true; deploy(); health(); test(); }
    evidence.passed = true;
  } catch (error) {
    evidence.error = error.message;
    if (cleanup) {
      try { run(['logs', '--no-color', '--tail', '30'], { timeout: 30000 }); }
      catch (diagnosticError) { evidence.diagnosticError = diagnosticError.message; }
    }
    throw error;
  } finally {
    if (cleanup) {
      try { run(['down', '--timeout', '20'], { timeout: 90000 }); }
      catch (error) { evidence.passed = false; evidence.cleanupError = error.message; process.exitCode = 1; }
    }
    fs.writeFileSync(path.join(reportDir, `${options.action}.json`), JSON.stringify(evidence, null, 2) + '\n');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
