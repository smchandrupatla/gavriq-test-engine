import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../db/client.js';
import { audit } from '../middleware/rbac.js';
import { humanDateTime } from '../lib/naming.js';
import { deployFirstIfDown } from '../infra.js';

/** "<case name> — <timestamp>" for a single case, "<suite name> — <timestamp>" for many, else "Run — <timestamp>". */
function runName(caseNames: string[], suiteName: string | null, at: Date): string {
  const stamp = humanDateTime(at);
  if (caseNames.length === 1) return `${caseNames[0]} — ${stamp}`;
  if (suiteName) return `${suiteName} — ${stamp}`;
  return `Run — ${stamp}`;
}

export interface RunAllOutcome {
  status: number;
  body: Record<string, any>;
  /** Set only when executions were actually queued (not on dry_run or an empty plan): what to audit. */
  audit?: { application_id: string; details: Record<string, unknown> };
}

/**
 * Plan and queue "everything" for one application: one execution per
 * non-empty suite, grouped under a shared metadata.run_group id. Shared by
 * the console's "Run everything" button (`/api/v1/executions/run-all`) and
 * the post-deploy "deploy and run" flow (`routes/deployments.ts`), so both
 * mean exactly the same thing by "everything". Never throws for a caller
 * mistake: the outcome carries the HTTP status and body to answer with.
 */
export async function runAllCases(b: Record<string, unknown>, actorId?: string | null): Promise<RunAllOutcome> {
  const appKey = typeof b.application_key === 'string' ? b.application_key : null;
  const appId = typeof b.application_id === 'string' ? b.application_id : null;
  if (!appKey && !appId) {
    return { status: 400, body: { error: 'Provide application_key or application_id' } };
  }

  const appRow = await query(
    `SELECT id, key, name FROM applications WHERE ${appId ? 'id::text = $1' : 'key = $1'}`,
    [appId || appKey]
  );
  if (!appRow.rows[0]) return { status: 404, body: { error: 'Application not found' } };
  const application = appRow.rows[0];

  let environmentId: string | null = null;
  if (typeof b.environment_id === 'string' && b.environment_id) {
    const env = await query(
      `SELECT id, key, config FROM environments WHERE id::text = $1 OR key = $1`,
      [b.environment_id]
    );
    if (!env.rows[0]) return { status: 404, body: { error: 'Environment not found' } };
    environmentId = env.rows[0].id;
    // A managed stack that is down is deployed first; "everything" is queued when the deploy succeeds.
    if (b.dry_run !== true) {
      const deferred = await deployFirstIfDown(
        env.rows[0],
        { planner: 'run_all', application: application.key, trigger_source: (b.trigger_source as string) || 'run-all', requested_by: (b.requested_by as string) ?? actorId ?? null },
        actorId
      );
      if (deferred) return { status: deferred.status, body: deferred.body };
    }
  }

  const suites = await query(
    `SELECT s.id, s.key, s.name, s.suite_type,
            COALESCE(array_agg(m.test_case_id ORDER BY m.sort_order) FILTER (WHERE m.test_case_id IS NOT NULL), '{}') AS case_ids
     FROM test_suites s
     LEFT JOIN test_case_suites m ON m.test_suite_id = s.id
     LEFT JOIN test_cases tc ON tc.id = m.test_case_id AND tc.lifecycle NOT IN ('deprecated','archived')
     WHERE s.application_id = $1 AND tc.id IS NOT NULL
     GROUP BY s.id
     ORDER BY s.key`,
    [application.id]
  );

  const seen = new Set<string>();
  const plan: Array<{ suite_id: string; suite_key: string; suite_name: string; case_ids: string[] }> = [];
  for (const s of suites.rows) {
    const ids = (s.case_ids as string[]).filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (ids.length) plan.push({ suite_id: s.id, suite_key: s.key, suite_name: s.name, case_ids: ids });
  }

  const totalCases = plan.reduce((n, p) => n + p.case_ids.length, 0);
  if (b.dry_run === true) {
    return {
      status: 200,
      body: {
        data: {
          application: application.key,
          environment_id: environmentId,
          total_cases: totalCases,
          suites: plan.map((p) => ({ key: p.suite_key, name: p.suite_name, cases: p.case_ids.length })),
        },
      },
    };
  }
  if (!totalCases) return { status: 400, body: { error: 'Application has no runnable cases' } };

  const runGroup = `all-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const batchAt = new Date();
  const created: any[] = [];
  for (const p of plan) {
    const key = `exec-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const name = runName([], p.suite_name, batchAt);
    const { rows } = await query(
      `INSERT INTO executions (
         key, name, requested_by, test_suite_id, test_case_ids, environment_id,
         execution_location, status, trigger_source, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,'out_of_container','queued',$7,$8::jsonb)
       RETURNING id, key, name, test_suite_id, test_case_ids, status, created_at`,
      [
        key, name, (b.requested_by as string) ?? actorId ?? null, p.suite_id, p.case_ids, environmentId,
        (b.trigger_source as string) || 'run-all',
        JSON.stringify({ run_group: runGroup, suite_key: p.suite_key, application_key: application.key }),
      ]
    );
    created.push({ ...rows[0], suite_key: p.suite_key, suite_name: p.suite_name });
  }

  return {
    status: 202,
    body: {
      data: {
        run_group: runGroup,
        application: application.key,
        environment_id: environmentId,
        total_cases: totalCases,
        executions: created,
      },
      message: `Queued ${created.length} suite executions (${totalCases} cases)`,
    },
    audit: {
      application_id: application.id,
      details: { run_group: runGroup, executions: created.length, total_cases: totalCases, environment_id: environmentId },
    },
  };
}

export async function executionRoutes(app: FastifyInstance) {
  app.get('/api/v1/executions', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const clauses: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (q.status) { clauses.push(`status = $${i++}`); params.push(q.status); }
    if (q.environment_id) { clauses.push(`environment_id = $${i++}`); params.push(q.environment_id); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM executions ${where} ORDER BY created_at DESC LIMIT 50`,
      params
    );
    return reply.send({ data: rows });
  });

  app.get<{ Params: { id: string } }>('/api/v1/executions/:id', async (req, reply) => {
    const { rows } = await query(
      'SELECT * FROM executions WHERE id::text = $1 OR key = $1',
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Execution not found' });
    const results = await query(
      'SELECT * FROM execution_results WHERE execution_id = $1 ORDER BY created_at',
      [rows[0].id]
    );

    const enriched = [];
    for (const r of results.rows) {
      const ev = await query(
        `SELECT * FROM evidence WHERE execution_result_id = $1 ORDER BY created_at`,
        [r.id]
      );
      enriched.push({
        ...r,
        evidence: ev.rows.map((e: any) => ({
          ...e,
          url: e.storage_key
            ? `/api/v1/evidence/file?key=${encodeURIComponent(e.storage_key)}`
            : null,
        })),
      });
    }

    return reply.send({ data: { ...rows[0], results: enriched } });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/executions', async (req, reply) => {
    const b = req.body || {};
    const testCaseIds: string[] = Array.isArray(b.test_case_ids) ? b.test_case_ids : [];
    if (!testCaseIds.length && !b.test_suite_id && !b.test_plan_id) {
      return reply.status(400).send({ error: 'Provide test_case_ids, test_suite_id, or test_plan_id' });
    }

    let resolvedIds = [...testCaseIds];
    if (b.test_suite_id && !resolvedIds.length) {
      const suiteCases = await query(
        'SELECT test_case_id FROM test_case_suites WHERE test_suite_id = $1',
        [b.test_suite_id]
      );
      resolvedIds = suiteCases.rows.map((r: any) => r.test_case_id);
    }

    if (b.environment_id && b.safety_category) {
      const env = await query(
        'SELECT safety_policy FROM environments WHERE id::text = $1 OR key = $1',
        [b.environment_id]
      );
      if (env.rows[0]) {
        const decision = (env.rows[0].safety_policy || {})[b.safety_category as string] || 'prohibited';
        if (decision === 'prohibited') {
          return reply.status(403).send({
            error: 'Safety policy prohibits this test category on the selected environment',
            category: b.safety_category,
            decision,
          });
        }
      }
    }

    let environmentId = b.environment_id ?? null;
    if (typeof environmentId === 'string' && environmentId && !/^[0-9a-f-]{36}$/i.test(environmentId)) {
      const envRow = await query('SELECT id FROM environments WHERE key = $1', [environmentId]);
      environmentId = envRow.rows[0]?.id ?? null;
    }

    const [caseRows, suiteRow] = await Promise.all([
      resolvedIds.length
        ? query(
            `SELECT tc.name, a.key AS app_key FROM test_cases tc
             JOIN applications a ON a.id = tc.application_id
             WHERE tc.id = ANY($1::uuid[])`,
            [resolvedIds]
          )
        : Promise.resolve({ rows: [] as any[] }),
      b.test_suite_id
        ? query(
            `SELECT s.name, a.key AS app_key FROM test_suites s
             JOIN applications a ON a.id = s.application_id
             WHERE s.id = $1`,
            [b.test_suite_id]
          )
        : Promise.resolve({ rows: [] as any[] }),
    ]);
    const caseNames = caseRows.rows.map((r: any) => r.name);
    const suiteName = suiteRow.rows[0]?.name ?? null;
    // application_key drives the console's env/app-scoped run filtering (routes/ui.ts /ui/live) —
    // derived from the actual case/suite rather than trusted from the caller.
    const applicationKey = caseRows.rows[0]?.app_key ?? suiteRow.rows[0]?.app_key ?? null;
    const name = runName(caseNames, suiteName, new Date());
    const metadata = { ...(b.metadata && typeof b.metadata === 'object' ? b.metadata : {}), ...(applicationKey ? { application_key: applicationKey } : {}) };

    const key = `exec-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const { rows } = await query(
      `INSERT INTO executions (
         key, name, requested_by, test_plan_id, test_suite_id, test_case_ids,
         environment_id, execution_location, status, trigger_source, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::execution_location,'out_of_container'),'queued',COALESCE($9,'manual'),$10::jsonb)
       RETURNING *`,
      [
        key, name, b.requested_by ?? req.actor?.id ?? null, b.test_plan_id ?? null, b.test_suite_id ?? null,
        resolvedIds, environmentId, b.execution_location ?? null,
        b.trigger_source ?? null, JSON.stringify(metadata),
      ]
    );

    await audit(req, 'execution.queue', 'execution', rows[0]!.id, {
      key,
      case_count: resolvedIds.length,
      environment_id: environmentId,
      trigger_source: b.trigger_source || 'manual',
    });

    return reply.status(202).send({ data: rows[0], message: 'Execution queued' });
  });

  /**
   * On-demand "run everything" for one application: queues one execution per
   * non-empty suite (cases deduped across suites so nothing runs twice),
   * grouped under a shared metadata.run_group id. With dry_run=true it only
   * returns the plan.
   */
  app.post<{ Body: Record<string, unknown> }>('/api/v1/executions/run-all', async (req, reply) => {
    const outcome = await runAllCases(req.body || {}, req.actor?.id);
    if (outcome.audit) await audit(req, 'execution.run_all', 'application', outcome.audit.application_id, outcome.audit.details);
    return reply.status(outcome.status).send(outcome.body);
  });

  // Status only — what a worker polls while it runs a job, to learn it was cancelled.
  app.get<{ Params: { id: string } }>('/api/v1/executions/:id/status', async (req, reply) => {
    const { rows } = await query('SELECT id, status FROM executions WHERE id::text = $1 OR key = $1', [req.params.id]);
    if (!rows[0]) return reply.status(404).send({ error: 'Execution not found' });
    return reply.send({ data: rows[0] });
  });

  app.post<{ Params: { id: string } }>('/api/v1/executions/:id/cancel', async (req, reply) => {
    const { rows } = await query(
      `UPDATE executions SET status = 'cancelled', finished_at = now()
       WHERE (id::text = $1 OR key = $1) AND status IN ('queued','preparing','running')
       RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Execution not found or not cancellable' });
    await audit(req, 'execution.cancel', 'execution', rows[0].id, {});
    return reply.send({ data: rows[0] });
  });

  // Bulk stop: every queued/preparing/running execution, optionally narrowed to
  // one application/environment. Unscoped (no body) cancels everything in flight —
  // the "Cancel all" action behind the console's Running Now tab.
  app.post<{ Body: { application_key?: string; environment_id?: string } }>(
    '/api/v1/executions/cancel-all',
    async (req, reply) => {
      const b = req.body || {};
      const clauses = [`status IN ('queued','preparing','running')`];
      const params: unknown[] = [];
      if (b.application_key) { params.push(b.application_key); clauses.push(`metadata->>'application_key' = $${params.length}`); }
      if (b.environment_id) { params.push(b.environment_id); clauses.push(`environment_id::text = $${params.length}`); }
      const { rows } = await query(
        `UPDATE executions SET status = 'cancelled', finished_at = now()
         WHERE ${clauses.join(' AND ')}
         RETURNING id`,
        params
      );
      await audit(req, 'execution.cancel_all', 'application', undefined, { cancelled: rows.length, ...b });
      return reply.send({ data: { cancelled: rows.length } });
    }
  );

  app.post<{ Body: { worker_id: string; capabilities?: string[] } }>(
    '/api/v1/executions/claim',
    async (req, reply) => {
      const workerId = req.body?.worker_id;
      if (!workerId) return reply.status(400).send({ error: 'worker_id required' });

      // A worker that died mid-job leaves its execution "running" forever
      // (the live run screen never settles). Workers heartbeat every 15s even
      // while a case is executing, so three silent minutes means it is gone.
      await query(
        `UPDATE executions e
            SET status = 'error', finished_at = now(),
                metadata = e.metadata || jsonb_build_object(
                  'abandoned', true,
                  'abandoned_reason', 'worker ' || COALESCE(e.worker_id, '(none)') || ' stopped reporting before the run completed')
          WHERE e.status IN ('running','preparing')
            AND e.started_at < now() - interval '3 minutes'
            AND NOT EXISTS (
              SELECT 1 FROM workers w
               WHERE w.id = e.worker_id AND w.last_heartbeat > now() - interval '3 minutes')`
      );

      const row = await withTransaction(async (client) => {
        const { rows } = await client.query(
          `SELECT * FROM executions
           WHERE status = 'queued'
           ORDER BY created_at
           FOR UPDATE SKIP LOCKED
           LIMIT 1`
        );
        if (!rows[0]) return null;
        // The run records the build it is about to test: the commit registered on the
        // environment (config.deployment) at the moment a worker starts. A build the
        // caller passed in metadata.build (a deploy pipeline knows best) is kept.
        const { rows: updated } = await client.query(
          `UPDATE executions e SET status = 'running', worker_id = $2, started_at = now(),
                  metadata = COALESCE((
                    SELECT jsonb_build_object('build', env.config->'deployment')
                    FROM environments env
                    WHERE env.id = e.environment_id AND jsonb_typeof(env.config->'deployment') = 'object'
                  ), '{}'::jsonb) || e.metadata
           WHERE e.id = $1 RETURNING *`,
          [rows[0].id, workerId]
        );
        await client.query(
          `UPDATE workers SET last_heartbeat = now(), status = 'busy', current_load = current_load + 1
           WHERE id = $1`,
          [workerId]
        );
        return updated[0];
      });

      if (!row) return reply.status(204).send();
      return reply.send({ data: row });
    }
  );

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/executions/:id/results',
    async (req, reply) => {
      const b = req.body || {};
      const exec = await query(
        'SELECT id, status FROM executions WHERE id::text = $1 OR key = $1',
        [req.params.id]
      );
      if (!exec.rows[0]) return reply.status(404).send({ error: 'Execution not found' });
      // A cancelled run takes no more results: the worker reads this as "stop".
      if (exec.rows[0].status === 'cancelled') {
        return reply.status(409).send({ error: 'Execution was cancelled', code: 'execution_cancelled' });
      }

      // Remarks: what happened in plain words, one line per step then the outcome
      // (the worker sends them; an older worker's message is split into lines).
      const remarks = Array.isArray(b.remarks)
        ? b.remarks.map((r: unknown) => String(r ?? '').trim()).filter(Boolean).slice(0, 200)
        : String(b.message || '').split(/;\s+(?=[A-Za-z0-9])/).map((s) => s.trim()).filter(Boolean);
      const { rows } = await query(
        `INSERT INTO execution_results (
           execution_id, test_case_id, status, verdict, duration_ms,
           started_at, finished_at, message, classification, metrics, remarks
         ) VALUES ($1,$2,$3::execution_status,$4,$5,$6,$7,$8,$9::failure_classification,COALESCE($10,'{}'::jsonb),$11::jsonb)
         RETURNING *`,
        [
          exec.rows[0].id, b.test_case_id, b.status, b.verdict ?? null,
          b.duration_ms ?? null, b.started_at ?? null, b.finished_at ?? new Date().toISOString(),
          b.message ?? null, b.classification ?? null, JSON.stringify(b.metrics ?? {}), JSON.stringify(remarks),
        ]
      );

      if (Array.isArray(b.evidence)) {
        for (const ev of b.evidence) {
          await query(
            `INSERT INTO evidence (execution_result_id, evidence_type, storage_key, content_type, size_bytes, redacted, metadata)
             VALUES ($1,$2,$3,$4,$5,COALESCE($6,false),COALESCE($7,'{}'::jsonb))`,
            [
              rows[0]!.id, ev.type, ev.storage_key, ev.content_type ?? null,
              ev.size_bytes ?? null, ev.redacted ?? false, JSON.stringify(ev.metadata ?? {}),
            ]
          );
        }
      }

      return reply.status(201).send({ data: rows[0] });
    }
  );

  app.post<{ Params: { id: string }; Body: { status?: string; metadata?: Record<string, unknown> } }>(
    '/api/v1/executions/:id/complete',
    async (req, reply) => {
      const status = req.body?.status || 'passed';
      const metadataPatch =
        req.body?.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata)
          ? req.body.metadata
          : null;
      // "Cancelled" is final: a worker finishing up (or an older worker that never
      // noticed the cancel) must not turn the run back into passed/failed.
      const { rows } = await query(
        `UPDATE executions SET
           status = CASE WHEN status = 'cancelled' THEN status ELSE $2::execution_status END,
           finished_at = CASE WHEN status = 'cancelled' THEN COALESCE(finished_at, now()) ELSE now() END,
           metadata = metadata || COALESCE($3::jsonb, '{}'::jsonb)
         WHERE id::text = $1 OR key = $1 RETURNING *`,
        [req.params.id, status, metadataPatch ? JSON.stringify(metadataPatch) : null]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Execution not found' });
      if (rows[0].worker_id) {
        await query(
          `UPDATE workers SET current_load = GREATEST(current_load - 1, 0),
             status = CASE WHEN current_load <= 1 THEN 'online' ELSE status END
           WHERE id = $1`,
          [rows[0].worker_id]
        );
      }
      return reply.send({ data: rows[0] });
    }
  );
}
