/**
 * Feedback loop controls — start, suspend, resume and stop the loop of an application.
 * The reports themselves are the Defect Manager's (/api/v1/defect-reports, /api/v1/defects).
 *
 *   GET  /api/v1/feedback-loop?application=…   loop state, phase, outstanding reports
 *   POST /api/v1/feedback-loop/start           {application, environment}
 *   POST /api/v1/feedback-loop/suspend         {application}
 *   POST /api/v1/feedback-loop/resume          {application}
 *   POST /api/v1/feedback-loop/stop            {application}
 */
import type { FastifyInstance } from 'fastify';
import { audit } from '../middleware/rbac.js';
import { getLoopStatus, setLoopState, startLoop } from '../feedback-loop.js';

function stringField(body: Record<string, unknown> | undefined, name: string): string | null {
  const v = body?.[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function feedbackLoopRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { application?: string } }>('/api/v1/feedback-loop', async (req, reply) => {
    const application = req.query.application;
    if (!application) return reply.status(400).send({ error: 'application is required' });
    return reply.send({ data: await getLoopStatus(application) });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/feedback-loop/start', async (req, reply) => {
    const application = stringField(req.body, 'application');
    const environment = stringField(req.body, 'environment');
    if (!application || !environment) return reply.status(400).send({ error: 'application and environment are required' });
    const out = await startLoop(application, environment);
    if (out.status === 200) await audit(req, 'feedback-loop.start', 'application', application, { environment });
    return reply.status(out.status).send(out.body);
  });

  for (const action of ['suspend', 'resume', 'stop'] as const) {
    app.post<{ Body: Record<string, unknown> }>(`/api/v1/feedback-loop/${action}`, async (req, reply) => {
      const application = stringField(req.body, 'application');
      if (!application) return reply.status(400).send({ error: 'application is required' });
      const out = await setLoopState(application, action);
      if (out.status === 200) await audit(req, `feedback-loop.${action}`, 'application', application, {});
      return reply.status(out.status).send(out.body);
    });
  }
}
