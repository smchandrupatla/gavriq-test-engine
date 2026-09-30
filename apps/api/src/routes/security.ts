import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  listScans, listVulnerabilities, recordScan, runCveWatch, SecurityError, setVulnerabilityStatus, watchStatus,
} from '../security/service.js';

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof SecurityError) return reply.status(err.statusCode).send({ error: err.message });
  throw err;
}

/** Security API: scanner reports in, vulnerability register and CVE Watch agent out. */
export async function securityRoutes(app: FastifyInstance) {
  app.post('/api/v1/security-scans', { bodyLimit: 32 * 1024 * 1024 }, async (req, reply) => {
    try { return reply.status(201).send({ data: await recordScan(req.body) }); } catch (e) { return fail(reply, e); }
  });
  app.get('/api/v1/security-scans', async (req, reply) =>
    reply.send({ data: await listScans(Number((req.query as any).limit) || 50) }));

  app.get('/api/v1/vulnerabilities', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send({ data: await listVulnerabilities({ ...q, limit: Number(q.limit) || undefined }) });
  });
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/v1/vulnerabilities/:id', async (req, reply) => {
    try {
      const b = req.body ?? {};
      return reply.send({ data: await setVulnerabilityStatus(req.params.id, String(b.status ?? ''), String(b.note ?? ''), String(b.by ?? req.actor?.id ?? 'unknown')) });
    } catch (e) { return fail(reply, e); }
  });

  app.get('/api/v1/cve-watch', async (_req, reply) => reply.send({ data: await watchStatus() }));
  app.post('/api/v1/cve-watch/run', async (_req, reply) => {
    const result = await runCveWatch({ trigger: 'manual' });
    return reply.status('skipped' in result ? 409 : 202).send({ data: result });
  });
}
