/**
 * Infrastructure API (see ../infra.ts for the lifecycle it drives).
 *
 * For people and the console:
 *   GET  /api/v1/infra                       overview: policy, agents, managed stacks (state, next automatic
 *                                            action), recent jobs, last housekeeping result
 *   GET  /api/v1/infra/policy                the lifecycle policy
 *   PUT  /api/v1/infra/policy                change it (partial; validated)
 *   GET  /api/v1/infra/jobs[?environment_id&kind&limit]
 *   GET  /api/v1/infra/jobs/:id
 *   POST /api/v1/infra/jobs                  {kind: "teardown", environment_id, force?} | {kind: "prune", dry_run?}
 *   POST /api/v1/infra/jobs/:id/cancel       a job still queued
 *   POST /api/v1/infra/tick                  run the once-a-minute decision pass now
 *
 * For the infra agent (apps/infra-agent, the process on the Docker host):
 *   POST /api/v1/infra/agents/heartbeat      {id, name, host?, version?, metadata?}
 *   POST /api/v1/infra/jobs/claim            {agent_id} → 200 {data: job} | 204
 *   POST /api/v1/infra/jobs/:id/progress     {log}
 *   POST /api/v1/infra/jobs/:id/complete     {status: "succeeded"|"failed", result?, log?, error?}
 */
import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { audit } from '../middleware/rbac.js';
import {
  AGENT_FRESH_SECONDS,
  PolicyError,
  applyJobOutcome,
  infraPolicy,
  infraTick,
  managedEnvironments,
  nextTeardown,
  queuePrune,
  queueTeardown,
  savePolicy,
  setEnvironmentState,
} from '../infra.js';

const LOG_LIMIT = 64 * 1024;

function tail(text: unknown, limit = LOG_LIMIT): string | null {
  if (typeof text !== 'string') return null;
  return text.length > limit ? text.slice(text.length - limit) : text;
}

async function agents() {
  const { rows } = await query(
    `SELECT id, name, host, version, metadata, last_heartbeat, registered_at,
            last_heartbeat > now() - ($1::int * interval '1 second') AS online
     FROM infra_agents ORDER BY last_heartbeat DESC`,
    [AGENT_FRESH_SECONDS]
  );
  return rows;
}

async function recentJobs(opts: { environment_id?: string; kind?: string; limit?: number } = {}) {
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (opts.environment_id) {
    params.push(opts.environment_id);
    clauses.push(`(j.environment_id::text = $${params.length} OR env.key = $${params.length})`);
  }
  if (opts.kind) {
    params.push(opts.kind);
    clauses.push(`j.kind = $${params.length}`);
  }
  params.push(Math.max(1, Math.min(opts.limit || 30, 200)));
  const { rows } = await query(
    `SELECT j.id, j.kind, j.status, j.reason, j.params, j.result, j.error, j.agent_id, j.requested_by,
            j.environment_id, env.key AS environment_key, env.name AS environment_name,
            j.deployment_id, d.run_id, d.mode AS deployment_mode, d.ref AS deployment_ref,
            j.created_at, j.started_at, j.updated_at, j.finished_at,
            right(j.log, 4000) AS log_tail
     FROM infra_jobs j
     LEFT JOIN environments env ON env.id = j.environment_id
     LEFT JOIN deployments d ON d.id = j.deployment_id
     ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
     ORDER BY j.created_at DESC LIMIT $${params.length}`,
    params
  );
  return rows;
}

export async function infraRoutes(app: FastifyInstance) {
  // ---- people / console -------------------------------------------------
  app.get('/api/v1/infra', async (_req, reply) => {
    const policy = await infraPolicy();
    const [envs, agentRows, jobs, lastPrune] = await Promise.all([
      managedEnvironments(),
      agents(),
      recentJobs({ limit: 30 }),
      query(
        `SELECT id, status, result, finished_at, params FROM infra_jobs
         WHERE kind = 'prune' AND status IN ('succeeded','failed') ORDER BY finished_at DESC LIMIT 1`
      ),
    ]);
    const pending = await query(
      `SELECT environment_id, id, kind, status, reason, created_at FROM infra_jobs
       WHERE status IN ('queued','running') AND environment_id IS NOT NULL`
    );
    const pendingByEnv = new Map<string, any>(pending.rows.map((r: any) => [r.environment_id, r]));
    const environments = envs.map((e) => {
      const next = nextTeardown(e, policy);
      const dep = e.config.deployment || {};
      return {
        id: e.id,
        key: e.key,
        name: e.name,
        state: e.state,
        compose_project: e.infra.compose_project,
        script: e.infra.script,
        default_ref: e.infra.default_ref,
        applications: Array.isArray(e.config.applications) ? e.config.applications.map(String) : [],
        idle_teardown_hours: e.idle_teardown_hours,
        max_uptime_hours: e.max_uptime_hours,
        deployed: {
          ref: dep.ref ?? null,
          commit: dep.commit ?? null,
          version: dep.version ?? null,
          deployed_at: e.deployed_at,
          torn_down_at: dep.torn_down_at ?? null,
          state_changed_at: dep.state_changed_at ?? null,
        },
        last_run_at: e.last_run_at,
        active_runs: e.active_runs,
        pending_job: pendingByEnv.get(e.id) || null,
        next_teardown: next
          ? { reason: next.reason, at: next.at.toISOString(), detail: next.detail, blocked_by_active_runs: e.active_runs > 0 }
          : null,
      };
    });
    return reply.send({
      data: {
        policy,
        agents: agentRows,
        agent_online: agentRows.some((a: any) => a.online),
        environments,
        jobs,
        last_prune: lastPrune.rows[0] || null,
      },
    });
  });

  app.get('/api/v1/infra/policy', async (_req, reply) => reply.send({ data: await infraPolicy() }));

  app.put<{ Body: Record<string, unknown> }>('/api/v1/infra/policy', async (req, reply) => {
    try {
      const policy = await savePolicy(req.body || {}, req.actor?.id ?? null);
      await audit(req, 'infra.policy.update', 'settings', 'infra_policy', { changed: Object.keys(req.body || {}) });
      return reply.send({ data: policy });
    } catch (err) {
      if (err instanceof PolicyError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  app.get('/api/v1/infra/agents', async (_req, reply) => reply.send({ data: await agents() }));

  app.get('/api/v1/infra/jobs', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send({ data: await recentJobs({ environment_id: q.environment_id, kind: q.kind, limit: Number(q.limit) || undefined }) });
  });

  app.get<{ Params: { id: string } }>('/api/v1/infra/jobs/:id', async (req, reply) => {
    const { rows } = await query(
      `SELECT j.*, env.key AS environment_key, env.name AS environment_name
       FROM infra_jobs j LEFT JOIN environments env ON env.id = j.environment_id WHERE j.id::text = $1`,
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Job not found' });
    return reply.send({ data: rows[0] });
  });

  /** A person asks for a teardown or housekeeping now. Deploys go through POST /api/v1/deployments. */
  app.post<{ Body: Record<string, unknown> }>('/api/v1/infra/jobs', async (req, reply) => {
    const b = req.body || {};
    const requestedBy = (typeof b.requested_by === 'string' && b.requested_by) || req.actor?.id || null;

    if (b.kind === 'prune') {
      const { job, created } = await queuePrune('requested', { requested_by: requestedBy, dry_run: b.dry_run === true });
      await audit(req, 'infra.prune', 'infra_job', job.id, { dry_run: b.dry_run === true, created });
      return reply.status(created ? 202 : 200).send({ data: job, ...(created ? {} : { message: 'Housekeeping is already queued' }) });
    }

    if (b.kind === 'teardown') {
      const envRef = typeof b.environment_id === 'string' ? b.environment_id : '';
      if (!envRef) return reply.status(400).send({ error: 'environment_id is required for a teardown' });
      const envs = await managedEnvironments();
      const env = envs.find((e) => e.id === envRef || e.key === envRef);
      if (!env) return reply.status(404).send({ error: 'Not a managed environment (config.infra.driver must be "compose")', environment: envRef });
      if (env.state === 'down') return reply.status(409).send({ error: `Environment "${env.key}" is already down` });
      if (env.active_runs > 0 && b.force !== true) {
        return reply.status(409).send({
          error: `Environment "${env.key}" has ${env.active_runs} run(s) in progress — cancel them first, or pass force: true`,
          active_runs: env.active_runs,
        });
      }
      const job = await queueTeardown(env, 'requested', { requested_by: requestedBy });
      if (!job) return reply.status(200).send({ data: env.pending_job, message: 'A job for this environment is already pending' });
      await audit(req, 'infra.teardown', 'environment', env.id, { job_id: job.id, force: b.force === true });
      return reply.status(202).send({ data: job });
    }

    return reply.status(400).send({ error: 'kind must be "teardown" or "prune" (deploys: POST /api/v1/deployments)' });
  });

  app.post<{ Params: { id: string } }>('/api/v1/infra/jobs/:id/cancel', async (req, reply) => {
    const { rows } = await query(
      `UPDATE infra_jobs SET status = 'cancelled', error = 'cancelled', finished_at = now(), updated_at = now()
       WHERE id::text = $1 AND status = 'queued' RETURNING *`,
      [req.params.id]
    );
    const job = rows[0];
    if (!job) {
      const { rows: any } = await query('SELECT status FROM infra_jobs WHERE id::text = $1', [req.params.id]);
      if (!any[0]) return reply.status(404).send({ error: 'Job not found' });
      return reply.status(409).send({ error: `Only a queued job can be cancelled (this one is ${any[0].status})` });
    }
    if (job.kind === 'deploy' && job.deployment_id) {
      await query(`UPDATE deployments SET status = 'failed', error = 'cancelled before the agent picked it up', finished_at = now() WHERE id = $1 AND status = 'queued'`, [job.deployment_id]);
    }
    if (job.environment_id) {
      const previous = (job.params || {}).previous_state;
      await setEnvironmentState(job.environment_id, job.kind === 'teardown' && typeof previous === 'string' ? (previous as any) : 'unknown');
    }
    await audit(req, 'infra.job.cancel', 'infra_job', job.id, { kind: job.kind });
    return reply.send({ data: job });
  });

  app.post('/api/v1/infra/tick', async (req, reply) => {
    const result = await infraTick();
    await audit(req, 'infra.tick', 'settings', 'infra_policy', result as unknown as Record<string, unknown>);
    return reply.send({ data: result });
  });

  // ---- agent ------------------------------------------------------------
  app.post<{ Body: Record<string, unknown> }>('/api/v1/infra/agents/heartbeat', async (req, reply) => {
    const b = req.body || {};
    if (typeof b.id !== 'string' || !b.id) return reply.status(400).send({ error: 'id is required' });
    const { rows } = await query(
      `INSERT INTO infra_agents (id, name, host, version, metadata, last_heartbeat)
       VALUES ($1,$2,$3,$4,COALESCE($5,'{}'::jsonb),now())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, host = EXCLUDED.host, version = EXCLUDED.version,
         metadata = EXCLUDED.metadata, last_heartbeat = now()
       RETURNING *`,
      [b.id, typeof b.name === 'string' && b.name ? b.name : b.id, typeof b.host === 'string' ? b.host : null,
        typeof b.version === 'string' ? b.version : null, b.metadata ? JSON.stringify(b.metadata) : null]
    );
    return reply.send({ data: rows[0] });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/infra/jobs/claim', async (req, reply) => {
    const agentId = typeof req.body?.agent_id === 'string' && req.body.agent_id ? req.body.agent_id : 'infra-agent';
    const { rows } = await query(
      `WITH next AS (
         SELECT id FROM infra_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
       )
       UPDATE infra_jobs j SET status = 'running', agent_id = $1, started_at = now(), updated_at = now()
       FROM next WHERE j.id = next.id
       RETURNING j.*`,
      [agentId]
    );
    const job = rows[0];
    if (!job) return reply.status(204).send();
    if (job.kind === 'deploy' && job.deployment_id) {
      await query(`UPDATE deployments SET status = 'deploying', started_at = now() WHERE id = $1 AND status = 'queued'`, [job.deployment_id]);
    }
    const env = job.environment_id
      ? (await query('SELECT id, key, name, config FROM environments WHERE id = $1', [job.environment_id])).rows[0]
      : null;
    return reply.send({ data: { ...job, environment: env ? { id: env.id, key: env.key, name: env.name, infra: env.config?.infra ?? null } : null } });
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/v1/infra/jobs/:id/progress', async (req, reply) => {
    const { rows } = await query(
      `UPDATE infra_jobs SET log = COALESCE($2, log), updated_at = now() WHERE id::text = $1 AND status = 'running' RETURNING id, status`,
      [req.params.id, tail(req.body?.log)]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'No running job with that id' });
    return reply.send({ data: rows[0] });
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/v1/infra/jobs/:id/complete', async (req, reply) => {
    const b = req.body || {};
    const status = b.status === 'succeeded' || b.status === 'failed' ? b.status : null;
    if (!status) return reply.status(400).send({ error: 'status must be "succeeded" or "failed"' });
    const { rows } = await query(
      `UPDATE infra_jobs
       SET status = $2, result = COALESCE($3::jsonb, result), log = COALESCE($4, log), error = $5, finished_at = now(), updated_at = now()
       WHERE id::text = $1 AND status = 'running' RETURNING *`,
      [req.params.id, status, b.result && typeof b.result === 'object' ? JSON.stringify(b.result) : null, tail(b.log),
        status === 'failed' ? String(b.error || 'failed').slice(0, 2000) : null]
    );
    const job = rows[0];
    if (!job) return reply.status(404).send({ error: 'No running job with that id (already completed, cancelled, or reaped)' });
    await applyJobOutcome(job, req.actor?.id);
    await audit(req, `infra.${job.kind}.completed`, job.environment_id ? 'environment' : 'infra_job', job.environment_id || job.id, {
      job_id: job.id, status, reason: job.reason, error: job.error,
    });
    return reply.send({ data: job });
  });
}
