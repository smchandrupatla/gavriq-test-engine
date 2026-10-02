import { ENV } from "./env.ts";

// Every SIT request gets a bounded timeout so a down or unreachable target fails a case
// fast and cleanly instead of hanging on an OS-level TCP timeout — important since this
// engine is expected to run (and be watched live, via the SIT console) against a
// deployment that may genuinely be partway up or down.
const REQUEST_TIMEOUT_MS = 5000;

let cachedToken: Promise<string> | null = null;

async function loginAttempt(withPassword: boolean): Promise<Response> {
  const credentials: Record<string, string> = { tenantSlug: ENV.tenantSlug, username: ENV.username };
  if (withPassword && ENV.password) credentials.password = ENV.password;
  return fetch(`${ENV.apiBase}/api/v1/session/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(credentials),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function login(): Promise<string> {
  let res = await loginAttempt(true);
  if (res.status === 401 && ENV.password) {
    // Development builds sign the named demo user in without a password
    // ("password is optional in this build"), and their stored demo
    // credentials often diverge from the documented ones. A configured
    // password that the deployment rejects therefore falls back to one
    // passwordless attempt before failing — production-shaped builds that
    // require a password still fail here, correctly.
    res = await loginAttempt(false);
  }
  if (!res.ok) {
    throw new Error(`SIT login failed for ${ENV.username}@${ENV.tenantSlug}: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}

type LoginGateConfig = { loginScreenEnabled?: boolean; passwordRequired?: boolean };
let cachedGateConfig: Promise<LoginGateConfig> | null = null;

// The web host's sign-in page settings (config/login.json is the console's own source for
// them). Fetched once per run; a host that serves none behaves like the gate-off default.
export function loginGateConfig(): Promise<LoginGateConfig> {
  if (!cachedGateConfig) {
    cachedGateConfig = fetch(`${ENV.webBase}/config/login.json`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      .then((res) => (res.ok ? (res.json() as Promise<LoginGateConfig>) : {}))
      .catch(() => ({}));
  }
  return cachedGateConfig;
}

// What a browser case types into the gate's password box: nothing where the deployment
// declares the password optional (development/demo builds sign the named user in without a
// credential check, and a supplied password that does not match the stored one is still
// rejected), the configured password where one is required.
export async function gatePassword(): Promise<string> {
  return (await loginGateConfig()).passwordRequired ? ENV.password : "";
}

// Cached for the whole SIT run: every case shares one session, same as one operator
// working through a post-deployment checklist rather than re-authenticating per step.
export function authToken(): Promise<string> {
  if (!cachedToken) cachedToken = login();
  return cachedToken;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await authToken();
  return fetch(`${ENV.apiBase}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function apiJson<T = unknown>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const res = await apiFetch(path, init);
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

/** Run case teardown after any outcome and preserve both assertion and teardown failures. */
export async function withCaseCleanup<T>(action: () => Promise<T>, cleanup: () => Promise<void>): Promise<T> {
  let value: T | undefined;
  let actionError: unknown;
  try {
    value = await action();
  } catch (error) {
    actionError = error;
  }

  let cleanupError: unknown;
  try {
    await cleanup();
  } catch (error) {
    cleanupError = error;
  }

  if (actionError && cleanupError) {
    throw new AggregateError([actionError, cleanupError], 'Test action failed and its cleanup also failed');
  }
  if (actionError) throw actionError;
  if (cleanupError) throw cleanupError;
  return value as T;
}

/** Keep a test-owned completed run out of the shared baseline. */
export async function withTestRunCleanup<T>(runId: string, action: () => Promise<T>): Promise<T> {
  return withCaseCleanup(action, async () => {
    const deleted = await apiJson<{ error?: string }>(`/api/v1/runs/${encodeURIComponent(runId)}`, { method: 'DELETE' });
    if (deleted.status !== 200 && deleted.status !== 404) throw new Error(`DELETE test run ${runId} returned ${deleted.status}: ${JSON.stringify(deleted.body)}`);
  });
}

export async function testhubJson<T = unknown>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(`${ENV.testhubBase}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

export async function dbviewerJson<T = unknown>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${ENV.dbviewerBase}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

/**
 * The delivery status a run on this channel must report on the stack under test: acknowledged
 * when /ready lists the channel as configured, otherwise what the stack does with an
 * unconfigured channel (simulated on development, demo and test; failed elsewhere). IMP-PM021.
 */
export async function expectedDeliveryStatus(channel: string): Promise<"acknowledged" | "simulated" | "failed"> {
  const res = await fetch(`${ENV.apiBase}/ready`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body = (await res.json().catch(() => ({}))) as { delivery?: { configured?: string[]; unconfiguredDeliveries?: "simulated" | "failed" } };
  if (body.delivery?.configured?.includes(channel)) return "acknowledged";
  return body.delivery?.unconfiguredDeliveries || "simulated";
}

export function correlationId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

// Polls fn() until predicate(value) is true or the timeout elapses, returning whatever the
// last call produced either way — callers assert on the return value so a timeout fails with
// the actual last-seen state instead of a generic "timed out" message. A target that's
// briefly unreachable is retried like anything else; only once the deadline passes does a
// persistent connection failure surface (as a thrown error) instead of being swallowed.
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const intervalMs = opts.intervalMs ?? 250;
  const start = Date.now();
  for (;;) {
    try {
      const value = await fn();
      if (predicate(value) || Date.now() - start >= timeoutMs) return value;
    } catch (error) {
      if (Date.now() - start >= timeoutMs) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
