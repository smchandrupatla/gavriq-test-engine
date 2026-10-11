/**
 * Audit the HTTP catalog for the create→act→cleanup discipline.
 *
 * For each HTTP case, classifies which atomic invariants hold and which do
 * not. Produces docs/CASE-ATOMICITY-AUDIT.md as a punch-list grouped by
 * category — not a hard CI gate, since several hundred cases need review and
 * flipping a strict lint now would turn the catalog red. Use the output to
 * triage one category at a time.
 *
 * Run:  npx tsx scripts/audit-case-atomicity.mts
 */
import { writeFileSync } from 'node:fs';
import { SANDBENCH_CASES } from '../apps/api/src/catalog/sandbench-cases.ts';
import { ENGINE_CASES } from '../apps/api/src/catalog/engine-cases.ts';
import type { CaseDef } from '../apps/api/src/catalog/types.ts';
import { annotateAppendOnlyCases, autoAttachCleanups } from '../apps/api/src/catalog/user-pool.ts';

type Step = Record<string, any>;

const BASE_URL_VARS = new Set(['web', 'api', 'testhub', 'engine', 'dbviewer', 'kafkaPortal', 'mqPortal', 'ftpPortal', 'apiPortal']);
const PATHWISE_ACTION = /\/(stage|transitions|validate|rotate|execute|claim|cancel|finish|dummy|close|verify|accept|reject|resolve|archive|promote|publish|discard|withdraw|revoke|dispatch|replay|results|complete|retry|evidence|drain|describe)(\/|$)/i;
// A top-level write URL that targets a non-persisting projection endpoint
// (preview/parse/validate-markdown/export/etc.) — safe to accept 2xx without
// cleanup, since nothing is persisted. The suffix must be the LAST segment.
const NON_PERSISTING_LEAF = /\/(preview|randomize|randomise|dryrun|dry-run|simulate|dummy|invalidate|validate|validate-markdown|parse|connectivity-check|health|ping|clear-data|clear|export|logout|refresh|generate|build|describe)$/i;
const AUTH_URL = /\/session\/(login|refresh|logout|password-reset|security-question)|\/auth\//;
const ADMIN_SETTINGS = /\/(settings|external-systems|events\/framework|events\/headers|security\/encryption|security\/records|features|logging|eventing|use-cases|resilience)(\/|$|\?)/;

export interface Finding {
  key: string;
  method: string;
  category:
    | 'create-without-cleanup'
    | 'delete-without-create'
    | 'patch-put-without-create-or-echo'
    | 'reads-shared-record'
    | 'ui-mutates-no-cleanup'
    | 'reads-hardcoded-record'
    | 'ok';
  detail: string;
}

/** HTTP-only findings — the strict gate the CI test enforces. */
export function auditCases(cases: CaseDef[]): Finding[] {
  annotateAppendOnlyCases(cases as any);
  autoAttachCleanups(cases as any);
  const HTTP = cases.filter((c) => c.method === 'http');
  const findings: Finding[] = [];
  for (const c of HTTP) collectFindings(c as any, findings);
  return findings;
}

/** All-methods findings — HTTP plus UI runners. For the triage report. */
export function auditAllCases(cases: CaseDef[]): Finding[] {
  annotateAppendOnlyCases(cases as any);
  autoAttachCleanups(cases as any);
  const findings: Finding[] = [];
  for (const c of cases) {
    if (c.method === 'http') collectFindings(c as any, findings);
    else collectUiFindings(c as any, findings);
  }
  return findings;
}

const UI_WRITE_ACTIONS = new Set(['type', 'fill', 'select', 'sandbench_upload']);
const UI_SUBMIT_WORDS = /save|create|submit|register|delete|remove|archive|publish|enable|disable|stage|deprecate|retire|rename|update/i;

function collectUiFindings(c: CaseDef & { steps?: any[]; cleanupSteps?: any[] }, findings: Finding[]) {
  const reason = c.atomicityNote?.reason;
  if (reason === 'pending-cleanup' || reason === 'no-cleanup-endpoint') return;
  const steps = (c.steps || []) as Step[];
  const cleanup = (c.cleanupSteps || []) as Step[];

  // A UI case only MUTATES server state when it clicks/presses a save/submit
  // control — typing in a form field or picking a dropdown is reversible
  // client-side state until a submit fires. (Login submits are not mutations
  // in the data-persistence sense; they're session-establishment and are
  // handled by the user pool, not case-level cleanup. Session release in
  // parallel is a scheduler concern: pool size ≥ max parallel cases.)
  const mutators: string[] = [];
  for (const s of steps) {
    const act = String(s.action || '').toLowerCase();
    const sel = String(s.selector || '').toLowerCase();
    const target = String(s.value || sel || s.expected || '').toLowerCase();

    if (act === 'sandbench_upload') continue; // self-contained upload-then-remove in the runner

    if (act === 'click' || act === 'click_text') {
      if (UI_SUBMIT_WORDS.test(target) && !/sign.?in|log.?in|sign.?out|log.?out/.test(target)) {
        mutators.push(`${act}:${target.slice(0, 60)}`);
      }
    }
  }

  if (mutators.length && !cleanup.length) {
    findings.push({ key: c.key, method: c.method, category: 'ui-mutates-no-cleanup', detail: `UI write actions without cleanupSteps: ${mutators.slice(0, 3).join(' | ')}` });
  }
}

function collectFindings(c: CaseDef, findings: Finding[]) {

function urlTemplate(url: string) { return url.replace(/\{\{[^}]+\}\}/g, '{var}'); }

function creationUrl(url: string): boolean {
  if (AUTH_URL.test(url)) return false;
  if (PATHWISE_ACTION.test(url)) return false;
  // Preview/dryrun endpoints return a projection, not a persisted record.
  if (/\/(preview|dryrun|dry-run|simulate|try)(\/|$|\?)/i.test(url)) return false;
  // The parent collection path, e.g. /schedules, /rules, /test-cases — a POST
  // here creates a new resource.
  const m = url.match(/\/api\/v1\/([a-z0-9-]+(?:\/[a-z0-9-]+)?)(?:\?|$)/i);
  return !!m && !m[1].includes('/{') && !/\{\{/.test(url.split('/api/v1/')[1] || '');
}

function isSubResource(url: string): boolean {
  // /resource/{id}/subpath → the operation touches an already-created parent.
  return /\/api\/v1\/[a-z0-9-]+\/\{\{[^}]+\}\}\//i.test(url) || /\/api\/v1\/[a-z0-9-]+\/[a-z0-9-]+\//i.test(url);
}

  // Cases that acknowledge a known cleanup gap in a CaseDef.atomicityNote are
  // skipped — the triage queue is for unflagged leaks, not revisiting the ones
  // already catalogued.
  const reason = c.atomicityNote?.reason;
  if (reason === 'pending-cleanup' || reason === 'no-cleanup-endpoint' || reason === 'reads-baseline') return;
  const steps = (c.steps || []) as Step[];
  const cleanup = (c.cleanupSteps || []) as Step[];

  // Each creation POST groups the vars it saved; the creation counts as cleaned
  // up when ANY of its saved vars is referenced by a later DELETE/archive step.
  // (A POST that saves both `id` and `key` only needs one cleanup — flagging
  // `key` as leaked was a false positive.)
  const creations: Array<{ url: string; vars: string[] }> = [];
  const createdVars = new Set<string>();
  for (const s of steps) {
    if (s.action !== 'request') continue;
    const method = String(s.method || 'GET').toUpperCase();
    if (method !== 'POST') continue;
    if (!creationUrl(String(s.url || ''))) continue;
    const saved: string[] = [];
    for (const [name, path] of Object.entries(s.save || {})) {
      if (typeof path === 'string' && /(?:^|\.)(id|key|slug|name|storage_key)$/i.test(path)) {
        saved.push(name);
        createdVars.add(name);
      }
    }
    if (saved.length) creations.push({ url: String(s.url || ''), vars: saved });
  }

  // Vars saved by ANY step in this case — these are case-owned and references
  // to them do not count as reads/writes of shared state. Includes etag vars,
  // echo vars, and anything else the case captured along the way.
  const caseOwnedVars = new Set<string>(createdVars);
  for (const s of [...steps, ...cleanup]) {
    if (s.action !== 'request') continue;
    for (const name of Object.keys(s.save || {})) caseOwnedVars.add(name);
  }

  // 1) Creations that have no matching DELETE/archive — grouped per-POST so a
  //    POST saving both id and key counts as discharged by one DELETE.
  if (creations.length) {
    const dischargingSteps = [...steps, ...cleanup].filter((s) => {
      if (s.action !== 'request') return false;
      const m = String(s.method || '').toUpperCase();
      if (m === 'DELETE') return true;
      if (m === 'POST' && PATHWISE_ACTION.test(String(s.url || ''))) return true;
      // PUT/PATCH that soft-deletes (sets lifecycle=archived/retired/deleted,
      // or sends a transition like "archive"/"deprecate") also discharges a
      // creation — a lifecycle PUT is the canonical archive in this catalog.
      if (m === 'PUT' || m === 'PATCH') {
        const body = JSON.stringify(s.body ?? '');
        if (/"(lifecycle|status)"\s*:\s*"(archived|retired|deleted|deprecated)"/i.test(body)) return true;
        if (/"transition"\s*:\s*"(archive|deprecate|retire|withdraw|discard)"/i.test(body)) return true;
      }
      return false;
    });
    const dischargedVars = new Set<string>();
    for (const d of dischargingSteps) {
      const url = String(d.url || '');
      for (const r of [...url.matchAll(/\{\{([\w-]+)\}\}/g)].map((m) => m[1])) {
        if (createdVars.has(r)) dischargedVars.add(r);
      }
    }
    const leaked = creations.filter((cr) => !cr.vars.some((v) => dischargedVars.has(v))).map((cr) => cr.vars[0]);
    if (leaked.length) findings.push({ key: c.key, method: c.method, category: 'create-without-cleanup', detail: `created vars with no cleanup: ${leaked.join(', ')}` });
  }

  // 1b) Writes that expect ONLY 2xx (a success-required write) but save no
  //     id and have no cleanup. Non-persisting projections (preview/parse/
  //     validate/export/…), settings routes and *-action routes
  //     (/transitions, /publish, /cancel, …) are safe. Sub-resources whose
  //     URL carries a case-owned {{var}} are cascade-cleaned when the parent
  //     is removed — also safe.
  // Build the discharged-vars set once for the sub-resource short-circuit.
  const dischargingForSub = [...steps, ...cleanup].filter((x) => {
    if (x.action !== 'request') return false;
    const mm = String(x.method || '').toUpperCase();
    if (mm === 'DELETE') return true;
    if (mm === 'POST' && PATHWISE_ACTION.test(String(x.url || ''))) return true;
    if (mm === 'PUT' || mm === 'PATCH') {
      const body = JSON.stringify(x.body ?? '');
      if (/"(lifecycle|status)"\s*:\s*"(archived|retired|deleted|deprecated)"/i.test(body)) return true;
      if (/"transition"\s*:\s*"(archive|deprecate|retire|withdraw|discard)"/i.test(body)) return true;
    }
    return false;
  });
  const dischargedVarsSet = new Set<string>();
  for (const d of dischargingForSub) {
    for (const r of [...String(d.url || '').matchAll(/\{\{([\w-]+)\}\}/g)].map((m) => m[1])) dischargedVarsSet.add(r);
  }
  for (const s of steps) {
    if (s.action !== 'request') continue;
    const m = String(s.method || 'GET').toUpperCase();
    if (m !== 'POST' && m !== 'PUT' && m !== 'PATCH') continue;
    const url = String(s.url || '');
    const path = url.replace(/^\{\{[^}]+\}\}/, '').split('?')[0].replace(/\/$/, '');
    if (/\/session\/(login|refresh|logout|password-reset|security-question)/.test(path)) continue;
    if (ADMIN_SETTINGS.test(path)) continue;
    if (NON_PERSISTING_LEAF.test(path)) continue;
    if (PATHWISE_ACTION.test(path)) continue;
    const expected = Array.isArray(s.expected_status) ? s.expected_status : [s.expected_status];
    const only2xx = expected.every((x: number) => x && x >= 200 && x < 300);
    if (!only2xx) continue;
    const saves = s.save || {};
    const savesId = Object.values(saves).some((v: any) => typeof v === 'string' && /(?:^|\.)(id|key|slug|name|storage_key)$/i.test(v));
    if (savesId) continue; // covered by create-without-cleanup detection
    // Sub-resource of a case-owned, cleaned-up parent: cascade cleanup handles it.
    const parentVars = [...url.matchAll(/\{\{([\w-]+)\}\}/g)].map((mm) => mm[1]).filter((r) => !BASE_URL_VARS.has(r));
    if (parentVars.length && parentVars.every((r) => caseOwnedVars.has(r) && dischargedVarsSet.has(r))) continue;
    if (cleanup.length) continue;
    findings.push({ key: c.key, method: c.method, category: 'create-without-cleanup', detail: `${m} ${path} expects only 2xx (write succeeds) but saves no id and has no cleanup — the created resource is unreachable for teardown` });
  }

  // 2) DELETE in main steps without a matching POST create in the same case.
  for (const s of steps) {
    if (s.action !== 'request') continue;
    const method = String(s.method || 'GET').toUpperCase();
    if (method !== 'DELETE') continue;
    const url = String(s.url || '');
    // Negative/method-misuse tests deliberately DELETE something that doesn't
    // exist (or a non-DELETE endpoint) to assert the API refuses. They're not
    // leaks: filter them by expected status.
    const expected = Array.isArray(s.expected_status) ? s.expected_status : [s.expected_status];
    if (expected.every((x: number) => x && x >= 400)) continue;
    // DELETE on a non-id path like /health or /audit (the collection itself,
    // not a specific record) is also a method-misuse test.
    if (!/\/[a-f0-9-]{8,}\/?$|\/\{\{[^}]+\}\}\/?$/i.test(url)) continue;
    const refs = [...url.matchAll(/\{\{([\w-]+)\}\}/g)].map((m) => m[1]).filter((r) => !BASE_URL_VARS.has(r));
    const uncreated = refs.filter((r) => !caseOwnedVars.has(r));
    if (ADMIN_SETTINGS.test(url)) continue;
    if (uncreated.length) {
      findings.push({ key: c.key, method: c.method, category: 'delete-without-create', detail: `${method} ${urlTemplate(url)} references ${uncreated.join(',')} with no prior create` });
    } else if (refs.length === 0 && /\/[a-f0-9-]{8,}\/?$/i.test(url)) {
      // A literal probe id (UUID or similar) at the end of the path — not
      // referenced via {{var}}, not negative-only. The surface-coverage sweep
      // relies on expected_status being 4xx-only; a mixed 2xx/4xx expectation
      // on a probe id is an atomicity hole.
      findings.push({ key: c.key, method: c.method, category: 'delete-without-create', detail: `${method} ${urlTemplate(url)} targets a literal probe id while permitting 2xx — tighten expected_status to 4xx-only or create+delete a real record` });
    }
  }

  // 3) PATCH/PUT in main steps on specific resources: either create or echo.
  for (const s of steps) {
    if (s.action !== 'request') continue;
    const method = String(s.method || 'GET').toUpperCase();
    if (method !== 'PATCH' && method !== 'PUT') continue;
    const url = String(s.url || '');
    if (ADMIN_SETTINGS.test(url)) continue;  // settings writes are usually idempotent-echo
    // Negative test (expects 4xx/5xx): the write is not meant to succeed, so
    // nothing to clean up.
    const expected = Array.isArray(s.expected_status) ? s.expected_status : [s.expected_status];
    if (expected.every((x: number) => x && x >= 400)) continue;
    const refs = [...url.matchAll(/\{\{([\w-]+)\}\}/g)].map((m) => m[1]).filter((r) => !BASE_URL_VARS.has(r));
    const uncreated = refs.filter((r) => !caseOwnedVars.has(r));
    if (uncreated.length) {
      findings.push({ key: c.key, method: c.method, category: 'patch-put-without-create-or-echo', detail: `${method} ${urlTemplate(url)} references ${uncreated.join(',')} with no prior create` });
    } else if (refs.length === 0 && /\/[a-f0-9-]{8,}\/?$/i.test(url)) {
      findings.push({ key: c.key, method: c.method, category: 'patch-put-without-create-or-echo', detail: `${method} ${urlTemplate(url)} targets a literal probe id while permitting 2xx — tighten expected_status to 4xx-only or create+modify a real record` });
    }
  }

  // 3b) ANY step whose URL carries a hardcoded record identifier (UUID, slug
  //     starting with a known resource prefix like `tc_`, `rule_`, `exec_`,
  //     etc., or an uppercase keyed id like `TE-API-META`) that is NOT a
  //     baseline fixture or documented 404 probe. The atomic contract: a
  //     case must not expect a specific record to pre-exist.
  for (const s of steps) {
    if (s.action !== 'request') continue;
    const url = String(s.url || '');
    const path = url.replace(/^\{\{[^}]+\}\}/, '').split('?')[0];
    // 404-probe and zero-UUID: already handled.
    if (/\/00000000-0000-/.test(path)) continue;
    if (/\/(does-not-exist|not-a-uuid|no-such-|run_does_not_exist_)/i.test(path)) continue;
    // Baseline carve-outs: engine fixture cases, Sand Bench tenant default,
    // smoke/retired fixtures, demo tenant users (seeded identities).
    const BASELINE = /^(TE-FIX-|TE-SMOKE-|TE-RETIRED-|TE-ARCHIVE-|TE-NO-SUCH|tenant_default|tenant_demo_|user_demo_|dap_|fap_|dc_|dp_)/i;
    const segments = path.split('/').filter(Boolean);
    for (const seg of segments) {
      if (BASELINE.test(seg)) continue;
      // Flag only shapes that are clearly a specific record identifier:
      // - UUID
      // - resource-prefix slug (rule_, exec_, run_, draft_, ds_)
      // - uppercase keyed id with hyphens (e.g. TE-API-META)
      if (/^[a-f0-9]{8}-[a-f0-9]{4}-/i.test(seg)
          || /^(rule_|exec_|run_|draft_|ds_)/i.test(seg)
          || /^TE-[A-Z]{2,}-[A-Z0-9-]+$/.test(seg)) {
        findings.push({ key: c.key, method: c.method, category: 'reads-hardcoded-record', detail: `${String(s.method||'GET').toUpperCase()} ${path} references a specific record (${seg}) that this case did not create` });
        break;
      }
    }
  }

  // 4) GET of a specific pre-existing record (an id that is not from a prior POST and not a known fixture).
  for (const s of steps) {
    if (s.action !== 'request') continue;
    const method = String(s.method || 'GET').toUpperCase();
    if (method !== 'GET') continue;
    const url = String(s.url || '');
    if (ADMIN_SETTINGS.test(url)) continue;
    const refs = [...url.matchAll(/\{\{([\w-]+)\}\}/g)].map((m) => m[1]);
    const external = refs.filter(
      (r) => !caseOwnedVars.has(r)
        && !['web', 'api', 'testhub', 'engine', 'dbviewer', 'tenant', 'username', 'password', 'admin_username', 'admin_password', 'ts', 'rand', 'tenantId'].includes(r)
        && !r.startsWith('pool_')
        && !r.startsWith('token_')
        && !r.startsWith('fix_')      // engine fixture vars (seeded sandbox: TE-FIX-*)
    );
    if (external.length && /\/\{\{/.test(url)) {
      findings.push({ key: c.key, method: c.method, category: 'reads-shared-record', detail: `GET ${urlTemplate(url)} reads a record identified by ${external.join(',')} (not created in this case)` });
    }
  }
}

// --- CLI entry point ------------------------------------------------------

const ALL: CaseDef[] = [...(SANDBENCH_CASES as any), ...(ENGINE_CASES as any)];
const findings = auditAllCases(ALL);
const HTTP = ALL.filter((c) => c.method === 'http');

const byCategory = new Map<string, Finding[]>();
for (const f of findings) {
  if (!byCategory.has(f.category)) byCategory.set(f.category, []);
  byCategory.get(f.category)!.push(f);
}

const totalCases = ALL.length;
const casesWithFindings = new Set(findings.map((f) => f.key)).size;
const httpFindings = findings.filter((f) => f.method === 'http').length;
const uiFindings = findings.length - httpFindings;

const header = `# Atomic case audit — create→act→cleanup discipline

Generated by \`scripts/audit-case-atomicity.mts\`. The atomic contract is in
\`.github/skills/test-case-lifecycle/SKILL.md\`: every case must create its own
data, exercise it, and remove it so the environment ends in the state it
started. **${totalCases}** test cases audited (${HTTP.length} HTTP, ${totalCases - HTTP.length} UI/other);
**${casesWithFindings}** have one or more findings; **${findings.length}** findings in total
(**${httpFindings}** HTTP, **${uiFindings}** UI/other).

The HTTP audit is a hard CI gate (\`tests/engine-catalog.test.ts\` fails on any
HTTP finding). The UI audit is a soft punch-list — flipping it to a hard gate
now would red the catalog, but every new UI case must match the contract.

Categories:
- **create-without-cleanup** — a POST creates a resource but no DELETE/archive
  cleans it up.
- **delete-without-create** — a DELETE in main steps targets a resource this
  case did not create.
- **patch-put-without-create-or-echo** — a mutating write on a specific record
  where no prior POST created it (and the URL isn't an idempotent settings
  endpoint).
- **reads-shared-record** — a GET of a specific record identified by a var
  that was never set by this case (so a different case or run can be reading
  the same row concurrently).
- **ui-mutates-no-cleanup** — a Playwright/Selenium case clicks a
  save/create/delete control without a cleanupSteps entry.

A case that genuinely cannot clean up declares \`CaseDef.atomicityNote\` with
reason \`pending-cleanup\` or \`no-cleanup-endpoint\`.

**Session release under parallel runs** is handled by pool sizing, not by a
per-case logout: pool size (\`POOL_SIZE\` / \`ADMIN_POOL_SIZE\` in
\`apps/api/src/catalog/user-pool.ts\`) must be ≥ the maximum intended parallel
fan-out so each slot has at most one case in flight at a time. A UI case does
not need to sign out in its own steps.
`;

const sections = [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length).map(([cat, list]) => {
  const lines = list.sort((a, b) => a.key.localeCompare(b.key)).map((f) => `- \`${f.key}\` — ${f.detail}`);
  return `## ${cat} (${list.length})\n\n${lines.join('\n')}\n`;
});

const body = `${header}\n${sections.join('\n')}`;
writeFileSync('docs/CASE-ATOMICITY-AUDIT.md', body);
console.log(`[audit] wrote docs/CASE-ATOMICITY-AUDIT.md: ${findings.length} findings across ${casesWithFindings}/${totalCases} HTTP cases`);
for (const [cat, list] of byCategory) console.log(`  - ${cat}: ${list.length}`);
