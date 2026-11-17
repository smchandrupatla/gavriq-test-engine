#!/usr/bin/env node
/**
 * Trigger a test run for one application on one environment and (by default)
 * wait for its verdict. Exit code is the gate for whatever called it:
 *
 *   0  exit criteria met — every case reported, passed, and evidenced
 *   1  run failed or was inconclusive (missing results or evidence)
 *   2  run could not be started, stalled (no worker), or timed out
 *
 *   node scripts/trigger-run.mjs --app sand-bench --env sand-bench-container
 *   node scripts/trigger-run.mjs --app sand-bench --env sit --suites sb-smoke,sb-api --reason "deploy 1.4.2"
 *   node scripts/trigger-run.mjs --app sand-bench --env sit --dry-run
 *
 * TEST_ENGINE_API   engine base URL (default http://127.0.0.1:8787)
 * TEST_ENGINE_KEY   sent as X-Api-Key (an entry of the engine's TRIGGER_API_KEYS)
 */
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const next = args[i + 1];
  return next === undefined || next.startsWith('--') ? true : next;
}
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

const API = String(flag('api') || process.env.TEST_ENGINE_API || 'http://127.0.0.1:8787').replace(/\/$/, '');
const KEY = process.env.TEST_ENGINE_KEY || '';
const app = flag('app');
const env = flag('env');
const timeoutMs = (Number(flag('timeout')) || 3600) * 1000;
const pollMs = (Number(flag('poll')) || 5) * 1000;

if (typeof app !== 'string' || typeof env !== 'string') {
  console.error('usage: trigger-run.mjs --app <application> --env <environment> [--suites a,b] [--tags a,b] [--types a,b] [--methods a,b] [--cases K1,K2] [--reason text] [--exclusive] [--dry-run] [--no-wait] [--timeout seconds]');
  process.exit(2);
}

async function call(route, init = {}) {
  const res = await fetch(`${API}${route}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(KEY ? { 'x-api-key': KEY } : {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const scope = {
  suites: list(flag('suites')),
  tags: list(flag('tags')),
  test_types: list(flag('types')),
  methods: list(flag('methods')),
  case_keys: list(flag('cases')),
};

const started = await call('/api/v1/runs', {
  method: 'POST',
  body: JSON.stringify({
    application: app,
    environment: env,
    scope,
    reason: typeof flag('reason') === 'string' ? flag('reason') : undefined,
    trigger_source: typeof flag('source') === 'string' ? flag('source') : 'ci',
    exclusive: flag('exclusive') === true,
    dry_run: flag('dry-run') === true,
  }),
}).catch((err) => ({ status: 0, body: { error: err.message } }));

if (flag('dry-run') === true) {
  console.log(JSON.stringify(started.body.data ?? started.body, null, 2));
  process.exit(started.status === 200 ? 0 : 2);
}
if (started.status !== 202) {
  console.error(`could not start run (HTTP ${started.status}): ${JSON.stringify(started.body)}`);
  process.exit(2);
}

const run = started.body.data;
console.log(`run ${run.run_id}: ${run.total_cases} cases in ${run.executions.length} executions on ${run.environment} (${run.base_url})`);
if (run.excluded?.length) console.log(`excluded by policy or automation status: ${run.excluded.length}`);
if (started.body.warning) console.warn(`warning: ${started.body.warning}`);
console.log(`status:   ${API}${run.status_url}`);
console.log(`evidence: ${API}${run.evidence_url}`);
if (flag('no-wait') === true) process.exit(0);

const deadline = Date.now() + timeoutMs;
let stalledSince = 0;
let last = '';
for (;;) {
  await new Promise((r) => setTimeout(r, pollMs));
  const { status, body } = await call(run.status_url).catch(() => ({ status: 0, body: {} }));
  const s = body.data;
  if (status !== 200 || !s) {
    if (Date.now() > deadline) { console.error('timed out: engine stopped answering'); process.exit(2); }
    continue;
  }
  const line = `${s.state}: ${s.totals.reported}/${s.totals.cases} reported — ${s.totals.passed} passed, ${s.totals.failed} failed, ${s.totals.inconclusive} inconclusive, ${s.totals.without_evidence} without evidence`;
  if (line !== last) console.log(line);
  last = line;

  if (s.state === 'completed' || s.state === 'cancelled') {
    for (const p of (s.problems || []).slice(0, 25)) {
      console.log(`  ${String(p.status).toUpperCase()} ${p.case_key}: ${String(p.message || '').slice(0, 200)}`);
    }
    console.log(`verdict: ${s.verdict ?? s.state} — exit criteria ${s.exit_criteria.met ? 'MET' : 'NOT MET'} (reported=${s.exit_criteria.all_cases_reported} evidence=${s.exit_criteria.evidence_complete} passed=${s.exit_criteria.all_passed})`);
    process.exit(s.exit_criteria.met ? 0 : 1);
  }
  if (s.state === 'stalled') {
    stalledSince ||= Date.now();
    if (Date.now() - stalledSince > 120_000) { console.error('stalled: no worker online for 2 minutes'); process.exit(2); }
  } else {
    stalledSince = 0;
  }
  if (Date.now() > deadline) { console.error(`timed out after ${timeoutMs / 1000}s`); process.exit(2); }
}
