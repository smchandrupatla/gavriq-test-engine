import type { FastifyInstance, FastifyReply } from 'fastify';
import { audit } from '../middleware/rbac.js';
import {
  claimReport, DefectError, defectOverview, getReport, ingestExecution, listDefects, listReports,
  requestRerun, updateDefect,
} from '../defects/service.js';

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof DefectError) {
    return reply.status(err.statusCode).send({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  throw err;
}

function actor(body: Record<string, unknown> | undefined, fallback?: string | null): string {
  const by = typeof body?.by === 'string' && body.by.trim() ? body.by.trim() : fallback || 'unknown';
  return by.slice(0, 120);
}

/**
 * Defect API — the channel between the engine's Defect Manager and the Sand
 * Bench Product Manager. See docs/DEFECT-MANAGER.md for the loop.
 */
export async function defectRoutes(app: FastifyInstance) {
  app.get('/api/v1/defect-manager/overview', async (_req, reply) => reply.send({ data: await defectOverview() }));

  app.get('/api/v1/defect-reports', async (req, reply) => {
    const q = req.query as { status?: string; limit?: string };
    return reply.send({ data: await listReports({ status: q.status, limit: Number(q.limit) || undefined }) });
  });

  app.get<{ Params: { id: string } }>('/api/v1/defect-reports/:id', async (req, reply) => {
    const report = await getReport(req.params.id);
    if (!report) return reply.status(404).send({ error: 'Defect report not found' });
    return reply.send({ data: report });
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/v1/defect-reports/:id/claim', async (req, reply) => {
    try {
      const by = actor(req.body, req.actor?.id);
      const data = await claimReport(req.params.id, by);
      await audit(req, 'defect_report.claim', 'defect_report', data.id, { by });
      return reply.send({ data });
    } catch (err) { return fail(reply, err); }
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/v1/defect-reports/:id/rerun', async (req, reply) => {
    try {
      const by = actor(req.body, req.actor?.id);
      const b = req.body || {};
      const data = await requestRerun(
        req.params.id, by,
        typeof b.note === 'string' ? b.note.slice(0, 2000) : undefined,
        typeof b.environment_id === 'string' ? b.environment_id : null,
      );
      await audit(req, 'defect_report.rerun', 'defect_report', data.report.id, { by, execution: data.execution.key });
      return reply.status(202).send({ data, message: 'Rerun queued' });
    } catch (err) { return fail(reply, err); }
  });

  app.get('/api/v1/defects', async (req, reply) => {
    const q = req.query as { status?: string; report?: string; limit?: string };
    return reply.send({ data: await listDefects({ status: q.status, report: q.report, limit: Number(q.limit) || undefined }) });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/v1/defects/:id', async (req, reply) => {
    try {
      const b = req.body || {};
      const by = actor(b, req.actor?.id);
      const data = await updateDefect(req.params.id, { ...b, by });
      await audit(req, 'defect.update', 'defect', data.id, { by, status: data.status });
      return reply.send({ data });
    } catch (err) { return fail(reply, err); }
  });

  /** Re-read an execution (normally automatic on completion). Idempotent. */
  app.post<{ Params: { id: string } }>('/api/v1/executions/:id/ingest-defects', async (req, reply) => {
    const data = await ingestExecution(req.params.id);
    if (data.outcome === 'not_found') return reply.status(404).send({ error: 'Execution not found' });
    return reply.send({ data });
  });
}
