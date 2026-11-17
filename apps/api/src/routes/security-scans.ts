import type { FastifyInstance, FastifyReply } from 'fastify';
import { audit } from '../middleware/rbac.js';
import { SecurityScanError, getScan, ingestScan, listFindings, listScans, securityOverview } from '../security/service.js';

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof SecurityScanError) return reply.status(err.statusCode).send({ error: err.message });
  throw err;
}

/**
 * Security scans API. A project's scanner posts one report per run (Sand Bench:
 * scripts/security/scan.mjs, stage of the commit gate); the Security menu reads
 * the latest scan, the scan history and the findings register from here.
 */
export async function securityScanRoutes(app: FastifyInstance) {
  app.post('/api/v1/security-scans', { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
    try {
      const out = await ingestScan(req.body);
      if (!out.duplicate) {
        await audit(req, 'security_scan.ingest', 'security_scan', String(out.scan.id), {
          project: out.scan.project, result: out.scan.result, findings: out.findings,
        });
      }
      return reply.status(out.duplicate ? 200 : 201).send({ data: { ...out.scan, findings: out.findings }, duplicate: out.duplicate });
    } catch (err) { return fail(reply, err); }
  });

  app.get('/api/v1/security-scans', async (req, reply) => {
    const q = req.query as { project?: string; limit?: string };
    return reply.send({ data: await listScans({ project: q.project, limit: Number(q.limit) || undefined }) });
  });

  app.get('/api/v1/security-scans/latest', async (req, reply) => {
    const q = req.query as { project?: string };
    const data = await listScans({ project: q.project, limit: 1 });
    if (!data[0]) return reply.status(404).send({ error: 'No security scan has been reported yet' });
    return reply.send({ data: await getScan(String(data[0].id)) });
  });

  app.get<{ Params: { id: string } }>('/api/v1/security-scans/:id', async (req, reply) => {
    const data = await getScan(req.params.id.slice(0, 64));
    if (!data) return reply.status(404).send({ error: 'Security scan not found' });
    return reply.send({ data });
  });

  app.get('/api/v1/security-findings', async (req, reply) => {
    const q = req.query as { project?: string; status?: string; severity?: string; category?: string; limit?: string };
    return reply.send({
      data: await listFindings({ project: q.project, status: q.status, severity: q.severity, category: q.category, limit: Number(q.limit) || undefined }),
    });
  });

  app.get('/api/v1/security/overview', async (req, reply) => {
    const q = req.query as { project?: string };
    return reply.send({ data: await securityOverview(q.project) });
  });
}
