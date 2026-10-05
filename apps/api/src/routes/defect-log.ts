/**
 * Defect log API — the register of defects the engine logged and people raised by hand.
 *
 *   GET    /api/v1/defect-log?application=&status=&run_id=&origin=     list
 *   POST   /api/v1/defect-log                                           raise a defect by hand
 *   GET    /api/v1/defect-log/:id                                       one defect, with attachments
 *   PATCH  /api/v1/defect-log/:id                                       update; status logged|validated|rejected
 *   DELETE /api/v1/defect-log/:id
 *   POST   /api/v1/defect-log/:id/send                                  send to the implementation manager
 *   POST   /api/v1/defect-log/:id/attachments                           upload a screenshot or log (base64)
 *   GET    /api/v1/defect-log/attachments/:attId                        download an attachment
 *   DELETE /api/v1/defect-log/attachments/:attId
 *   GET    /api/v1/defect-log/settings/:application                     auto-approve setting
 *   PUT    /api/v1/defect-log/settings/:application                     {auto_approve: boolean}
 *   POST   /api/v1/defect-log/backfill                                  log defects ingested before the log existed
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { audit } from '../middleware/rbac.js';
import { evidenceUrl } from '../evidence-store.js';
import {
  addAttachment, backfill, createManual, deleteAttachment, deleteDefectLog, getAttachment, getAutoApprove,
  getDefectLog, LogError, listDefectLog, sendToManager, setAutoApprove, updateDefectLog,
} from '../defect-log.js';

const ATTACHMENT_BODY_LIMIT = 8 * 1024 * 1024;

function actorOf(req: FastifyRequest): string {
  return req.actor?.id ?? 'operator';
}

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof LogError) return reply.status(err.statusCode).send({ error: err.message });
  throw err;
}

export async function defectLogRoutes(app: FastifyInstance) {
  app.get<{ Querystring: Record<string, string> }>('/api/v1/defect-log', async (req, reply) => {
    const q = req.query;
    return reply.send({ data: await listDefectLog({ application: q.application, status: q.status, run_id: q.run_id, origin: q.origin, limit: Number(q.limit) || undefined }) });
  });

  app.post<{ Body: Record<string, any> }>('/api/v1/defect-log', async (req, reply) => {
    try {
      const b = req.body || {};
      if (!b.application) return reply.status(400).send({ error: 'application is required' });
      const created = await createManual(b as any, actorOf(req));
      await audit(req, 'defect-log.create', 'defect_log', created.id, { key: created.key });
      return reply.status(201).send({ data: await getDefectLog(created.id) });
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get<{ Params: { id: string } }>('/api/v1/defect-log/:id', async (req, reply) => {
    const row = await getDefectLog(req.params.id);
    if (!row) return reply.status(404).send({ error: 'defect not found' });
    return reply.send({ data: row });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, any> }>('/api/v1/defect-log/:id', async (req, reply) => {
    try {
      const updated = await updateDefectLog(req.params.id, req.body || {}, actorOf(req));
      await audit(req, 'defect-log.update', 'defect_log', req.params.id, { fields: Object.keys(req.body || {}) });
      return reply.send({ data: await getDefectLog(updated.id) });
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.delete<{ Params: { id: string } }>('/api/v1/defect-log/:id', async (req, reply) => {
    const ok = await deleteDefectLog(req.params.id);
    if (!ok) return reply.status(404).send({ error: 'defect not found' });
    await audit(req, 'defect-log.delete', 'defect_log', req.params.id, {});
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/v1/defect-log/:id/send', async (req, reply) => {
    try {
      const sent = await sendToManager(req.params.id, actorOf(req));
      await audit(req, 'defect-log.send', 'defect_log', req.params.id, { key: sent.key, report: sent.defect_report_id });
      return reply.send({ data: await getDefectLog(sent.id) });
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post<{ Params: { id: string }; Body: Record<string, any> }>(
    '/api/v1/defect-log/:id/attachments',
    { bodyLimit: ATTACHMENT_BODY_LIMIT },
    async (req, reply) => {
      try {
        const att = await addAttachment(req.params.id, (req.body || {}) as any, actorOf(req));
        await audit(req, 'defect-log.attach', 'defect_log', req.params.id, { attachment: att.id, name: att.name });
        return reply.status(201).send({ data: att });
      } catch (err) {
        return fail(reply, err);
      }
    }
  );

  app.get<{ Params: { attId: string } }>('/api/v1/defect-log/attachments/:attId', async (req, reply) => {
    const att = await getAttachment(req.params.attId);
    if (!att) return reply.status(404).send({ error: 'attachment not found' });
    if (att.content) {
      return reply.header('content-type', att.content_type ?? 'application/octet-stream').header('content-disposition', `inline; filename="${String(att.name).replace(/"/g, '')}"`).send(att.content);
    }
    const url = evidenceUrl(att.storage_key);
    if (url) return reply.redirect(url);
    return reply.status(404).send({ error: 'attachment has no content' });
  });

  app.delete<{ Params: { attId: string } }>('/api/v1/defect-log/attachments/:attId', async (req, reply) => {
    const ok = await deleteAttachment(req.params.attId);
    if (!ok) return reply.status(404).send({ error: 'attachment not found' });
    return reply.status(204).send();
  });

  app.get<{ Params: { application: string } }>('/api/v1/defect-log/settings/:application', async (req, reply) => {
    const s = await getAutoApprove(req.params.application);
    if (!s) return reply.status(404).send({ error: 'application not found' });
    return reply.send({ data: s });
  });

  app.put<{ Params: { application: string }; Body: { auto_approve?: unknown } }>(
    '/api/v1/defect-log/settings/:application',
    async (req, reply) => {
      if (typeof req.body?.auto_approve !== 'boolean') return reply.status(400).send({ error: 'auto_approve must be true or false' });
      try {
        const s = await setAutoApprove(req.params.application, req.body.auto_approve);
        await audit(req, 'defect-log.auto-approve', 'application', req.params.application, { auto_approve: s.auto_approve });
        return reply.send({ data: s });
      } catch (err) {
        return fail(reply, err);
      }
    }
  );

  app.post('/api/v1/defect-log/backfill', async (req, reply) => {
    const out = await backfill(actorOf(req));
    await audit(req, 'defect-log.backfill', 'defect_log', 'all', out);
    return reply.send({ data: out });
  });
}
