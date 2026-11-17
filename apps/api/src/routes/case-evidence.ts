/**
 * What a test case runs and what each run proved.
 *   GET /api/v1/test-cases/:id/definition  script/source behind the case, or why it has none
 *   GET /api/v1/test-cases/:id/results     run history for the case with evidence links
 *   GET /api/v1/catalog-audit              every case classified; placeholders listed
 */
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../db/client.js';
import { classifyCase, resolveDefinition } from '../case-definition.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export function evidenceUrl(storageKey: string | null | undefined): string | null {
  return storageKey ? `/api/v1/evidence/file?key=${encodeURIComponent(storageKey)}` : null;
}

export async function caseEvidenceRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/api/v1/test-cases/:id/definition', async (req, reply) => {
    const { rows } = await query(
      'SELECT id, key, execution_method, script, steps, validation_rules FROM test_cases WHERE id::text = $1 OR key = $1',
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Test case not found' });
    return reply.send({ data: { test_case_id: rows[0].id, key: rows[0].key, ...resolveDefinition(rows[0], root) } });
  });

  app.get<{ Params: { id: string } }>('/api/v1/test-cases/:id/results', async (req, reply) => {
    const q = req.query as { limit?: string };
    const limit = Math.min(Math.max(Number(q.limit) || 25, 1), 100);
    const tc = await query('SELECT id FROM test_cases WHERE id::text = $1 OR key = $1', [req.params.id]);
    if (!tc.rows[0]) return reply.status(404).send({ error: 'Test case not found' });
    const { rows } = await query(
      `SELECT er.id, er.execution_id, er.status, er.verdict, er.duration_ms, er.started_at, er.finished_at,
              er.message, er.classification, er.metrics,
              e.key AS execution_key, e.test_suite_id, s.name AS suite_name, e.trigger_source,
              COALESCE((SELECT json_agg(json_build_object(
                  'id', ev.id, 'evidence_type', ev.evidence_type, 'storage_key', ev.storage_key,
                  'content_type', ev.content_type, 'size_bytes', ev.size_bytes, 'metadata', ev.metadata)
                ORDER BY ev.created_at) FROM evidence ev WHERE ev.execution_result_id = er.id), '[]') AS evidence
       FROM execution_results er
       JOIN executions e ON e.id = er.execution_id
       LEFT JOIN test_suites s ON s.id = e.test_suite_id
       WHERE er.test_case_id = $1
       ORDER BY er.created_at DESC
       LIMIT ${limit}`,
      [tc.rows[0].id]
    );
    return reply.send({
      data: rows.map((r) => ({
        ...r,
        evidence: (r.evidence as Array<{ storage_key: string }>).map((e) => ({ ...e, url: evidenceUrl(e.storage_key) })),
      })),
    });
  });

  app.get('/api/v1/catalog-audit', async (_req, reply) => {
    const { rows } = await query(
      `SELECT id, key, name, test_type, execution_method, script, steps, validation_rules,
              automation_status, created_by, tags
       FROM test_cases ORDER BY key`
    );
    const byKind: Record<string, number> = {};
    const placeholders: unknown[] = [];
    const stale: unknown[] = [];
    for (const r of rows) {
      const cls = classifyCase(r);
      let kind: string = cls.kind;
      let reason = cls.reason;
      // SIT rows are only real when the file and the named test still exist in this build.
      if (cls.kind === 'sit-file') {
        const def = resolveDefinition(r, root);
        if (!def.executable) { kind = 'stale-sit'; reason = def.reason; }
      }
      byKind[kind] = (byKind[kind] || 0) + 1;
      const row = {
        id: r.id, key: r.key, name: r.name, test_type: r.test_type,
        execution_method: r.execution_method, automation_status: r.automation_status,
        created_by: r.created_by, reason,
      };
      if (kind === 'placeholder') placeholders.push(row);
      else if (kind === 'stale-sit') stale.push(row);
    }
    return reply.send({
      data: {
        total: rows.length,
        executable: rows.length - placeholders.length - stale.length,
        by_kind: byKind,
        placeholders,
        stale,
      },
    });
  });
}
