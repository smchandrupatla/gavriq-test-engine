/**
 * Defect log API — the register of defects the engine logged and people raised by hand.
 *
 *   GET    /api/v1/defect-log?application=&status=&run_id=&origin=&environment=   list
 *   GET    /api/v1/defect-log/dashboard?application=&environment=        counts by status, fix progress, per app/env
 *   GET    /api/v1/defect-log/managers                                   implementation managers named on any app
 *   POST   /api/v1/defect-log/bulk      {action, ids[], rejected_reason?} delete|send|validate|reject many at once
 *   GET    /api/v1/defect-log/:id/timeline                               lifecycle + loop history + comments, merged
 *   GET    /api/v1/defect-log/:id/comments                               manual comments
 *   POST   /api/v1/defect-log/:id/comments   {body, author?}             add a comment
 *   POST   /api/v1/defect-log                                           raise a defect by hand
 *   GET    /api/v1/defect-log/:id                                       one defect, with attachments
 *   PATCH  /api/v1/defect-log/:id                                       update; status logged|validated|rejected
 *   DELETE /api/v1/defect-log/:id
 *   POST   /api/v1/defect-log/:id/send                                  send to the implementation manager
 *   POST   /api/v1/defect-log/:id/attachments                           upload a screenshot or log (base64)
 *   GET    /api/v1/defect-log/attachments/:attId                        download an attachment
 *   DELETE /api/v1/defect-log/attachments/:attId
 *   GET    /api/v1/defect-log/settings/:application                     auto-approve + implementation manager
 *   PUT    /api/v1/defect-log/settings/:application                     {auto_approve?, implementation_manager?}
 *   POST   /api/v1/defect-log/backfill                                  log defects ingested before the log existed
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { audit } from '../middleware/rbac.js';
import { evidenceUrl } from '../evidence-store.js';
import {
  addAttachment, addComment, backfill, bulkAction, createManual, dashboardStats, deleteAttachment, deleteDefectLog,
  getAttachment, getAutoApprove, getDefectLog, getTimeline, isBulkAction, listComments, listDefectLog, listManagers,
  LogError, sendToManager, setAutoApprove, setImplementationManager, updateDefectLog,
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
    return reply.send({ data: await listDefectLog({ application: q.application, status: q.status, run_id: q.run_id, origin: q.origin, environment: q.environment, limit: Number(q.limit) || undefined }) });
  });

  app.get<{ Querystring: Record<string, string> }>('/api/v1/defect-log/dashboard', async (req, reply) => {
    const q = req.query;
    return reply.send({ data: await dashboardStats({ application: q.application, environment: q.environment }) });
  });

  app.get('/api/v1/defect-log/managers', async (_req, reply) => {
    return reply.send({ data: await listManagers() });
  });

  app.post<{ Body: { action?: unknown; ids?: unknown; rejected_reason?: unknown } }>('/api/v1/defect-log/bulk', async (req, reply) => {
    const b = req.body || {};
    if (!isBulkAction(b.action)) return reply.status(400).send({ error: `action must be one of delete, send, validate, reject` });
    if (!Array.isArray(b.ids) || !b.ids.length) return reply.status(400).send({ error: 'ids must be a non-empty array' });
    const ids = b.ids.map(String).slice(0, 500);
    try {
      const out = await bulkAction(b.action, ids, actorOf(req), typeof b.rejected_reason === 'string' ? b.rejected_reason : undefined);
      await audit(req, `defect-log.bulk.${b.action}`, 'defect_log', 'bulk', { count: out.done, failed: out.failed.length });
      return reply.send({ data: out });
    } catch (err) {
      return fail(reply, err);
    }
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

  app.get<{ Params: { id: string } }>('/api/v1/defect-log/:id/timeline', async (req, reply) => {
    try {
      return reply.send({ data: await getTimeline(req.params.id) });
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get<{ Params: { id: string } }>('/api/v1/defect-log/:id/comments', async (req, reply) => {
    return reply.send({ data: await listComments(req.params.id) });
  });

  app.post<{ Params: { id: string }; Body: { body?: unknown; author?: unknown } }>('/api/v1/defect-log/:id/comments', async (req, reply) => {
    try {
      const b = req.body || {};
      const author = typeof b.author === 'string' && b.author.trim() ? b.author.trim() : actorOf(req);
      const c = await addComment(req.params.id, String(b.body ?? ''), author);
      await audit(req, 'defect-log.comment', 'defect_log', req.params.id, { comment: c.id });
      return reply.status(201).send({ data: c });
    } catch (err) {
      return fail(reply, err);
    }
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

  app.put<{ Params: { application: string }; Body: { auto_approve?: unknown; implementation_manager?: unknown } }>(
    '/api/v1/defect-log/settings/:application',
    async (req, reply) => {
      const b = req.body || {};
      const hasApprove = b.auto_approve !== undefined;
      const hasManager = b.implementation_manager !== undefined;
      if (!hasApprove && !hasManager) return reply.status(400).send({ error: 'send auto_approve and/or implementation_manager' });
      if (hasApprove && typeof b.auto_approve !== 'boolean') return reply.status(400).send({ error: 'auto_approve must be true or false' });
      try {
        if (hasManager) {
          const raw = b.implementation_manager;
          let manager = null as null | { name: string; contact?: string };
          if (raw !== null) {
            if (typeof raw !== 'object' || !String((raw as any).name ?? '').trim()) {
              return reply.status(400).send({ error: 'implementation_manager must be null or an object with a name' });
            }
            manager = { name: String((raw as any).name).trim(), contact: String((raw as any).contact ?? '').trim() || undefined };
          }
          await setImplementationManager(req.params.application, manager);
          await audit(req, 'defect-log.implementation-manager', 'application', req.params.application, { manager: manager?.name ?? null });
        }
        if (hasApprove) {
          await setAutoApprove(req.params.application, b.auto_approve as boolean);
          await audit(req, 'defect-log.auto-approve', 'application', req.params.application, { auto_approve: b.auto_approve });
        }
        const s = await getAutoApprove(req.params.application);
        if (!s) return reply.status(404).send({ error: 'application not found' });
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
