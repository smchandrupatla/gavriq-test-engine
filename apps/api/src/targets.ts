import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** A target manifest (targets/<key>/target.json). Credentials are env var names only. */
export interface TargetManifest {
  key: string;
  name: string;
  repo?: string;
  environments: { name: string; base_url: string; type?: string }[];
  services?: Record<string, string>;
  suites?: { dir?: string; taxonomy?: 'manifest' | 'filename-prefix'; catalog?: string };
  auth?: Record<string, string>;
  seed?: { enabled?: boolean };
}

const ENV_TYPES = new Set([
  'localhost', 'development', 'integration', 'qa', 'sit', 'uat', 'staging', 'pre_prod',
  'production', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'remote',
]);
const KEY_RE = /^[a-z][a-z0-9-]*$/;

/** Returns a list of problems; empty means valid. */
export function validateManifest(m: unknown): string[] {
  const errors: string[] = [];
  if (!m || typeof m !== 'object') return ['manifest is not an object'];
  const t = m as Record<string, unknown>;
  if (typeof t.key !== 'string' || !KEY_RE.test(t.key)) errors.push('key must match ^[a-z][a-z0-9-]*$');
  if (typeof t.name !== 'string' || !t.name) errors.push('name is required');
  if (!Array.isArray(t.environments) || t.environments.length === 0) {
    errors.push('environments needs at least one entry');
  } else {
    t.environments.forEach((e, i) => {
      const env = e as Record<string, unknown>;
      if (typeof env?.name !== 'string' || !KEY_RE.test(env.name)) errors.push(`environments[${i}].name must match ^[a-z][a-z0-9-]*$`);
      if (typeof env?.base_url !== 'string' || !/^https?:\/\//.test(env.base_url)) errors.push(`environments[${i}].base_url must be an http(s) URL`);
      if (env?.type !== undefined && !ENV_TYPES.has(String(env.type))) errors.push(`environments[${i}].type is not a known environment type`);
    });
  }
  return errors;
}

export function environmentType(env: { base_url: string; type?: string }): string {
  if (env.type) return env.type;
  try {
    const host = new URL(env.base_url).hostname;
    if (['localhost', '127.0.0.1', 'host.docker.internal'].includes(host)) return 'localhost';
  } catch { /* validated earlier */ }
  return 'remote';
}

export function readManifests(dir: string): TargetManifest[] {
  if (!existsSync(dir)) return [];
  const manifests: TargetManifest[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, 'target.json');
    if (!existsSync(file)) continue;
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as TargetManifest;
    const errors = validateManifest(parsed);
    if (errors.length) throw new Error(`${file}: ${errors.join('; ')}`);
    if (parsed.key !== entry.name) throw new Error(`${file}: key "${parsed.key}" must equal its directory name "${entry.name}"`);
    manifests.push(parsed);
  }
  return manifests;
}

type Query = (text: string, params?: unknown[]) => Promise<unknown>;

/** Idempotent: upserts the application and one environment per manifest environment. */
export async function registerTarget(m: TargetManifest, query: Query): Promise<void> {
  const metadata = { repo: m.repo ?? null, services: m.services ?? {}, suites: m.suites ?? {}, manifest: true };
  await query(
    `INSERT INTO applications (key, name, description, status, metadata)
     VALUES ($1, $2, $3, 'active', $4::jsonb)
     ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name,
       metadata = applications.metadata || EXCLUDED.metadata, updated_at = now()`,
    [m.key, m.name, `Registered from targets/${m.key}/target.json`, JSON.stringify(metadata)],
  );
  for (const env of m.environments) {
    await query(
      `INSERT INTO environments (key, name, env_type, base_url, config)
       VALUES ($1, $2, $3::environment_type, $4, $5::jsonb)
       ON CONFLICT (key) DO UPDATE SET base_url = EXCLUDED.base_url, env_type = EXCLUDED.env_type,
         config = EXCLUDED.config, updated_at = now()`,
      [`${m.key}-${env.name}`, `${m.name} / ${env.name}`, environmentType(env), env.base_url, JSON.stringify({ application_key: m.key })],
    );
  }
}

export async function registerTargets(query: Query, dir = process.env.TARGETS_DIR || 'targets'): Promise<string[]> {
  const manifests = readManifests(dir);
  for (const m of manifests) await registerTarget(m, query);
  return manifests.map((m) => m.key);
}
