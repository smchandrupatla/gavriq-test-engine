/**
 * Parallel-safe user pool for Sand Bench cases.
 *
 * Sand Bench enforces one active session per user — a second login from the
 * same identity invalidates the first. A catalog that logs every case in as
 * `operator.acme` therefore cannot run in parallel: the Nth case kicks out
 * the (N-1)th. This module hands each case a pool slot picked from its own
 * key, so N parallel cases get N distinct identities and keep their tokens.
 *
 * Pool sizing: POOL_SIZE caps the number of cases that can safely run in
 * parallel without a session collision. Raising it requires the Sand Bench
 * side to seed the matching extra users (see docs/USER-POOL.md).
 *
 * The pool slots are addressed through environment vars (not hard-coded
 * usernames) so a deployment with different credentials can override them
 * via config.vars / config.secret_env without a catalog change.
 */
export const POOL_SIZE = 8;
export const ADMIN_POOL_SIZE = 2;

function hashSlot(key: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export interface PoolSlot {
  usernameVar: string;
  passwordVar: string;
  tokenVar: string;
  slot: number;
}

export function pickUser(caseKey: string): PoolSlot {
  const slot = hashSlot(caseKey, POOL_SIZE);
  return {
    usernameVar: `pool_user_${slot}`,
    passwordVar: `pool_pass_${slot}`,
    tokenVar: `token_u${slot}`,
    slot,
  };
}

export function pickAdmin(caseKey: string): PoolSlot {
  const slot = hashSlot(`${caseKey}:admin`, ADMIN_POOL_SIZE);
  return {
    usernameVar: `pool_admin_${slot}`,
    passwordVar: `pool_adminpass_${slot}`,
    tokenVar: `token_a${slot}`,
    slot,
  };
}

/**
 * Per-worker pool slot: deterministic WORKER_ID → slot mapping so each
 * worker drains the queue with its own operator identity. A horizontally
 * scaled compose (`--scale test-engine-worker=N`) gets N distinct logins
 * as long as N ≤ POOL_SIZE; above the cap, workers wrap around and share.
 * Pick by `pool_user_<slot>` env var — same scheme as pickUser so the
 * setup credentials (seeded by scripts/seed-user-pool.mjs) are reused.
 */
export function pickUserForWorker(workerId: string): PoolSlot {
  const slot = hashSlot(workerId || 'worker-anonymous', POOL_SIZE);
  return {
    usernameVar: `pool_user_${slot}`,
    passwordVar: `pool_pass_${slot}`,
    tokenVar: `token_u${slot}`,
    slot,
  };
}

/** Per-worker admin slot — same shape, drawn from the smaller admin pool. */
export function pickAdminForWorker(workerId: string): PoolSlot {
  const slot = hashSlot(`${workerId || 'worker-anonymous'}:admin`, ADMIN_POOL_SIZE);
  return {
    usernameVar: `pool_admin_${slot}`,
    passwordVar: `pool_adminpass_${slot}`,
    tokenVar: `token_a${slot}`,
    slot,
  };
}

/** Login step for an operator picked from the pool by case key. */
export function userLoginStep(caseKey: string, apiVar = 'api') {
  const p = pickUser(caseKey);
  return {
    action: 'request',
    method: 'POST',
    url: `{{${apiVar}}}/api/v1/session/login`,
    body: { username: `{{${p.usernameVar}}}`, password: `{{${p.passwordVar}}}` },
    expected_status: 200,
    save: { [p.tokenVar]: 'token' },
    description: `operator login (pool slot ${p.slot})`,
  };
}

/** Login step for a tenant admin picked from the admin pool by case key. */
export function adminLoginStep(caseKey: string, apiVar = 'api') {
  const p = pickAdmin(caseKey);
  return {
    action: 'request',
    method: 'POST',
    url: `{{${apiVar}}}/api/v1/session/login`,
    body: { username: `{{${p.usernameVar}}}`, password: `{{${p.passwordVar}}}` },
    expected_status: 200,
    save: { [p.tokenVar]: 'token' },
    description: `tenant admin login (pool slot ${p.slot})`,
  };
}

export const userBearer = (caseKey: string) => ({
  authorization: `Bearer {{${pickUser(caseKey).tokenVar}}}`,
});

export const adminBearer = (caseKey: string) => ({
  authorization: `Bearer {{${pickAdmin(caseKey).tokenVar}}}`,
});

/**
 * Environment-config vars the pool depends on. Add these to a deployment's
 * `config.vars` (and the matching passwords to `config.secret_env`) so the
 * worker can resolve them at run time. Defaults fall back to the single
 * demo persona for backwards compatibility — real parallelism needs the N
 * users seeded Sand Bench side.
 */
export function poolDefaults(singleUserFallback: string, singleAdminFallback: string) {
  const vars: Record<string, string> = {};
  for (let i = 0; i < POOL_SIZE; i++) vars[`pool_user_${i}`] = singleUserFallback;
  for (let i = 0; i < ADMIN_POOL_SIZE; i++) vars[`pool_admin_${i}`] = singleAdminFallback;
  return vars;
}

export function poolSecretEnvDefaults(singleUserSecretEnvName: string, singleAdminSecretEnvName: string) {
  const env: Record<string, string> = {};
  for (let i = 0; i < POOL_SIZE; i++) env[`pool_pass_${i}`] = singleUserSecretEnvName;
  for (let i = 0; i < ADMIN_POOL_SIZE; i++) env[`pool_adminpass_${i}`] = singleAdminSecretEnvName;
  return env;
}

/**
 * Append-only audit-log endpoints that have no delete route by design. A case
 * whose main writes land here is atomic in the sense that nothing it does is
 * reversible — the server-side design is append-only. The seed-time
 * annotator (`annotateAppendOnlyCases`) marks these cases with
 * `atomicityNote: no-cleanup-endpoint` automatically, so authors don't need
 * to remember and the audit stops flagging them.
 */
const APPEND_ONLY_WRITE_PATHS = [
  '/hub/to-app',
  '/api/v1/inbound/events',
  '/api/v1/events/emit',
  '/api/v1/build-results',
  '/api/v1/analytics/coverage-drift/ingest',
  '/api/v1/analytics/dashboard-kpis/ingest',
  '/api/v1/analytics/duration-percentiles/ingest',
  '/api/v1/analytics/error-clusters/ingest',
  '/api/v1/analytics/export/ingest',
  '/api/v1/analytics/flaky-cases/ingest',
  '/api/v1/analytics/samples/ingest',
  '/api/v1/analytics/slowest-cases/ingest',
] as const;

/**
 * Writes to one of these well-known creation endpoints. For each POST whose
 * expected status is only 2xx and whose `save:` does not already capture the
 * created record's id, inject a per-step save and a matching cleanup step
 * so the resource is removed after the case runs — making the case atomic.
 *
 * `urlPattern` is matched against the path portion of the request URL
 * (everything after `{{base}}/`). `cleanupUrl` is a template; the saved var
 * name is injected as `{{<saveAs>_<ix>}}` and the resulting template is
 * matched by the HTTP runner at run time.
 */
const AUTO_CLEANUP_PATTERNS: Array<{
  method: string;
  urlRegex: RegExp;
  idPath: string;        // save path inside the response (e.g. 'id' or 'data.id')
  saveAsPrefix: string;  // var name prefix; a step counter is appended to keep multiple writes unique
  cleanupMethod: 'DELETE' | 'POST';
  cleanupUrl: (idVar: string) => string;
  cleanupExpected?: number[];
}> = [
  {
    method: 'POST',
    urlRegex: /\/api\/v1\/runs$/,
    idPath: 'id',
    saveAsPrefix: 'auto_run_id',
    cleanupMethod: 'DELETE',
    cleanupUrl: (v) => `{{api}}/api/v1/runs/{{${v}}}`,
    cleanupExpected: [200, 204, 404],
  },
  {
    method: 'POST',
    urlRegex: /\/api\/v1\/admin\/tenants\/[^/]+\/users$/,
    idPath: 'id',
    saveAsPrefix: 'auto_user_id',
    cleanupMethod: 'DELETE',
    cleanupUrl: (v) => `{{api}}/api/v1/admin/tenants/tenant_default/users/{{${v}}}`,
    cleanupExpected: [200, 204, 404],
  },
  {
    method: 'POST',
    urlRegex: /\/api\/v1\/definitions$/,
    idPath: 'id',
    saveAsPrefix: 'auto_def_id',
    cleanupMethod: 'DELETE',
    cleanupUrl: (v) => `{{api}}/api/v1/definitions/{{${v}}}`,
    cleanupExpected: [200, 204, 404],
  },
  {
    method: 'POST',
    urlRegex: /\/api\/v1\/workers\/register$/,
    idPath: 'id',
    saveAsPrefix: 'auto_worker_id',
    cleanupMethod: 'POST',
    cleanupUrl: (v) => `{{api}}/api/v1/workers/{{${v}}}/drain`,
    cleanupExpected: [200, 204, 404],
  },
  {
    method: 'POST',
    urlRegex: /\/api\/v1\/message-types$/,
    idPath: 'code',
    saveAsPrefix: 'auto_mt_code',
    cleanupMethod: 'DELETE',
    cleanupUrl: (v) => `{{api}}/api/v1/message-types/{{${v}}}`,
    cleanupExpected: [200, 204, 404],
  },
  {
    method: 'POST',
    urlRegex: /\/api\/v1\/catalog\/schemas\/drafts$/,
    idPath: 'data.id',
    saveAsPrefix: 'auto_draft_id',
    cleanupMethod: 'DELETE',
    cleanupUrl: (v) => `{{api}}/api/v1/drafts/{{${v}}}`,
    cleanupExpected: [200, 204, 404],
  },
];

/**
 * Scan each case's steps; for every POST that matches a known creation
 * endpoint and doesn't already capture the resulting id, inject a save and
 * append a DELETE (or /drain) to cleanupSteps. Fully idempotent — runs are
 * skipped where the case already has a save or where a prior annotation
 * marker is present.
 */
export function autoAttachCleanups<T extends { key: string; method: string; steps?: unknown[]; cleanupSteps?: unknown[]; atomicityNote?: unknown }>(cases: T[]): T[] {
  for (const c of cases) {
    if (c.method !== 'http') continue;
    if ((c as any).atomicityNote) continue; // the author owns cleanup for this case
    const steps = ((c.steps || []) as any[]).slice(); // local copy so step replacements don't affect other arrays
    (c as any).steps = steps;
    const bearer = steps.find((s) => s?.headers && typeof s.headers.authorization === 'string')?.headers;
    const existingCleanup = ((c as any).cleanupSteps || []) as any[];
    const newCleanups: any[] = [];
    for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
      const s = steps[stepIdx];
      if (!s || s.action !== 'request') continue;
      const method = String(s.method || 'GET').toUpperCase();
      const url = String(s.url || '');
      const path = url.replace(/^\{\{[^}]+\}\}/, '').split('?')[0];
      const expected = Array.isArray(s.expected_status) ? s.expected_status : [s.expected_status];
      const only2xx = expected.every((x: number) => x && x >= 200 && x < 300);
      if (!only2xx) continue;
      for (const pat of AUTO_CLEANUP_PATTERNS) {
        if (method !== pat.method || !pat.urlRegex.test(path)) continue;
        // Pick the var name that will hold the created id — reuse the
        // author's save if present (matching this pattern's idPath), else
        // inject one.
        let idVar: string | undefined;
        if (s.save && typeof s.save === 'object') {
          for (const [name, p] of Object.entries(s.save as Record<string, unknown>)) {
            if (typeof p === 'string' && (p === pat.idPath || p === pat.idPath.replace(/^data\./, '') || p === `data.${pat.idPath}`)) {
              idVar = name;
              break;
            }
          }
        }
        if (!idVar) {
          const injected = `${pat.saveAsPrefix}_${stepIdx + 1}`;
          const cloned = { ...s, save: { ...(s.save || {}), [injected]: pat.idPath } };
          steps[stepIdx] = cloned;
          idVar = injected;
        }
        // Skip if any cleanup step already removes this record.
        const alreadyCleaned = [...existingCleanup, ...newCleanups].some((d) => {
          if (!d || d.action !== 'request') return false;
          const dMethod = String(d.method || '').toUpperCase();
          const dUrl = String(d.url || '');
          return (dMethod === 'DELETE' || (dMethod === 'POST' && /\/(drain|cancel|archive|discard|withdraw)$/.test(dUrl))) && dUrl.includes(`{{${idVar}}}`);
        });
        if (alreadyCleaned) break;
        const base = (url.match(/^\{\{([^}]+)\}\}/)?.[1]) || 'api';
        const cleanupStep: Record<string, unknown> = {
          action: 'request',
          method: pat.cleanupMethod,
          url: pat.cleanupUrl(idVar).replace('{{api}}', `{{${base}}}`),
          expected_status: pat.cleanupExpected || [200, 204, 404],
          skip_if_missing: [idVar],
          description: `auto-cleanup for ${pat.method} ${path}`,
        };
        if (bearer) cleanupStep.headers = { authorization: bearer.authorization };
        if (pat.cleanupMethod === 'POST') cleanupStep.body = {};
        newCleanups.push(cleanupStep);
        break;
      }
    }
    if (newCleanups.length) {
      (c as any).cleanupSteps = [...((c as any).cleanupSteps || []), ...newCleanups];
    }
  }
  return cases;
}

export function annotateAppendOnlyCases<T extends { key: string; method: string; steps?: unknown[]; atomicityNote?: unknown }>(cases: T[]): T[] {
  for (const c of cases) {
    if (c.method !== 'http') continue;
    if ((c as any).atomicityNote) continue;
    const steps = (c.steps || []) as any[];
    const writesAppendOnly = steps.some((s) => {
      if (!s || s.action !== 'request') return false;
      const m = String(s.method || 'GET').toUpperCase();
      if (m === 'GET') return false;
      const url = String(s.url || '').replace(/^\{\{[^}]+\}\}/, '').split('?')[0];
      return APPEND_ONLY_WRITE_PATHS.some((p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`));
    });
    if (writesAppendOnly) {
      (c as any).atomicityNote = {
        reason: 'no-cleanup-endpoint',
        detail: 'Writes land in an append-only audit/event log (hub/to-app, inbound events, events/emit, build-results, analytics ingests). The server exposes no delete route for these rows by design; per-run unique identifiers keep each case\'s row isolated.',
      };
    }
  }
  return cases;
}

/**
 * Rebind a case's steps + cleanupSteps to its own pool slot. Catalog authors
 * keep writing the shared `API_LOGIN` / `ADMIN_LOGIN` constants with
 * `{{username}}` / `{{password}}` templates; this walks the case's step JSON
 * at seed time and renames those templates (and the saved token vars) to the
 * slot picked from `pickUser(caseKey)` / `pickAdmin(caseKey)`. Parallel runs
 * of different cases then hold distinct Sand Bench sessions.
 *
 * Namespace of renamed templates (prefix `{{…}}`):
 *   username        → pool_user_<op>
 *   password        → pool_pass_<op>
 *   admin_username  → pool_admin_<ad>
 *   admin_password  → pool_adminpass_<ad>
 *   token           → token_u<op>
 *   adminToken      → token_a<ad>
 *
 * Save targets (the keys inside a step's `save:` object) use the same
 * namespace so later references to `{{token}}` / `{{adminToken}}` resolve.
 */
export function bindCaseToPool<S>(caseKey: string, steps: S[] | undefined): S[] | undefined {
  if (!steps || !steps.length) return steps;
  const op = pickUser(caseKey);
  const ad = pickAdmin(caseKey);
  const templateRenames: Array<[RegExp, string]> = [
    [/\{\{\s*username\s*\}\}/g, `{{${op.usernameVar}}}`],
    [/\{\{\s*password\s*\}\}/g, `{{${op.passwordVar}}}`],
    [/\{\{\s*admin_username\s*\}\}/g, `{{${ad.usernameVar}}}`],
    [/\{\{\s*admin_password\s*\}\}/g, `{{${ad.passwordVar}}}`],
    [/\{\{\s*token\s*\}\}/g, `{{${op.tokenVar}}}`],
    [/\{\{\s*adminToken\s*\}\}/g, `{{${ad.tokenVar}}}`],
  ];
  const saveKeyRenames: Record<string, string> = {
    token: op.tokenVar,
    adminToken: ad.tokenVar,
  };
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      let s = node;
      for (const [re, to] of templateRenames) s = s.replace(re, to);
      return s;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      const obj = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'save' && v && typeof v === 'object' && !Array.isArray(v)) {
          const renamed: Record<string, unknown> = {};
          for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
            renamed[saveKeyRenames[sk] ?? sk] = sv;
          }
          out[k] = renamed;
        } else {
          out[k] = walk(v);
        }
      }
      return out;
    }
    return node;
  };
  return walk(steps) as S[];
}
