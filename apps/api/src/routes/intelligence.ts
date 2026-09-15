import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

/** Prompts 2, 9, 10 — AI proposals, failure intelligence, release readiness, agents */
export async function intelligenceRoutes(app: FastifyInstance) {
  // ---- AI Test Generation (Prompt 2) ----
  app.post<{ Body: Record<string, unknown> }>('/api/v1/test-cases/generate', async (req, reply) => {
    const b = req.body || {};
    // Stub: produces draft proposals from supplied context.
    // Real implementation would call an LLM with requirements / OpenAPI / code diff.
    const proposals = [
      {
        name: `Generated: ${(b.source_type as string) || 'context'} positive path`,
        test_type: 'api',
        description: 'AI-proposed positive scenario based on provided context',
        rationale: b.rationale || 'Covers happy-path behaviour inferred from input',
        lifecycle: 'draft',
        automation_status: 'to_be_automated',
      },
      {
        name: `Generated: ${(b.source_type as string) || 'context'} negative path`,
        test_type: 'api',
        description: 'AI-proposed negative / error scenario',
        rationale: 'Missing negative coverage detected',
        lifecycle: 'draft',
        automation_status: 'to_be_automated',
      },
      {
        name: `Generated: boundary conditions`,
        test_type: 'api',
        description: 'Boundary and edge-case checks',
        rationale: 'Boundary conditions often under-tested',
        lifecycle: 'draft',
        automation_status: 'to_be_automated',
      },
    ];

    const inserted = [];
    for (const p of proposals) {
      const { rows } = await query(
        `INSERT INTO ai_proposals (source_type, source_ref, proposed_case, rationale, status, application_id)
         VALUES ($1,$2,$3::jsonb,$4,'proposed',$5) RETURNING *`,
        [
          b.source_type || 'manual',
          b.source_ref ?? null,
          JSON.stringify(p),
          p.rationale,
          b.application_id ?? null,
        ]
      );
      inserted.push(rows[0]);
    }

    return reply.status(201).send({
      data: inserted,
      message: 'AI proposals created as drafts — require review before activation',
    });
  });

  app.get('/api/v1/ai-proposals', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const status = q.status || 'proposed';
    const { rows } = await query(
      'SELECT * FROM ai_proposals WHERE status = $1 ORDER BY created_at DESC LIMIT 50',
      [status]
    );
    return reply.send({ data: rows });
  });

  app.post<{ Params: { id: string }; Body: { action: string; reviewer?: string } }>(
    '/api/v1/ai-proposals/:id/review',
    async (req, reply) => {
      const action = req.body?.action; // accept | reject
      if (!['accept', 'reject'].includes(action)) {
        return reply.status(400).send({ error: 'action must be accept or reject' });
      }
      const status = action === 'accept' ? 'accepted' : 'rejected';
      const { rows } = await query(
        `UPDATE ai_proposals SET status = $2, reviewed_at = now(), reviewed_by = $3
         WHERE id = $1 RETURNING *`,
        [req.params.id, status, req.body?.reviewer ?? null]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Proposal not found' });

      // On accept, optionally materialise a draft test case
      if (action === 'accept' && rows[0].proposed_case) {
        const pc = rows[0].proposed_case;
        const key = `AI-${Date.now().toString(36)}`;
        await query(
          `INSERT INTO test_cases (key, name, description, application_id, test_type, lifecycle, automation_status, author_id)
           VALUES ($1,$2,$3,$4,COALESCE($5,'other'),'draft',COALESCE($6,'to_be_automated'),$7)
           ON CONFLICT DO NOTHING`,
          [
            key, pc.name, pc.description, rows[0].application_id,
            pc.test_type, pc.automation_status, req.body?.reviewer ?? null,
          ]
        );
      }

      return reply.send({ data: rows[0] });
    }
  );

  // ---- Failure classification (Prompt 9) ----
  app.post<{ Params: { id: string }; Body: { classification?: string; message?: string } }>(
    '/api/v1/execution-results/:id/classify',
    async (req, reply) => {
      // Auto-classify if not provided
      let classification = req.body?.classification;
      if (!classification) {
        const { rows } = await query('SELECT message FROM execution_results WHERE id = $1', [req.params.id]);
        const msg = (rows[0]?.message || '').toLowerCase();
        if (msg.includes('timeout') || msg.includes('timed out')) classification = 'timeout';
        else if (msg.includes('connection') || msg.includes('econnrefused')) classification = 'network_failure';
        else if (msg.includes('assert') || msg.includes('expected')) classification = 'assertion_failure';
        else if (msg.includes('auth') || msg.includes('401') || msg.includes('403')) classification = 'authentication_problem';
        else if (msg.includes('env') || msg.includes('config')) classification = 'environment_problem';
        else classification = 'unknown';
      }

      const { rows } = await query(
        `UPDATE execution_results SET classification = $2 WHERE id = $1 RETURNING *`,
        [req.params.id, classification]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Result not found' });
      return reply.send({ data: rows[0] });
    }
  );

  // ---- Coverage gaps / quality intelligence (Prompt 10) ----
  app.get('/api/v1/intelligence/gaps', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appId = q.application_id;

    // Requirements with zero linked tests
    const untestedReqs = await query(
      `SELECT r.id, r.key, r.title
       FROM requirements r
       LEFT JOIN test_cases tc ON tc.requirement_id = r.id
       WHERE tc.id IS NULL
         ${appId ? 'AND r.application_id = $1' : ''}
       LIMIT 50`,
      appId ? [appId] : []
    );

    // Stale tests (not updated in 90 days, still active)
    const stale = await query(
      `SELECT id, key, name, updated_at FROM test_cases
       WHERE lifecycle = 'active' AND updated_at < now() - interval '90 days'
       ${appId ? 'AND application_id = $1' : ''}
       LIMIT 30`,
      appId ? [appId] : []
    );

    // Never-executed tests
    const neverRun = await query(
      `SELECT tc.id, tc.key, tc.name
       FROM test_cases tc
       LEFT JOIN execution_results er ON er.test_case_id = tc.id
       WHERE er.id IS NULL AND tc.lifecycle IN ('active','approved')
       ${appId ? 'AND tc.application_id = $1' : ''}
       LIMIT 30`,
      appId ? [appId] : []
    );

    return reply.send({
      data: {
        untested_requirements: untestedReqs.rows,
        stale_tests: stale.rows,
        never_executed: neverRun.rows,
      },
    });
  });

  // ---- Release Readiness (Prompt 10) ----
  app.get('/api/v1/release-readiness', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appId = q.application_id;
    const planId = q.test_plan_id;

    // Simple scorecard based on recent execution results + mandatory suites
    const recent = await query(
      `SELECT er.status, count(*)::int AS c
       FROM execution_results er
       JOIN executions e ON e.id = er.execution_id
       WHERE e.created_at > now() - interval '14 days'
       GROUP BY er.status`
    );

    const byStatus: Record<string, number> = {};
    for (const r of recent.rows) byStatus[r.status] = r.c;

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const passed = byStatus['passed'] || 0;
    const failed = byStatus['failed'] || 0;
    const passRate = total ? passed / total : 0;

    let readiness: 'READY' | 'READY WITH CONDITIONS' | 'NOT READY' = 'NOT READY';
    const reasons: string[] = [];

    if (total === 0) {
      reasons.push('No executions in the last 14 days');
    } else if (failed === 0 && passRate >= 0.95) {
      readiness = 'READY';
      reasons.push(`Pass rate ${(passRate * 100).toFixed(1)}% with zero failures`);
    } else if (failed > 0 && passRate >= 0.8) {
      readiness = 'READY WITH CONDITIONS';
      reasons.push(`${failed} failures remain; pass rate ${(passRate * 100).toFixed(1)}%`);
    } else {
      reasons.push(`Pass rate ${(passRate * 100).toFixed(1)}% below threshold or critical failures present`);
    }

    return reply.send({
      data: {
        readiness,
        pass_rate: Math.round(passRate * 1000) / 10,
        totals: byStatus,
        reasons,
        application_id: appId || null,
        test_plan_id: planId || null,
        evaluated_at: new Date().toISOString(),
      },
    });
  });

  // ---- Agent-facing endpoints (Prompt 10) ----
  app.get('/api/v1/agents/context', async (req, reply) => {
    // Compact context an autonomous agent can consume
    const [apps, openProposals, gaps] = await Promise.all([
      query('SELECT id, key, name, status FROM applications LIMIT 20'),
      query(`SELECT id, source_type, status, created_at FROM ai_proposals WHERE status = 'proposed' LIMIT 10`),
      query(
        `SELECT count(*)::int AS untested FROM requirements r
         LEFT JOIN test_cases tc ON tc.requirement_id = r.id WHERE tc.id IS NULL`
      ),
    ]);
    return reply.send({
      data: {
        applications: apps.rows,
        open_ai_proposals: openProposals.rows,
        untested_requirements_count: gaps.rows[0]?.untested ?? 0,
        agent_capabilities: [
          'search_tests',
          'inspect_executions',
          'propose_tests',
          'create_draft_tests',
          'request_executions',
          'analyse_failures',
          'release_readiness',
        ],
      },
    });
  });

  // Audit helper
  app.post<{ Body: Record<string, unknown> }>('/api/v1/audit', async (req, reply) => {
    const b = req.body || {};
    const { rows } = await query(
      `INSERT INTO audit_events (actor_id, action, resource_type, resource_id, application_id, environment_id, details)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'{}'::jsonb)) RETURNING *`,
      [
        b.actor_id ?? null, b.action, b.resource_type, b.resource_id ?? null,
        b.application_id ?? null, b.environment_id ?? null, JSON.stringify(b.details ?? {}),
      ]
    );
    return reply.status(201).send({ data: rows[0] });
  });

  app.get('/api/v1/audit', async (req, reply) => {
    const { rows } = await query(
      'SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 100'
    );
    return reply.send({ data: rows });
  });
}
