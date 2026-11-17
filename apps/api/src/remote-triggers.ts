/**
 * Remote-execution triggers — generic webhook config for "a commit on the
 * remote repo kicks off a deploy-run-teardown on an environment".
 *
 * Source of truth is the file at REMOTE_TRIGGERS_FILE (default
 * config/remote-triggers.json at the repo root). It is read fresh on every
 * webhook call and every GET of the read-only API, so the operator can edit
 * it without restarting the engine. Secrets are referenced by env-var name
 * (secret_env), never stored in the file; the resolved value never leaves
 * this module.
 *
 * Routes that use it live in routes/webhook.ts.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../..');
const DEFAULT_FILE = path.join(REPO_ROOT, 'config/remote-triggers.json');

export interface RemoteTrigger {
  project_key: string;
  enabled: boolean;
  repo_url: string | null;
  local_mirror: string;
  remote_name: string;
  branch: string;
  application: string;
  environment: string;
  secret_env: string | null;
  signature_header: string;
  scope: Record<string, unknown>;
  reason: string | null;
  trigger_source: string;
}

export interface LoadedTriggers {
  file: string;
  exists: boolean;
  triggers: RemoteTrigger[];
  error?: string;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/i;

function normalize(raw: unknown, idx: number): RemoteTrigger | string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return `triggers[${idx}] is not an object`;
  const r = raw as Record<string, unknown>;
  const project_key = typeof r.project_key === 'string' ? r.project_key.trim() : '';
  if (!KEY_PATTERN.test(project_key)) return `triggers[${idx}].project_key must be [a-z0-9-], 1-64 chars`;
  const application = typeof r.application === 'string' ? r.application.trim() : '';
  const environment = typeof r.environment === 'string' ? r.environment.trim() : '';
  if (!application || !environment) return `triggers[${idx}] (${project_key}) needs application and environment`;
  const local_mirror = typeof r.local_mirror === 'string' ? r.local_mirror.trim() : '';
  if (!local_mirror) return `triggers[${idx}] (${project_key}) needs local_mirror`;
  return {
    project_key,
    enabled: r.enabled !== false,
    repo_url: typeof r.repo_url === 'string' ? r.repo_url.trim() : null,
    local_mirror,
    remote_name: typeof r.remote_name === 'string' && r.remote_name.trim() ? r.remote_name.trim() : 'origin',
    branch: typeof r.branch === 'string' && r.branch.trim() ? r.branch.trim() : 'main',
    application,
    environment,
    secret_env: typeof r.secret_env === 'string' && r.secret_env.trim() ? r.secret_env.trim() : null,
    signature_header: (typeof r.signature_header === 'string' && r.signature_header.trim()
      ? r.signature_header.trim()
      : 'x-hub-signature-256').toLowerCase(),
    scope: r.scope && typeof r.scope === 'object' && !Array.isArray(r.scope) ? (r.scope as Record<string, unknown>) : {},
    reason: typeof r.reason === 'string' ? r.reason : null,
    trigger_source: typeof r.trigger_source === 'string' && /^[\w-]{1,40}$/.test(r.trigger_source)
      ? r.trigger_source
      : 'remote-commit',
  };
}

export function remoteTriggersFile(): string {
  const override = process.env.REMOTE_TRIGGERS_FILE;
  return override && override.trim() ? path.resolve(override.trim()) : DEFAULT_FILE;
}

/** Fresh read every call: no cache, no restart needed when the file changes. */
export function loadRemoteTriggers(): LoadedTriggers {
  const file = remoteTriggersFile();
  if (!existsSync(file)) return { file, exists: false, triggers: [] };
  let parsed: any;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    return { file, exists: true, triggers: [], error: `remote-triggers.json: ${(err as Error).message}` };
  }
  const raw = Array.isArray(parsed?.triggers) ? parsed.triggers : [];
  const triggers: RemoteTrigger[] = [];
  const errors: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const n = normalize(raw[i], i);
    if (typeof n === 'string') errors.push(n);
    else triggers.push(n);
  }
  return { file, exists: true, triggers, ...(errors.length ? { error: errors.join('; ') } : {}) };
}

export function findTrigger(projectKey: string): RemoteTrigger | null {
  const key = String(projectKey || '').trim();
  if (!key) return null;
  const loaded = loadRemoteTriggers();
  return loaded.triggers.find((t) => t.project_key === key) ?? null;
}

/** Resolved secret value — undefined when the env var is unset. */
export function triggerSecret(t: RemoteTrigger): string | undefined {
  if (!t.secret_env) return undefined;
  const v = process.env[t.secret_env];
  return v && v.trim() ? v : undefined;
}

/** Public view: never includes the secret value, only the env-var name. */
export function sanitize(t: RemoteTrigger): Omit<RemoteTrigger, 'secret_env'> & { secret_env: string | null; secret_configured: boolean } {
  return { ...t, secret_configured: !!triggerSecret(t) };
}
