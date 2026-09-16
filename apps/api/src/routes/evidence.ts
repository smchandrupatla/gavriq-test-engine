/**
 * Evidence listing + static file serve from EVIDENCE_DIR.
 * Workers write screenshots under EVIDENCE_DIR; storage_key is e.g. evidence/fail-….png
 */
import type { FastifyInstance } from 'fastify';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { query } from '../db/client.js';

const EVIDENCE_DIR = process.env.EVIDENCE_DIR || path.resolve(process.cwd(), 'evidence');

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
        data: rows.map((r) => ({
          ...r,
          url: r.storage_key ? `/api/v1/evidence/file?key=${encodeURIComponent(r.storage_key)}` : null,
        })),
      });
    }
  );

  // All evidence for an execution
  app.get<{ Params: { id: string } }>(
    '/api/v1/executions/:id/evidence',
    async (req, reply) => {
      const exec = await query(
        `SELECT id FROM executions WHERE id = $1 OR key = $1`,
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
        data: rows.map((r) => ({
          ...r,
          url: r.storage_key ? `/api/v1/evidence/file?key=${encodeURIComponent(r.storage_key)}` : null,
        })),
      });
    }
  );

  // Serve a file by storage_key (path under EVIDENCE_DIR; only basename-safe keys)
  app.get('/api/v1/evidence/file', async (req, reply) => {
    const q = req.query as { key?: string };
    const key = q.key || '';
    // storage_key like evidence/fail-123.png → file at EVIDENCE_DIR/fail-123.png
    const base = path.basename(key.replace(/^evidence\//, ''));
    if (!base || base.includes('..')) {
      return reply.status(400).send({ error: 'Invalid key' });
    }
    const full = path.join(EVIDENCE_DIR, base);
    if (!existsSync(full)) {
      return reply.status(404).send({ error: 'File not found', path: base });
    }
    const ext = path.extname(base).toLowerCase();
    const type =
      ext === '.png' ? 'image/png' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      ext === '.webp' ? 'image/webp' :
      ext === '.json' ? 'application/json' :
      'application/octet-stream';
    return reply.type(type).send(createReadStream(full));
  });
}
