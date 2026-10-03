/**
 * Infrastructure lifecycle — an environment the engine deploys itself runs
 * only while it is being tested.
 *
 * An environment is *managed* when its config carries
 *   config.infra = { driver: "compose", script: "deploy/<name>/deploy.mjs", ... }
 * i.e. one of the local Docker stacks that deploy/staging and
 * deploy/engine-staging build. For a managed environment the engine
 *   - deploys on request (console, POST /api/v1/deployments), runs, and tears
 *     the stack down once that run has finished, whatever the verdict
 *     (deployments.teardown_after_run);
 *   - deploys first when a run is asked for while the stack is down
 *     (deployFirstIfDown: "Run everything", schedules, POST /api/v1/runs);
 *   - tears down a stack nothing has used for idle_teardown_hours, or one that
 *     has been up for max_uptime_hours — never while a run is active on it;
 *   - every prune_every_hours queues Docker housekeeping: stopped containers and
 *     unused images of the managed compose projects, dangling images, and build
 *     cache older than prune_build_cache_hours.
 *
 * The engine only decides. The work is done by the infra agent
 * (apps/infra-agent) on the Docker host, which claims `infra_jobs` over the
 * API, runs the environment's deploy script or `docker`, and reports back.
 * Nothing outside the managed compose projects is ever stopped or removed: the
 * development stacks on the same machine are not managed.
 */
import { query } from './db/client.js';

// ---------------------------------------------------------------------------
// Policy (settings.infra_policy, keys absent there take these defaults)
// ---------------------------------------------------------------------------
export interface InfraPolicy {
  /** Tear down a managed environment nothing has run on for this long (0 = never). */
  idle_teardown_hours: number;
  /** Tear down a managed environment that has been up this long (0 = never). */
  max_uptime_hours: number;
  /** Queue Docker housekeeping this often (0 = never). */
  prune_every_hours: number;
  /** Housekeeping removes build cache unused for this long (0 = keep the build cache). */
  prune_build_cache_hours: number;
  /** Teardown also removes the images the stack was built from. */
  remove_images_on_teardown: boolean;
  /** Teardown also removes the stack's volumes (its database starts empty next time). */
  remove_volumes_on_teardown: boolean;
  /** "Deploy and run" tears the stack down after the run unless the caller says otherwise. */
  teardown_after_run_default: boolean;
  /** A run asked for on a stack that is down deploys it first instead of failing. */
  auto_deploy_when_down: boolean;
  /** A job running longer than this is failed and its environment released. */
  job_timeout_minutes: number;
}

export const DEFAULT_INFRA_POLICY: InfraPolicy = {
  idle_teardown_hours: 12,
  max_uptime_hours: 48,
  prune_every_hours: 6,
  prune_build_cache_hours: 48,
  remove_images_on_teardown: true,
  remove_volumes_on_teardown: false,
  teardown_after_run_default: true,
  auto_deploy_when_down: true,
  job_timeout_minutes: 45,
};

const NUMERIC_RANGES: Record<string, [number, number]> = {
  idle_teardown_hours: [0, 24 * 30],
  max_uptime_hours: [0, 24 * 30],
  prune_every_hours: [0, 24 * 30],
  prune_build_cache_hours: [0, 24 * 365],
  job_timeout_minutes: [5, 24 * 60],
};
const BOOLEAN_KEYS = new Set([
  'remove_images_on_teardown', 'remove_volumes_on_teardown', 'teardown_after_run_default', 'auto_deploy_when_down',
]);

export class PolicyError extends Error {}

/**
 * Merge a stored or submitted policy onto the defaults. `strict` rejects
 * unknown keys and out-of-range values (what PUT needs); otherwise a bad value
 * silently falls back to the default so a damaged row never stops the tick.
 */
export function normalizePolicy(raw: unknown, opts: { strict?: boolean } = {}): InfraPolicy {
  const out: InfraPolicy = { ...DEFAULT_INFRA_POLICY };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    if (opts.strict && raw !== undefined) throw new PolicyError('policy must be an object');
    return out;
  }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key in NUMERIC_RANGES) {
      const [min, max] = NUMERIC_RANGES[key]!;
      const n = Number(value);
      if (!Number.isFinite(n) || n < min || n > max) {
        if (opts.strict) throw new PolicyError(`${key} must be a number between ${min} and ${max}`);
        continue;
      }
      (out as unknown as Record<string, number>)[key] = n;
    } else if (BOOLEAN_KEYS.has(key)) {
      if (typeof value !== 'boolean') {
        if (opts.strict) throw new PolicyError(`${key} must be true or false`);
        continue;
      }
      (out as unknown as Record<string, boolean>)[key] = value;
    } else if (opts.strict) {
      throw new PolicyError(`Unknown policy key "${key}"`);
    }
  }
  return out;
}

export async function infraPolicy(): Promise<InfraPolicy> {
  const { rows } = await query('SELECT infra_policy FROM settings WHERE id = true');
  return normalizePolicy(rows[0]?.infra_policy);
}

export async function savePolicy(patch: unknown, updatedBy: string | null): Promise<InfraPolicy> {
  const current = await infraPolicy();
  const next = normalizePolicy({ ...current, ...(patch && typeof patch === 'object' ? (patch as object) : {}) }, { strict: true });
  await query(
    `UPDATE settings SET infra_policy = $1::jsonb, updated_at = now(), updated_by = COALESCE($2, updated_by) WHERE id = true`,
    [JSON.stringify(next), updatedBy]
  );
  return next;
}

// ---------------------------------------------------------------------------
// Managed environments: config.infra and config.deployment.state
// ---------------------------------------------------------------------------
export interface InfraConfig {
  driver: 'compose';
  /** Relative to the engine repository on the agent's host: deploy/<name>/deploy.mjs. */
  script: string;
  compose_project: string | null;
  /** Image repositories housekeeping may remove when no container uses them; defaults to the compose project name. */
  image_prefixes: string[];
  default_ref: string | null;
  idle_teardown_hours: number | null;
  max_uptime_hours: number | null;
}

/** Only scripts of this shape are ever handed to the agent, so a config edit cannot run arbitrary commands. */
export const SCRIPT_PATTERN = /^deploy\/[\w.-]+\/deploy\.mjs$/;

type EnvLike = { config?: Record<string, any> | null };

export function infraConfig(env: EnvLike | null | undefined): InfraConfig | null {
  const raw = env?.config?.infra;
  if (!raw || typeof raw !== 'object' || raw.driver !== 'compose') return null;
  if (typeof raw.script !== 'string' || !SCRIPT_PATTERN.test(raw.script)) return null;
  const project = typeof raw.compose_project === 'string' && raw.compose_project
    ? raw.compose_project
    : typeof env?.config?.deployment?.compose_project === 'string' ? env.config.deployment.compose_project : null;
  const hours = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  const prefixes = Array.isArray(raw.image_prefixes) ? raw.image_prefixes.map(String).filter(Boolean) : project ? [project] : [];
  return {
    driver: 'compose',
    script: raw.script,
    compose_project: project,
    image_prefixes: prefixes,
    default_ref: typeof raw.default_ref === 'string' && raw.default_ref.trim() ? raw.default_ref.trim() : null,
    idle_teardown_hours: hours(raw.idle_teardown_hours),
    max_uptime_hours: hours(raw.max_uptime_hours),
  };
}

export type EnvState = 'up' | 'down' | 'deploying' | 'tearing_down' | 'failed' | 'unknown';
const STATES = new Set<EnvState>(['up', 'down', 'deploying', 'tearing_down', 'failed', 'unknown']);

/** What the engine believes about the stack. A registered deployment without a state is up — that is how deploy.mjs left it. */
export function environmentState(env: EnvLike | null | undefined): EnvState {
  const dep = env?.config?.deployment;
  const s = dep?.state;
  if (typeof s === 'string' && STATES.has(s as EnvState)) return s as EnvState;
  return dep?.deployed_at ? 'up' : 'unknown';
}

/** Merge fields into config.deployment (state, torn_down_at, …) without touching the rest of the config. */
export async function setEnvironmentState(environmentId: string, state: EnvState, extra: Record<string, unknown> = {}) {
  await query(
    `UPDATE environments
     SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{deployment}',
                            COALESCE(config->'deployment', '{}'::jsonb) || $2::jsonb),
         updated_at = now()
     WHERE id = $1`,
    [environmentId, JSON.stringify({ state, state_changed_at: new Date().toISOString(), ...extra })]
  );
}

// ---------------------------------------------------------------------------
// Decisions (pure, so they can be tested without a database)
// ---------------------------------------------------------------------------
export interface EnvActivity {
  id: string;
  key: string;
  state: EnvState;
  deployed_at: string | null;
  /** Newest execution created or finished on this environment. */
  last_run_at: string | null;
  active_runs: number;
  /** A queued or running job already exists for it. */
  pending_job: boolean;
  /** Its last job failed less than 30 minutes ago — give the host a moment before trying again. */
  recent_failure: boolean;
  idle_teardown_hours?: number | null;
  max_uptime_hours?: number | null;
}

export type TeardownReason = 'idle' | 'max_uptime';

export interface NextTeardown {
  reason: TeardownReason;
  at: Date;
  detail: string;
}

const HOUR = 3_600_000;

/**
 * When this stack is due to be torn down automatically, and why — the earliest
 * of "idle for N hours since the last run or deploy" and "up for N hours since
 * the deploy". Null when neither rule applies (stack is down, mid-transition,
 * or the rules are off / have nothing to measure from).
 */
export function nextTeardown(env: EnvActivity, policy: InfraPolicy): NextTeardown | null {
  if (env.state === 'down' || env.state === 'deploying' || env.state === 'tearing_down') return null;
  const deployedAt = env.deployed_at ? new Date(env.deployed_at).getTime() : NaN;
  const lastRunAt = env.last_run_at ? new Date(env.last_run_at).getTime() : NaN;
  const candidates: NextTeardown[] = [];

  const idleHours = env.idle_teardown_hours ?? policy.idle_teardown_hours;
  const base = Math.max(Number.isFinite(deployedAt) ? deployedAt : -Infinity, Number.isFinite(lastRunAt) ? lastRunAt : -Infinity);
  if (idleHours > 0 && Number.isFinite(base)) {
    candidates.push({ reason: 'idle', at: new Date(base + idleHours * HOUR), detail: `no run for ${idleHours}h` });
  }
  const maxHours = env.max_uptime_hours ?? policy.max_uptime_hours;
  if (maxHours > 0 && Number.isFinite(deployedAt)) {
    candidates.push({ reason: 'max_uptime', at: new Date(deployedAt + maxHours * HOUR), detail: `up for ${maxHours}h` });
  }
  candidates.sort((a, b) => a.at.getTime() - b.at.getTime());
  return candidates[0] ?? null;
}

export interface TeardownDecision {
  environment_id: string;
  key: string;
  reason: TeardownReason;
  detail: string;
}

/** Which managed stacks to tear down now. A stack with a run in progress, a job already pending, or a fresh failure waits. */
export function decideTeardowns(envs: EnvActivity[], policy: InfraPolicy, now: Date): TeardownDecision[] {
  const out: TeardownDecision[] = [];
  for (const env of envs) {
    if (env.active_runs > 0 || env.pending_job || env.recent_failure) continue;
    const next = nextTeardown(env, policy);
    if (next && next.at.getTime() <= now.getTime()) {
      out.push({ environment_id: env.id, key: env.key, reason: next.reason, detail: next.detail });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Database views used by the tick and the console
// ---------------------------------------------------------------------------
export interface ManagedEnvironmentRow extends EnvActivity {
  name: string;
  config: Record<string, any>;
  infra: InfraConfig;
}

export async function managedEnvironments(): Promise<ManagedEnvironmentRow[]> {
  const { rows } = await query(
    `SELECT e.id, e.key, e.name, e.config,
            (SELECT max(GREATEST(x.created_at, x.finished_at)) FROM executions x WHERE x.environment_id = e.id) AS last_run_at,
            (SELECT count(*)::int FROM executions x
              WHERE x.environment_id = e.id AND x.status IN ('queued','preparing','running')) AS active_runs,
            EXISTS (SELECT 1 FROM infra_jobs j WHERE j.environment_id = e.id AND j.status IN ('queued','running')) AS pending_job,
            EXISTS (SELECT 1 FROM infra_jobs j WHERE j.environment_id = e.id AND j.status = 'failed'
                      AND j.finished_at > now() - interval '30 minutes') AS recent_failure
     FROM environments e
     WHERE e.status = 'active' AND e.config->'infra'->>'driver' = 'compose'
     ORDER BY e.name`
  );
  const out: ManagedEnvironmentRow[] = [];
  for (const r of rows) {
    const infra = infraConfig(r);
    if (!infra) continue;
    const dep = r.config?.deployment || {};
    out.push({
      id: r.id,
      key: r.key,
      name: r.name,
      config: r.config || {},
      infra,
      state: environmentState(r),
      deployed_at: typeof dep.deployed_at === 'string' ? dep.deployed_at : null,
      last_run_at: r.last_run_at ? new Date(r.last_run_at).toISOString() : null,
      active_runs: r.active_runs ?? 0,
      pending_job: !!r.pending_job,
      recent_failure: !!r.recent_failure,
      idle_teardown_hours: infra.idle_teardown_hours,
      max_uptime_hours: infra.max_uptime_hours,
    });
  }
  return out;
}

export const AGENT_FRESH_SECONDS = 90;

export async function agentOnline(): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM infra_agents WHERE last_heartbeat > now() - ($1::int * interval '1 second') LIMIT 1`,
    [AGENT_FRESH_SECONDS]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
export type JobKind = 'deploy' | 'teardown' | 'prune';

export interface QueueJobInput {
  kind: JobKind;
  environment_id?: string | null;
  deployment_id?: string | null;
  reason: string;
  params?: Record<string, unknown>;
  requested_by?: string | null;
}

/** One pending job of a kind per environment (one pending prune overall): a second request returns the existing job. */
export async function queueInfraJob(input: QueueJobInput): Promise<{ job: any; created: boolean }> {
  const existing = input.environment_id
    ? await query(
        `SELECT * FROM infra_jobs WHERE kind = $1 AND environment_id = $2 AND status IN ('queued','running') ORDER BY created_at LIMIT 1`,
        [input.kind, input.environment_id]
      )
    : await query(`SELECT * FROM infra_jobs WHERE kind = $1 AND environment_id IS NULL AND status IN ('queued','running') ORDER BY created_at LIMIT 1`, [input.kind]);
  if (existing.rows[0]) return { job: existing.rows[0], created: false };

  const { rows } = await query(
    `INSERT INTO infra_jobs (kind, environment_id, deployment_id, reason, params, requested_by)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING *`,
    [input.kind, input.environment_id ?? null, input.deployment_id ?? null, input.reason, JSON.stringify(input.params || {}), input.requested_by ?? null]
  );
  return { job: rows[0], created: true };
}

function teardownParams(env: { infra: InfraConfig; state: EnvState }, policy: InfraPolicy) {
  return {
    script: env.infra.script,
    compose_project: env.infra.compose_project,
    remove_images: policy.remove_images_on_teardown,
    remove_volumes: policy.remove_volumes_on_teardown,
    previous_state: env.state,
  };
}

/** Queue a teardown and mark the stack as on its way down. Returns the job, or null when one is already pending. */
export async function queueTeardown(
  env: { id: string; key: string; infra: InfraConfig; state: EnvState },
  reason: string,
  opts: { requested_by?: string | null; policy?: InfraPolicy; deployment_id?: string | null } = {}
) {
  const policy = opts.policy || (await infraPolicy());
  const { job, created } = await queueInfraJob({
    kind: 'teardown',
    environment_id: env.id,
    deployment_id: opts.deployment_id ?? null,
    reason,
    params: teardownParams(env, policy),
    requested_by: opts.requested_by ?? null,
  });
  if (created) await setEnvironmentState(env.id, 'tearing_down');
  return created ? job : null;
}

/** Queue Docker housekeeping scoped to the managed compose projects. */
export async function queuePrune(reason: string, opts: { requested_by?: string | null; dry_run?: boolean; policy?: InfraPolicy } = {}) {
  const policy = opts.policy || (await infraPolicy());
  const envs = await managedEnvironments();
  const projects = [...new Set(envs.map((e) => e.infra.compose_project).filter((p): p is string => !!p))];
  const prefixes = [...new Set(envs.flatMap((e) => e.infra.image_prefixes))];
  return queueInfraJob({
    kind: 'prune',
    reason,
    params: {
      projects,
      image_prefixes: prefixes,
      build_cache_hours: policy.prune_build_cache_hours,
      remove_stopped_managed: true,
      dry_run: opts.dry_run === true,
    },
    requested_by: opts.requested_by ?? null,
  });
}

// ---------------------------------------------------------------------------
// Deployments: trigger, complete, deploy-first-when-down
// ---------------------------------------------------------------------------
const ENGINE_PUBLIC_URL = (process.env.ENGINE_PUBLIC_URL || 'http://127.0.0.1:8797').replace(/\/$/, '');

export interface DeployRequest {
  /** Environment id or key. */
  environment: string;
  /** Application key. */
  application: string;
  mode: 'deploy_only' | 'deploy_and_run';
  ref?: string | null;
  /** Null takes the policy default (deploy_and_run only; a deploy without a run keeps the stack up). */
  teardown_after_run?: boolean | null;
  requested_by?: string | null;
  /** The run this deploy is for (a run that found its stack down); replayed once the deploy succeeds. */
  run_request?: Record<string, unknown> | null;
  /** Why the infra job was queued — shown in the console. */
  reason?: string;
}

export interface DeployOutcome {
  status: number;
  body: Record<string, any>;
  audit?: { environment_id: string; details: Record<string, unknown> };
}

/**
 * Record a deploy and start it: through the environment's own deploy API
 * (config.deploy_api, a push with a callback) or, for a managed stack, as a
 * job for the infra agent. Never throws for a caller mistake.
 */
export async function createDeployment(r: DeployRequest, actorId?: string | null): Promise<DeployOutcome> {
  if (!r.environment || !r.application || (r.mode !== 'deploy_only' && r.mode !== 'deploy_and_run')) {
    return { status: 400, body: { error: 'environment_id, application and mode ("deploy_only"|"deploy_and_run") are required' } };
  }
  const { rows: envRows } = await query('SELECT id, key, name, config FROM environments WHERE id::text = $1 OR key = $1', [r.environment]);
  const environment = envRows[0];
  if (!environment) return { status: 404, body: { error: 'Environment not found', environment: r.environment } };

  const infra = infraConfig(environment);
  const deployApi = (environment.config || {}).deploy_api as { base_url?: string; key_env?: string } | undefined;
  if (!infra && !(deployApi?.base_url && deployApi?.key_env)) {
    return {
      status: 409,
      body: {
        error: `Environment "${environment.key}" is not deployable from here: set config.infra {driver: "compose", script} for a local Docker stack, or config.deploy_api {base_url, key_env} for a remote deploy API`,
      },
    };
  }
  let deployKey: string | undefined;
  if (!infra) {
    deployKey = process.env[deployApi!.key_env!];
    if (!deployKey) return { status: 500, body: { error: `${deployApi!.key_env} is not set on the Test Engine` } };
  }

  const policy = await infraPolicy();
  const ref = typeof r.ref === 'string' && r.ref.trim() ? r.ref.trim() : infra?.default_ref || 'main';
  // Only a managed stack can be torn down, and only a deploy that runs something has an "after the run".
  const teardown = !!infra && r.mode === 'deploy_and_run' && (r.teardown_after_run ?? policy.teardown_after_run_default);
  const requestedBy = r.requested_by ?? actorId ?? null;

  const { rows } = await query(
    `INSERT INTO deployments (application, environment_id, ref, mode, status, requested_by, teardown_after_run, run_request)
     VALUES ($1,$2,$3,$4,'queued',$5,$6,$7::jsonb) RETURNING *`,
    [r.application, environment.id, ref, r.mode, requestedBy, teardown, r.run_request ? JSON.stringify(r.run_request) : null]
  );
  const row = rows[0]!;
  const auditInfo = { environment_id: environment.id, details: { deployment_id: row.id, application: r.application, ref, mode: r.mode, teardown_after_run: teardown } };

  if (infra) {
    // The person wants it up: a teardown still waiting for the agent is moot now.
    await query(
      `UPDATE infra_jobs SET status = 'cancelled', error = 'superseded by a deploy', finished_at = now(), updated_at = now()
       WHERE environment_id = $1 AND kind = 'teardown' AND status = 'queued'`,
      [environment.id]
    );
    const { job } = await queueInfraJob({
      kind: 'deploy',
      environment_id: environment.id,
      deployment_id: row.id,
      reason: r.reason || 'requested',
      params: { script: infra.script, ref, compose_project: infra.compose_project },
      requested_by: requestedBy,
    });
    if (job.deployment_id !== row.id) {
      // A deploy of this stack is already queued or running; this request rides on it.
      await query(`UPDATE deployments SET status = 'failed', error = $2, finished_at = now() WHERE id = $1`, [
        row.id, `A deploy of ${environment.key} is already in progress (job ${job.id})`,
      ]);
      const { rows: again } = await query('SELECT * FROM deployments WHERE id = $1', [row.id]);
      return { status: 409, body: { error: again[0].error, data: again[0], job_id: job.id } };
    }
    await setEnvironmentState(environment.id, 'deploying');
    const online = await agentOnline();
    return {
      status: 202,
      body: {
        data: { ...row, job_id: job.id, agent_online: online },
        ...(online ? {} : { warning: 'No infrastructure agent is online — the deploy waits until one connects (npm run start:infra-agent on the Docker host)' }),
      },
      audit: auditInfo,
    };
  }

  // Remote deploy API: push now, learn the outcome through the callback.
  try {
    const res = await fetch(`${deployApi!.base_url!.replace(/\/$/, '')}/v1/deploy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-deploy-key': deployKey! },
      body: JSON.stringify({ ref, callback_url: `${ENGINE_PUBLIC_URL}/api/v1/deployments/${encodeURIComponent(row.id)}/callback`, requested_by: requestedBy }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`deploy API returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const { job_id } = await res.json().catch(() => ({ job_id: null }));
    const { rows: updated } = await query(
      `UPDATE deployments SET status = 'deploying', key = $2, started_at = now() WHERE id = $1 RETURNING *`,
      [row.id, job_id ?? null]
    );
    return { status: 202, body: { data: updated[0] }, audit: auditInfo };
  } catch (err) {
    const { rows: failed } = await query(
      `UPDATE deployments SET status = 'failed', error = $2, started_at = now(), finished_at = now() WHERE id = $1 RETURNING *`,
      [row.id, (err as Error).message.slice(0, 2000)]
    );
    return { status: 202, body: { data: failed[0] }, audit: auditInfo };
  }
}

export interface DeployResult {
  status: 'succeeded' | 'failed';
  commit?: string | null;
  version?: string | null;
  error?: string | null;
}

/**
 * Record how a deploy ended and, on success, start what it was for: the run
 * request it carries (a run that found the stack down) or, for
 * deploy_and_run, "everything" for the application. A failed deploy never
 * queues a run. Returns the updated deployment row.
 */
export async function completeDeployment(row: any, result: DeployResult, actorId?: string | null): Promise<any> {
  const { rows: envRows } = await query('SELECT id, key, config FROM environments WHERE id = $1', [row.environment_id]);
  const environment = envRows[0];
  const managedId: string | null = environment && infraConfig(environment) ? String(environment.id) : null;

  if (result.status === 'failed') {
    const { rows: updated } = await query(
      `UPDATE deployments SET status = 'failed', error = $2, finished_at = now() WHERE id = $1 RETURNING *`,
      [row.id, (result.error || 'Deploy failed').slice(0, 2000)]
    );
    if (managedId) await setEnvironmentState(managedId, 'failed');
    return updated[0];
  }

  if (managedId) await setEnvironmentState(managedId, 'up');

  let runId: string | null = null;
  let runError: string | null = null;
  const request = row.run_request && typeof row.run_request === 'object' ? (row.run_request as Record<string, any>) : null;
  if (request && request.planner === 'run') {
    const { queueRun } = await import('./routes/trigger.js');
    const { planner: _planner, ...fields } = request;
    const outcome = await queueRun({ ...fields, application: fields.application, environment: row.environment_id } as any, actorId);
    runId = outcome.queued?.run_id ?? null;
    if (!runId) runError = String(outcome.body?.error || `run planner answered HTTP ${outcome.status}`);
  } else if (request && request.planner === 'run_all') {
    const { runAllCases } = await import('./routes/executions.js');
    const outcome = await runAllCases(
      { application_key: request.application, environment_id: row.environment_id, trigger_source: request.trigger_source || 'run-all', requested_by: request.requested_by ?? row.requested_by },
      actorId
    );
    runId = (outcome.body?.data?.run_group as string) ?? null;
    if (!runId) runError = String(outcome.body?.error || `run planner answered HTTP ${outcome.status}`);
  } else if (row.mode === 'deploy_and_run') {
    const { runAllCases } = await import('./routes/executions.js');
    const outcome = await runAllCases(
      { application_key: row.application, environment_id: row.environment_id, trigger_source: 'deploy', requested_by: row.requested_by },
      actorId
    );
    runId = (outcome.body?.data?.run_group as string) ?? null;
    if (!runId) runError = String(outcome.body?.error || `run planner answered HTTP ${outcome.status}`);
  }

  const { rows: updated } = await query(
    `UPDATE deployments SET status = 'succeeded', commit = $2, version = $3, run_id = $4, error = $5, finished_at = now() WHERE id = $1 RETURNING *`,
    [row.id, result.commit ?? null, result.version ?? null, runId, runError ? `Deployed, but the run could not be queued: ${runError}`.slice(0, 2000) : null]
  );
  return updated[0];
}

export interface DeferredRun {
  status: number;
  body: Record<string, any>;
  deferred: { deployment_id: string; environment: string };
}

/**
 * A run asked for on a managed stack that is down (or whose last deploy
 * failed) deploys the stack first; the run starts when the deploy succeeds
 * and the stack comes down again afterwards. Returns null when the run should
 * simply be queued — the stack is up, or the environment is not managed.
 */
export async function deployFirstIfDown(
  environment: Record<string, any>,
  run: { planner: 'run' | 'run_all'; application: string } & Record<string, unknown>,
  actorId?: string | null
): Promise<DeferredRun | { status: number; body: Record<string, any>; deferred?: undefined } | null> {
  const infra = infraConfig(environment);
  if (!infra) return null;
  const state = environmentState(environment);

  if (state === 'deploying') {
    // Ride on the deploy in progress when it carries no run of its own.
    const { rows } = await query(
      `SELECT * FROM deployments WHERE environment_id = $1 AND status IN ('queued','deploying') ORDER BY created_at DESC LIMIT 1`,
      [environment.id]
    );
    const current = rows[0];
    if (current && current.mode === 'deploy_only' && !current.run_request) {
      const policy = await infraPolicy();
      const { rows: updated } = await query(
        `UPDATE deployments SET mode = 'deploy_and_run', run_request = $2::jsonb, teardown_after_run = $3 WHERE id = $1 RETURNING *`,
        [current.id, JSON.stringify(run), policy.teardown_after_run_default]
      );
      return deferredBody(updated[0]!, environment.key, 'A deploy of this environment is in progress; the run starts when it succeeds');
    }
    return {
      status: 409,
      body: {
        error: `Environment "${environment.key}" is being deployed${current?.run_id || current?.run_request || current?.mode === 'deploy_and_run' ? ' and already has a run waiting on that deploy' : ''}`,
        deployment: current ? { id: current.id, status: current.status, status_url: `/api/v1/deployments/${current.id}` } : null,
      },
    };
  }
  if (state === 'tearing_down') {
    return { status: 409, body: { error: `Environment "${environment.key}" is being torn down — ask again in a minute and it will be deployed first` } };
  }
  if (state !== 'down' && state !== 'failed') return null;

  const policy = await infraPolicy();
  if (!policy.auto_deploy_when_down) {
    return { status: 409, body: { error: `Environment "${environment.key}" is down and automatic deploys are off — deploy it first (Deploy on the console, or POST /api/v1/deployments)` } };
  }
  const outcome = await createDeployment(
    {
      environment: environment.id,
      application: run.application,
      mode: 'deploy_and_run',
      requested_by: typeof run.requested_by === 'string' ? run.requested_by : actorId ?? null,
      run_request: run,
      reason: 'run_on_down_environment',
    },
    actorId
  );
  if (outcome.status !== 202) return { status: outcome.status, body: outcome.body };
  return deferredBody(outcome.body.data, environment.key, `Environment "${environment.key}" was down — deploying it first; the run starts when the deploy succeeds and the stack is torn down after it`, outcome.body.warning);
}

function deferredBody(deployment: any, environmentKey: string, message: string, warning?: string): DeferredRun {
  return {
    status: 202,
    body: {
      data: {
        deployment,
        deployment_id: deployment.id,
        environment: environmentKey,
        run_id: null,
        status_url: `/api/v1/deployments/${deployment.id}`,
      },
      message,
      ...(warning ? { warning } : {}),
    },
    deferred: { deployment_id: deployment.id, environment: environmentKey },
  };
}

// ---------------------------------------------------------------------------
// The tick: once a minute from the API process
// ---------------------------------------------------------------------------
export interface TickResult {
  at: string;
  reaped: number;
  after_run: string[];
  teardowns: Array<{ key: string; reason: TeardownReason }>;
  prune_queued: boolean;
}

export async function infraTick(): Promise<TickResult> {
  const policy = await infraPolicy();
  const result: TickResult = { at: new Date().toISOString(), reaped: 0, after_run: [], teardowns: [], prune_queued: false };

  // 1. Jobs whose agent went away or that ran too long are failed, and what they held is released.
  const { rows: reaped } = await query(
    `UPDATE infra_jobs
     SET status = 'failed',
         error = CASE WHEN started_at < now() - ($1::int * interval '1 minute')
                      THEN 'timed out after ' || $1::text || ' minutes'
                      ELSE 'the infra agent stopped reporting progress' END,
         finished_at = now(), updated_at = now()
     WHERE status = 'running'
       AND (started_at < now() - ($1::int * interval '1 minute') OR updated_at < now() - interval '10 minutes')
     RETURNING *`,
    [policy.job_timeout_minutes]
  );
  for (const job of reaped) {
    result.reaped++;
    await applyJobOutcome(job);
  }

  // 2. Deploy-and-run deploys whose run has finished: tear the stack down.
  const { rows: finished } = await query(
    `SELECT d.* FROM deployments d
     WHERE d.teardown_after_run AND d.status = 'succeeded' AND d.teardown_job_id IS NULL
       AND d.finished_at > now() - interval '7 days'
       AND (d.run_id IS NULL OR NOT EXISTS (
             SELECT 1 FROM executions x
             WHERE x.metadata->>'run_group' = d.run_id AND x.status IN ('queued','preparing','running')))`
  );
  if (finished.length) {
    const envs = await managedEnvironments();
    for (const d of finished) {
      const env = envs.find((e) => e.id === d.environment_id);
      if (!env) {
        // Not (or no longer) a managed stack: nothing we can tear down.
        await query(`UPDATE deployments SET teardown_after_run = false WHERE id = $1`, [d.id]);
        continue;
      }
      if (env.active_runs > 0) continue; // another run is using the stack — the idle rule will catch it later
      const job = env.pending_job ? null : await queueTeardown(env, 'after_run', { policy, deployment_id: d.id, requested_by: d.requested_by });
      if (job) {
        await query(`UPDATE deployments SET teardown_job_id = $2 WHERE id = $1`, [d.id, job.id]);
        env.pending_job = true;
        result.after_run.push(env.key);
      }
    }
  }

  // 3. Idle and max-uptime rules.
  const envs = await managedEnvironments();
  for (const decision of decideTeardowns(envs, policy, new Date())) {
    const env = envs.find((e) => e.id === decision.environment_id)!;
    const job = await queueTeardown(env, decision.reason, { policy, requested_by: 'infra-policy' });
    if (job) result.teardowns.push({ key: env.key, reason: decision.reason });
  }

  // 4. Housekeeping on a cadence.
  if (policy.prune_every_hours > 0) {
    const { rows } = await query(
      `SELECT max(created_at) AS last FROM infra_jobs WHERE kind = 'prune' AND status IN ('queued','running','succeeded')
         AND (params->>'dry_run') IS DISTINCT FROM 'true'`
    );
    const last = rows[0]?.last ? new Date(rows[0].last).getTime() : 0;
    if (Date.now() - last >= policy.prune_every_hours * HOUR) {
      const { created } = await queuePrune('housekeeping', { requested_by: 'infra-policy', policy });
      result.prune_queued = created;
    }
  }
  return result;
}

/**
 * Side effects of a job ending (from the agent's report or the reaper):
 * a deploy completes its deployment, a teardown settles the stack's state.
 */
export async function applyJobOutcome(job: any, actorId?: string | null): Promise<void> {
  const ok = job.status === 'succeeded';
  const result = (job.result && typeof job.result === 'object' ? job.result : {}) as Record<string, any>;
  if (job.kind === 'deploy' && job.deployment_id) {
    const { rows } = await query('SELECT * FROM deployments WHERE id = $1', [job.deployment_id]);
    if (rows[0] && (rows[0].status === 'queued' || rows[0].status === 'deploying')) {
      await completeDeployment(
        rows[0],
        ok
          ? { status: 'succeeded', commit: typeof result.commit === 'string' ? result.commit : null, version: typeof result.version === 'string' ? result.version : null }
          : { status: 'failed', error: job.error || 'Deploy failed' },
        actorId
      );
    } else if (job.environment_id) {
      await setEnvironmentState(job.environment_id, ok ? 'up' : 'failed');
    }
  } else if (job.kind === 'teardown' && job.environment_id) {
    await setEnvironmentState(job.environment_id, ok ? 'down' : 'unknown', ok ? { torn_down_at: new Date().toISOString(), teardown_reason: job.reason } : {});
  }
}
