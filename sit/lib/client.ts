import { ENV } from "./env.ts";

// Every SIT request gets a bounded timeout so a down or unreachable target fails a case
// fast and cleanly instead of hanging on an OS-level TCP timeout — important since this
// engine is expected to run (and be watched live, via the SIT console) against a
// deployment that may genuinely be partway up or down.
const REQUEST_TIMEOUT_MS = 5000;

let cachedToken: Promise<string> | null = null;

async function login(): Promise<string> {
  const res = await fetch(`${ENV.apiBase}/api/v1/session/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenantSlug: ENV.tenantSlug, username: ENV.username, password: ENV.password }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`SIT login failed for ${ENV.username}@${ENV.tenantSlug}: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string };
  return body.token;
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
