/**
 * Evidence listing, upload, and file serve from the evidence store.
 * Workers upload artefacts per execution (storage_key evidence/<execution-id>/<file>);
 * legacy flat keys (evidence/fail-….png, written into a shared volume) still resolve.
 */
import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { query } from '../db/client.js';
import { evidenceUrl, saveEvidence, statEvidence } from '../evidence-store.js';

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.tap': 'text/plain; charset=utf-8',
  '.html': 'text/plain; charset=utf-8', // never rendered: captured pages are served as source
};

export async function evidenceRoutes(app: FastifyInstance) {
  // Evidence for one execution result
  app.get<{ Params: { resultId: string } }>(
    '/api/v1/execution-results/:resultId/evidence',
    async (req, reply) => {
      const { rows } = await query(
        `SELECT * FROM evidence WHERE execution_result_id = $1 ORDER BY created_at`,
        [req.params.resultId]
      );
      return reply.send({
        data: rows.map((r) => ({ ...r, url: evidenceUrl(r.storage_key) })),
      });
    }
  );

  // All evidence for an execution
  app.get<{ Params: { id: string } }>(
    '/api/v1/executions/:id/evidence',
    async (req, reply) => {
      const exec = await query(
        `SELECT id FROM executions WHERE id::text = $1 OR key = $1`,
        [req.params.id]
      );
      if (!exec.rows[0]) return reply.status(404).send({ error: 'Execution not found' });

      const { rows } = await query(
        `SELECT e.*, er.test_case_id, er.status AS result_status, er.message
         FROM evidence e
         JOIN execution_results er ON er.id = e.execution_result_id
         WHERE er.execution_id = $1
         ORDER BY e.created_at`,
        [exec.rows[0].id]
      );
      return reply.send({
        data: rows.map((r) => ({ ...r, url: evidenceUrl(r.storage_key) })),
      });
    }
  );

  /**
   * Worker upload. The artefact is stored under the execution it belongs to and
   * only becomes evidence once a result references the returned storage_key.
   * `probe: true` is the worker's preflight write test.
   */
  app.post<{ Body: Record<string, unknown> }>('/api/v1/evidence/upload', async (req, reply) => {
    const b = req.body || {};
    const name = typeof b.name === 'string' ? b.name : '';
    const encoded = typeof b.content_base64 === 'string' ? b.content_base64 : '';
    if (!name || !encoded) return reply.status(400).send({ error: 'name and content_base64 required' });

    let folder = '_probe';
    if (b.probe !== true) {
      const exec = await query(
        `SELECT id, status FROM executions WHERE id::text = $1 OR key = $1`,
        [String(b.execution_id || '')]
      );
      if (!exec.rows[0]) return reply.status(404).send({ error: 'Execution not found' });
      folder = exec.rows[0].id;
    }

    try {
      const saved = saveEvidence(folder, name, Buffer.from(encoded, 'base64'));
      if (typeof b.sha256 === 'string' && b.sha256 && b.sha256 !== saved.sha256) {
        return reply.status(422).send({ error: 'sha256 mismatch — upload corrupted', expected: b.sha256, actual: saved.sha256 });
      }
      return reply.status(201).send({ data: { ...saved, url: evidenceUrl(saved.storage_key) } });
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  // Serve a file by storage_key (resolved inside the evidence store only)
  app.get('/api/v1/evidence/file', async (req, reply) => {
    const q = req.query as { key?: string };
    const key = q.key || '';
    const found = key ? statEvidence(key) : null;
    if (!found) {
      return reply.status(404).send({ error: 'File not found', key: path.basename(key) });
    }
    const type = CONTENT_TYPES[path.extname(found.path).toLowerCase()] || 'application/octet-stream';
    return reply
      .header('x-content-type-options', 'nosniff')
      .type(type)
      .send(createReadStream(found.path));
  });
}
