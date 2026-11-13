/**
 * Sign-in rules every Sand Bench case follows, applied to the whole catalogue at
 * seed time so no author has to repeat them and no case can forget them.
 *
 * Why they exist — how the current application treats identities:
 *
 *   - Signing out ends EVERY session of that user, on every browser and device.
 *   - A user holds at most five sessions; a sixth sign-in ends the oldest one.
 *   - Five wrong passwords for one account inside fifteen minutes lock that
 *     account for fifteen minutes; fifty failed sign-ins from one client address
 *     block that address for fifteen minutes (HTTP 429). Self-registration is
 *     stricter: ten attempts an hour per address, successful or not.
 *   - Only the built-in administrator is administrator-equivalent: a role cannot
 *     make another user one.
 *
 * So two cases that run at the same time must never share an operator, a case
 * that fails a sign-in on purpose must not count against the address every other
 * case signs in from, and the one administrator account must not be signed in
 * (or out) once per case.
 *
 * What is done about it:
 *
 *   1. Operators — the engine hands every running execution its own identity
 *      ("identity lane", apps/api/src/routes/executions.ts claim): the worker
 *      resolves {{username}} / {{password}} to that lane's pool user. Cases keep
 *      writing {{username}}, {{password}} and {{token}}; nothing is renamed here.
 *   2. Administrator — every administrator sign-in step is marked
 *      `reuse_session`: the worker keeps ONE administrator session and hands it
 *      to each case after checking it is still alive (apps/worker/src/runners/
 *      http.ts). No case may sign the administrator out.
 *   3. Deliberate failures — a sign-in that is meant to be refused is sent from
 *      a made-up client address of its own (X-Forwarded-For, a documentation /
 *      benchmark range), the same way the application team's own penetration
 *      cases do it (sit/cases/86-pentest-authn.sit.ts). The refusal is counted
 *      against that address, never against the worker's.
 *   4. Restoring the account — a case that gives the lane operator a wrong
 *      password signs in correctly afterwards (a cleanup step). A correct
 *      sign-in clears the account's failure count, so the next case starts from
 *      the same state this one did.
 */
import type { CaseDef } from './types.js';

const LOGIN_PATH = /\/api\/v1\/session\/login(?:[?#]|$)/;
const SIGNUP_PATH = /\/api\/v1\/session\/signup(?:[?#]|$)/;
const TEMPLATE = /\{\{\s*[\w.-]+\s*\}\}/;

/**
 * A stable, made-up client address for one case, inside 198.18.0.0/15 — the range
 * reserved for benchmarking, which no real client can come from. Stable per case
 * so reruns are comparable; spread over ~130,000 addresses so two cases do not
 * share a failure count.
 */
export function syntheticClientAddress(caseKey: string): string {
  let h = 2166136261;
  for (let i = 0; i < caseKey.length; i++) {
    h ^= caseKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = h >>> 0;
  return `198.${18 + (n & 1)}.${(n >>> 8) & 255}.${1 + ((n >>> 16) % 254)}`;
}

function expectedStatuses(step: any): number[] {
  const e = step?.expected_status;
  return (Array.isArray(e) ? e : [e ?? 200]).map(Number);
}

function isLoginRequest(step: any): boolean {
  return !!step && step.action === 'request' && String(step.method || 'GET').toUpperCase() === 'POST' && LOGIN_PATH.test(String(step.url || step.path || ''));
}

function isSignupRequest(step: any): boolean {
  return !!step && step.action === 'request' && String(step.method || 'GET').toUpperCase() === 'POST' && SIGNUP_PATH.test(String(step.url || step.path || ''));
}

/** A sign-in the case expects to be refused (anything but a plain 200). */
function isDeliberateFailure(step: any): boolean {
  return isLoginRequest(step) && !expectedStatuses(step).every((s) => s === 200);
}

function hasHeader(headers: Record<string, unknown> | undefined, name: string): boolean {
  return !!headers && Object.keys(headers).some((k) => k.toLowerCase() === name);
}

function bodyUsername(step: any): string {
  const body = step?.body;
  if (body && typeof body === 'object' && typeof (body as any).username === 'string') return (body as any).username;
  const raw = typeof step?.body_json === 'string' ? step.body_json : typeof step?.body_raw === 'string' ? step.body_raw : '';
  const m = /"username"\s*:\s*"([^"]*)"/.exec(raw);
  return m ? m[1]! : '';
}

/** The step's own base ("{{api}}" or "{{web}}") so the session check goes the same way the sign-in did. */
function baseOf(url: string): string {
  return /^(\{\{\s*[\w.-]+\s*\}\}|https?:\/\/[^/]+)/.exec(url)?.[1] || '{{api}}';
}

const RESTORE_MARK = 'restore the sign-in failure count';

function restoreStep(base: string) {
  return {
    action: 'request',
    method: 'POST',
    url: `${base}/api/v1/session/login`,
    body: { username: '{{username}}', password: '{{password}}' },
    expected_status: 200,
    description: `${RESTORE_MARK}: the operator signs in correctly`,
    text: 'Sign in correctly as the same operator, so the wrong password used above no longer counts against the account',
    expected: 'The sign-in is accepted; the account is back to no failed attempts.',
  };
}

/** A browser step that types a fixed (not templated) value into a password box: a wrong password on purpose. */
function typesWrongPassword(step: any): boolean {
  return !!step && step.action === 'type' && /password/i.test(String(step.selector || '')) && !/reset|new|confirm|forced/i.test(String(step.selector || ''))
    && typeof step.value === 'string' && step.value.length > 0 && !TEMPLATE.test(step.value);
}

function typesLaneUsername(step: any): boolean {
  return !!step && step.action === 'type' && /username/i.test(String(step.selector || '')) && /\{\{\s*username\s*\}\}/.test(String(step.value || ''));
}

/**
 * Apply the sign-in rules to every case, in place. Idempotent: a second pass
 * finds every header, marker and cleanup step already there.
 */
export function applySandbenchIdentityRules<T extends CaseDef>(cases: T[]): T[] {
  for (const c of cases) {
    const address = syntheticClientAddress(c.key);
    const main = ((c.steps || []) as any[]).slice();
    const cleanup = ((c.cleanupSteps || []) as any[]).slice();
    let touched = false;
    let wrongPasswordForLaneOperator = false;
    let restoreBase = '{{api}}';

    const visit = (list: any[]) => {
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        // Self-registration counts EVERY attempt against the client address (ten an
        // hour, then an hour's block), whatever the answer — so it never goes out
        // from the worker's own address.
        if (isSignupRequest(s)) {
          if (!hasHeader(s.headers, 'x-forwarded-for')) {
            list[i] = { ...s, headers: { ...(s.headers || {}), 'x-forwarded-for': address } };
            touched = true;
          }
          continue;
        }
        if (!isLoginRequest(s)) continue;
        const url = String(s.url || '');
        if (isDeliberateFailure(s)) {
          if (!hasHeader(s.headers, 'x-forwarded-for')) {
            list[i] = { ...s, headers: { ...(s.headers || {}), 'x-forwarded-for': address } };
            touched = true;
          }
          if (/\{\{\s*username\s*\}\}/.test(bodyUsername(s))) {
            wrongPasswordForLaneOperator = true;
            restoreBase = baseOf(url);
          }
        } else if (/\{\{\s*admin_username\s*\}\}/.test(bodyUsername(s)) && !s.reuse_session) {
          list[i] = { ...s, reuse_session: { check_url: `${baseOf(url)}/api/v1/session/me`, token_path: 'token' } };
          touched = true;
        }
      }
    };
    visit(main);
    visit(cleanup);

    // Load cases that hammer the sign-in with bad credentials: same rule, on the runner options.
    const rules = (c.validationRules || {}) as Record<string, any>;
    if (c.method === 'performance' && LOGIN_PATH.test(String(rules.url || rules.path || ''))) {
      const expected = (Array.isArray(rules.expect_status) ? rules.expect_status : [rules.expect_status ?? 200]).map(Number);
      if (!expected.every((s: number) => s === 200) && !hasHeader(rules.headers, 'x-forwarded-for')) {
        c.validationRules = { ...rules, headers: { ...(rules.headers || {}), 'x-forwarded-for': address } };
      }
    }

    // Browser cases that type a wrong password: the browser sends every request from the made-up address.
    if ((c.method === 'playwright' || c.method === 'selenium') && main.some(typesWrongPassword)) {
      const current = (c.validationRules || {}) as Record<string, any>;
      if (!hasHeader(current.extra_http_headers, 'x-forwarded-for')) {
        c.validationRules = { ...current, extra_http_headers: { ...(current.extra_http_headers || {}), 'x-forwarded-for': address } };
      }
      if (main.some(typesLaneUsername)) {
        wrongPasswordForLaneOperator = true;
        restoreBase = '{{api}}';
      }
    }

    if (wrongPasswordForLaneOperator && !cleanup.some((s) => String(s?.description || '').startsWith(RESTORE_MARK))) {
      cleanup.push(restoreStep(restoreBase));
      touched = true;
    }

    if (touched) {
      c.steps = main;
      if (cleanup.length) c.cleanupSteps = cleanup;
    }
  }
  return cases;
}
