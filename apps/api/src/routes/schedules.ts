import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

export async function scheduleRoutes(app: FastifyInstance) {
  app.get('/api/v1/schedules', async (_req, reply) => {
    const { rows } = await query('SELECT * FROM schedules ORDER BY name');
    return reply.send({ data: rows });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/schedules', async (req, reply) => {
    const b = req.body || {};
    if (!b.name) return reply.status(400).send({ error: 'name required' });
    if (!b.cron_expression && !b.event_trigger) {
      return reply.status(400).send({ error: 'cron_expression or event_trigger required' });
    }
    const { rows } = await query(
      `INSERT INTO schedules (
         name, cron_expression, event_trigger, test_plan_id, test_suite_id,
         test_case_ids, environment_id, enabled, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,true),$9)
       RETURNING *`,
      [
        b.name,
        b.cron_expression ?? null,
        b.event_trigger ?? null,
        b.test_plan_id ?? null,
        b.test_suite_id ?? null,
        b.test_case_ids ?? [],
        b.environment_id ?? null,
        b.enabled ?? true,
        b.created_by ?? null,
      ]
    );
    return reply.status(201).send({ data: rows[0] });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/schedules/:id',
    async (req, reply) => {
      const b = req.body || {};
      const { rows } = await query(
        `UPDATE schedules SET
           name = COALESCE($2, name),
           cron_expression = COALESCE($3, cron_expression),
           enabled = COALESCE($4, enabled),
           environment_id = COALESCE($5, environment_id),
           test_case_ids = COALESCE($6, test_case_ids),
           updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          req.params.id,
          b.name ?? null,
          b.cron_expression ?? null,
          b.enabled ?? null,
          b.environment_id ?? null,
          b.test_case_ids ?? null,
        ]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Schedule not found' });
      return reply.send({ data: rows[0] });
    }
  );

  /** Fire a schedule immediately (manual / event trigger) */
  app.post<{ Params: { id: string }; Body?: { requested_by?: string } }>(
    '/api/v1/schedules/:id/run',
    async (req, reply) => {
      const { rows } = await query('SELECT * FROM schedules WHERE id = $1', [req.params.id]);
      if (!rows[0]) return reply.status(404).send({ error: 'Schedule not found' });
      const s = rows[0];

      let caseIds: string[] = s.test_case_ids || [];
      if (!caseIds.length && s.test_suite_id) {
        const suiteCases = await query(
          'SELECT test_case_id FROM test_case_suites WHERE test_suite_id = $1',
          [s.test_suite_id]
        );
        caseIds = suiteCases.rows.map((r: any) => r.test_case_id);
      }

      if (!caseIds.length && !s.test_plan_id) {
        return reply.status(400).send({ error: 'Schedule has no test cases or plan' });
      }

      const key = `sched-${Date.now().toString(36)}`;
      const exec = await query(
        `INSERT INTO executions (
           key, requested_by, test_plan_id, test_suite_id, test_case_ids,
           environment_id, status, trigger_source, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,'queued','schedule',$7::jsonb)
         RETURNING *`,
        [
          key,
          req.body?.requested_by || 'scheduler',
          s.test_plan_id,
          s.test_suite_id,
          caseIds,
          s.environment_id,
          JSON.stringify({ schedule_id: s.id, schedule_name: s.name }),
        ]
      );

      await query(
        `UPDATE schedules SET last_run_at = now() WHERE id = $1`,
        [s.id]
      );

      return reply.status(202).send({ data: exec.rows[0], message: 'Execution queued from schedule' });
    }
  );

  /** Event-based trigger (after_build, after_deploy, ...) */
  app.post<{ Body: { event: string; environment_id?: string; metadata?: unknown } }>(
    '/api/v1/schedules/trigger',
    async (req, reply) => {
      const event = req.body?.event;
      if (!event) return reply.status(400).send({ error: 'event required' });

      const { rows } = await query(
        `SELECT * FROM schedules WHERE enabled = true AND event_trigger = $1`,
        [event]
      );

      const started = [];
      for (const s of rows) {
        let caseIds: string[] = s.test_case_ids || [];
        if (!caseIds.length && s.test_suite_id) {
          const suiteCases = await query(
            'SELECT test_case_id FROM test_case_suites WHERE test_suite_id = $1',
            [s.test_suite_id]
          );
          caseIds = suiteCases.rows.map((r: any) => r.test_case_id);
        }
        const key = `evt-${event}-${Date.now().toString(36)}`;
        const exec = await query(
          `INSERT INTO executions (
             key, requested_by, test_plan_id, test_suite_id, test_case_ids,
             environment_id, status, trigger_source, metadata
           ) VALUES ($1,'event',$2,$3,$4,COALESCE($5,$6),'queued','ci',$7::jsonb)
           RETURNING id, key`,
          [
            key,
            s.test_plan_id,
            s.test_suite_id,
            caseIds,
            req.body?.environment_id ?? null,
            s.environment_id,
            JSON.stringify({ event, schedule_id: s.id, ...(req.body?.metadata as object || {}) }),
          ]
        );
        await query(`UPDATE schedules SET last_run_at = now() WHERE id = $1`, [s.id]);
        started.push(exec.rows[0]);
      }

      return reply.status(202).send({
        data: { event, executions_started: started.length, executions: started },
      });
    }
  );
}
