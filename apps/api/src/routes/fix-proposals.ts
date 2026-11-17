/**
 * AI test-case fixer API — see apps/api/src/run-fix-loop.ts (awaiting_patch
 * phase) for how the auto-fix loop enqueues these, and apps/fixer-agent for
 * the off-engine process that claims them.
 *
 * For the console:
 *   GET  /api/v1/fix-proposals[?run_id=&case_key=&limit=]
 *   GET  /api/v1/fix-proposals/:id
 *   POST /api/v1/fix-proposals/:id/apply     {approver}                  manual apply (propose mode)
 *   POST /api/v1/fix-proposals/:id/reject    {reason}                     operator rejection
 *
 * For the fixer-agent (apps/fixer-agent):
 *   POST /api/v1/fix-proposals/claim         {agent_id} → 200 {data} | 204
 *   POST /api/v1/fix-proposals/:id/progress  {log}
 *   POST /api/v1/fix-proposals/:id/complete  {status, diff, before_source,
 *                                             after_source, rationale,
 *                                             rationale_inputs, classification,
 *                                             signature, commit_sha?}
 *
 * The complete handler is where the engine actually touches the catalog
 * filesystem: when the agent posts a test-side patch, the handler writes it to
 * disk under apps/api/src/catalog/ (the bind-mounted path), reseeds, and
 * transitions the loop out of awaiting_patch so the pending rerun fires. When
 * the agent posts classification='prod_defect', nothing is written — the
 * existing defect pipeline has already filed the defect on the failing
 * execution; the loop parks.
 */
import type { FastifyInstance } from 'fastify';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { query } from '../db/client.js';
import { audit } from '../middleware/rbac.js';
import { recordFixAction, resumeAfterPatch } from '../run-fix-loop.js';
import { findCaseSource } from './catalog-source.js';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../..');
const CATALOG_DIR = resolve(REPO_ROOT, 'apps/api/src/catalog');

/** Reject any attempted write outside the catalog directory. The agent is on
 *  the host and could point source_file anywhere; the engine refuses. */
function withinCatalog(absPath: string): boolean {
  const norm = resolve(absPath);
  return norm.startsWith(CATALOG_DIR + '\\') || norm.startsWith(CATALOG_DIR + '/');
}

async function fixerDiffCap(): Promise<number> {
  try {
    const { rows } = await query<{ n: string }>(`SELECT fixer_agent_diff_cap_lines AS n FROM settings WHERE id = true`);
    const n = Number(rows[0]?.n);
    return Number.isInteger(n) && n > 0 ? n : 400;
  } catch {
    return 400;
  }
}

export async function fixProposalRoutes(app: FastifyInstance) {
  app.get('/api/v1/fix-proposals', async (req, reply) => {
    const q = (req.query as any) || {};
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.run_id) { params.push(q.run_id); where.push(`run_id = $${params.length}`); }
    if (q.case_key) { params.push(q.case_key); where.push(`case_key = $${params.length}`); }
    const limit = Math.min(500, Math.max(1, Number(q.limit) || 100));
    params.push(limit);
    const { rows } = await query(
      `SELECT * FROM fix_proposals ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    return reply.send({ data: rows });
  });

  app.get<{ Params: { id: string } }>('/api/v1/fix-proposals/:id', async (req, reply) => {
    const { rows } = await query(`SELECT * FROM fix_proposals WHERE id::text = $1`, [req.params.id]);
    if (!rows[0]) return reply.status(404).send({ error: 'Fix proposal not found', id: req.params.id });
    return reply.send({ data: rows[0] });
  });

  // --- Agent-facing endpoints -------------------------------------------

  app.post<{ Body: Record<string, unknown> }>('/api/v1/fix-proposals/claim', async (req, reply) => {
    const agentId = typeof req.body?.agent_id === 'string' && req.body.agent_id ? req.body.agent_id : 'fixer-agent';
    // SKIP LOCKED + the fix_proposals_pending_per_case unique index together
    // guarantee at most one agent claims a given case at a time, even if two
    // agents poll on the same tick.
    const { rows } = await query(
      `WITH next AS (
         SELECT id FROM fix_proposals
          WHERE status = 'pending'
          ORDER BY created_at
          LIMIT 1
          FOR UPDATE SKIP LOCKED
       )
       UPDATE fix_proposals p SET status = 'claimed', agent_id = $1, claimed_at = now(), updated_at = now()
       FROM next WHERE p.id = next.id
       RETURNING p.*`,
      [agentId]
    );
    const proposal = rows[0];
    if (!proposal) return reply.status(204).send();

    // Attach everything the agent needs to make a decision in one response:
    //   - the current CaseDef source literal (from catalog-source.ts)
    //   - the originating run's failing-result summary (message, classification,
    //     evidence keys) for the tracked case
    const src = findCaseSource(proposal.case_key);
    const { rows: results } = await query(
      `SELECT er.status, er.message, er.classification, er.remarks, er.started_at, er.finished_at,
              tc.key AS case_key, tc.name AS case_name, tc.test_type::text AS test_type
         FROM execution_results er
         JOIN test_cases tc ON tc.id = er.test_case_id
         JOIN executions e ON e.id = er.execution_id
        WHERE e.metadata->>'run_group' = $1 AND tc.key = $2
        ORDER BY er.finished_at DESC NULLS LAST
        LIMIT 1`,
      [proposal.run_id, proposal.case_key]
    );
    const { rows: evidenceRows } = await query(
      `SELECT ev.evidence_type, ev.storage_key, ev.content_type, ev.size_bytes, ev.metadata
         FROM evidence ev
         JOIN execution_results er ON er.id = ev.execution_result_id
         JOIN executions e ON e.id = er.execution_id
         JOIN test_cases tc ON tc.id = er.test_case_id
        WHERE e.metadata->>'run_group' = $1 AND tc.key = $2
        ORDER BY ev.id DESC LIMIT 10`,
      [proposal.run_id, proposal.case_key]
    );
    return reply.send({
      data: {
        ...proposal,
        source: src,
        failure: results[0] || null,
        evidence: evidenceRows,
        guidance: {
          source_of_truth: 'production',
          max_diff_lines: await fixerDiffCap(),
          atomic_rule: 'Preserve independence, cleanup, pool-based identity, baseline round-trip. See .github/skills/test-case-lifecycle/SKILL.md.',
        },
      },
    });
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/fix-proposals/:id/progress',
    async (req, reply) => {
      const log = typeof req.body?.log === 'string' ? req.body.log.slice(0, 16 * 1024) : null;
      const { rows } = await query(
        `UPDATE fix_proposals SET rationale = COALESCE($2, rationale), updated_at = now()
          WHERE id::text = $1 AND status = 'claimed' RETURNING id, status`,
        [req.params.id, log]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'No claimed proposal with that id' });
      return reply.send({ data: rows[0] });
    }
  );

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/fix-proposals/:id/complete',
    async (req, reply) => {
      const b = req.body || {};
      const status = typeof b.status === 'string' ? b.status : '';
      const classification = typeof b.classification === 'string' ? b.classification : 'unknown';
      if (!['applied', 'rejected', 'failed'].includes(status)) {
        return reply.status(400).send({ error: 'status must be applied | rejected | failed' });
      }
      // Pull the row + lock it so a second concurrent complete call is rejected cleanly.
      const { rows } = await query(
        `SELECT * FROM fix_proposals WHERE id::text = $1 AND status = 'claimed' FOR UPDATE`,
        [req.params.id]
      );
      const proposal = rows[0];
      if (!proposal) return reply.status(404).send({ error: 'No claimed proposal with that id' });

      // Case 1: agent concluded this is a prod defect. Nothing to patch; the
      // defect pipeline has already filed it on the failing execution. Park
      // the loop and move on.
      if (classification === 'prod_defect') {
        await query(
          `UPDATE fix_proposals SET status = 'rejected', classification = $2, rationale = $3,
                                     rationale_inputs = $4::jsonb, reason = $5,
                                     completed_at = now(), updated_at = now()
            WHERE id = $1`,
          [
            proposal.id,
            classification,
            String(b.rationale || '').slice(0, 8000),
            JSON.stringify(b.rationale_inputs || {}),
            `Fixer classified this as a production defect; filed via the defect pipeline. Loop parked.`,
          ]
        );
        await recordFixAction(proposal.run_id, 'park', `Fixer classified ${proposal.case_key} as a production defect; patch refused.`, { case_key: proposal.case_key });
        await query(
          `UPDATE run_fix_loops SET state = 'parked', phase = 'capped', reason = $2, updated_at = now() WHERE run_id = $1 AND state = 'running'`,
          [proposal.run_id, `Prod defect for ${proposal.case_key} — see defect log.`]
        );
        await audit(req, 'fix.prod_defect', 'fix_proposal', proposal.id, { case_key: proposal.case_key });
        return reply.send({ data: { id: proposal.id, status: 'rejected', parked: true } });
      }

      // Case 2: agent gave up (rejected / failed). No file write; the loop
      // falls through to the existing redeploy+rerun path on the next tick.
      if (status === 'rejected' || status === 'failed') {
        await query(
          `UPDATE fix_proposals SET status = $2, classification = $3, rationale = $4,
                                     rationale_inputs = $5::jsonb, reason = $6,
                                     completed_at = now(), updated_at = now()
            WHERE id = $1`,
          [proposal.id, status, classification, String(b.rationale || '').slice(0, 8000),
           JSON.stringify(b.rationale_inputs || {}), String(b.reason || '').slice(0, 500)]
        );
        await recordFixAction(proposal.run_id, 'rerun', `Fixer could not patch ${proposal.case_key}; falling back to redeploy+rerun.`, { case_key: proposal.case_key, agent_status: status });
        await resumeAfterPatch(proposal.run_id, 'rejected');
        return reply.send({ data: { id: proposal.id, status } });
      }

      // Case 3: agent produced a patch to apply. Validate + write.
      const after = typeof b.after_source === 'string' ? b.after_source : '';
      const before = typeof b.before_source === 'string' ? b.before_source : '';
      if (!after || !before) return reply.status(400).send({ error: 'before_source and after_source are required when status=applied' });

      const diffCap = await fixerDiffCap();
      if (typeof b.diff === 'string' && b.diff.split('\n').length > diffCap) {
        await markRejected(proposal.id, 'Diff exceeds configured cap', b);
        await resumeAfterPatch(proposal.run_id, 'rejected');
        return reply.status(413).send({ error: `Diff exceeds fixer_agent_diff_cap_lines (${diffCap})` });
      }

      // Resolve the absolute file path from source_file. The agent reports a
      // repo-relative path like `apps/api/src/catalog/<file>.ts`; refuse
      // anything that resolves outside the catalog directory.
      const absFile = resolve(REPO_ROOT, proposal.source_file);
      if (!withinCatalog(absFile) || !existsSync(absFile)) {
        await markRejected(proposal.id, `Refused source_file ${proposal.source_file}`, b);
        await resumeAfterPatch(proposal.run_id, 'rejected');
        return reply.status(400).send({ error: 'source_file must resolve inside apps/api/src/catalog/' });
      }

      const fileTextBefore = readFileSync(absFile, 'utf8');
      if (!fileTextBefore.includes(before)) {
        await markRejected(proposal.id, 'before_source not found in current file (stale patch?)', b);
        await resumeAfterPatch(proposal.run_id, 'rejected');
        return reply.status(409).send({ error: 'before_source does not match the current file contents' });
      }
      const fileTextAfter = fileTextBefore.replace(before, after);
      // Snapshot the full file so a sibling-regression later can revert this
      // one proposal without replaying every proposal applied in between.
      await query(
        `UPDATE fix_proposals SET
           status = 'applied', classification = $2, rationale = $3, rationale_inputs = $4::jsonb,
           before_source = $5, after_source = $6, diff = $7, signature = $8, commit_sha = $9,
           siblings_snapshot = jsonb_build_object('file_text_before', $10::text),
           completed_at = now(), updated_at = now()
         WHERE id = $1`,
        [
          proposal.id,
          classification,
          String(b.rationale || '').slice(0, 8000),
          JSON.stringify(b.rationale_inputs || {}),
          before,
          after,
          typeof b.diff === 'string' ? b.diff.slice(0, 64 * 1024) : null,
          typeof b.signature === 'string' ? b.signature.slice(0, 128) : null,
          typeof b.commit_sha === 'string' ? b.commit_sha.slice(0, 64) : null,
          fileTextBefore,
        ]
      );

      try {
        writeFileSync(absFile, fileTextAfter, 'utf8');
      } catch (err) {
        await markRejected(proposal.id, `Write failed: ${(err as Error).message}`, b);
        await resumeAfterPatch(proposal.run_id, 'rejected');
        return reply.status(500).send({ error: 'Could not write catalog file', detail: (err as Error).message });
      }

      // Reseed via the same tsx subprocess as /api/v1/ops/seed-sandbench. We
      // do not block the request on it finishing — reseeds take a few seconds
      // and the run-fix-loop tick will requeue the rerun as soon as the loop
      // phase moves out of awaiting_patch (which we do synchronously below).
      spawnReseed();

      await recordFixAction(
        proposal.run_id,
        'rerun',
        `Fixer patched ${proposal.case_key} in ${proposal.source_file}; reseeded and resuming.`,
        { case_key: proposal.case_key, classification, fix_proposal_id: proposal.id }
      );
      await resumeAfterPatch(proposal.run_id, 'applied');
      await audit(req, 'fix.applied', 'fix_proposal', proposal.id, { case_key: proposal.case_key, source_file: proposal.source_file, classification });

      return reply.send({ data: { id: proposal.id, status: 'applied', source_file: proposal.source_file } });
    }
  );

  // --- Human-facing manual actions --------------------------------------

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/v1/fix-proposals/:id/reject',
    async (req, reply) => {
      const reason = String(req.body?.reason || 'Rejected by operator').slice(0, 500);
      const { rows } = await query(
        `UPDATE fix_proposals SET status = 'rejected', reason = $2, completed_at = now(), updated_at = now()
          WHERE id::text = $1 AND status IN ('pending','claimed','applied') RETURNING *`,
        [req.params.id, reason]
      );
      if (!rows[0]) return reply.status(409).send({ error: 'Not a cancellable proposal' });
      const proposal = rows[0];

      // If an applied patch is being rejected, revert the file write.
      if (proposal.before_source && proposal.source_file && proposal.siblings_snapshot?.file_text_before) {
        const absFile = resolve(REPO_ROOT, proposal.source_file);
        if (withinCatalog(absFile) && existsSync(absFile)) {
          try { writeFileSync(absFile, String(proposal.siblings_snapshot.file_text_before), 'utf8'); spawnReseed(); } catch {}
        }
      }
      await recordFixAction(proposal.run_id, 'stop', `Operator rejected proposal for ${proposal.case_key}: ${reason}`, { fix_proposal_id: proposal.id });
      await resumeAfterPatch(proposal.run_id, 'rejected');
      await audit(req, 'fix.rejected', 'fix_proposal', proposal.id, { reason });
      return reply.send({ data: proposal });
    }
  );
}

async function markRejected(id: string, reason: string, b: Record<string, unknown>): Promise<void> {
  await query(
    `UPDATE fix_proposals SET status = 'rejected', reason = $2, rationale = $3, rationale_inputs = $4::jsonb,
                               completed_at = now(), updated_at = now()
      WHERE id = $1`,
    [id, reason.slice(0, 500), String(b.rationale || '').slice(0, 8000), JSON.stringify(b.rationale_inputs || {})]
  );
}

/** Spawn the catalog reseed; fire-and-forget. See apps/api/src/routes/ops.ts. */
function spawnReseed(): void {
  const cwd = REPO_ROOT;
  const child = spawn('npx', ['tsx', 'apps/api/src/seed-realistic-catalog.ts'], {
    cwd,
    env: { ...process.env },
    stdio: 'ignore',
    shell: process.platform === 'win32',
    detached: false,
  });
  child.on('error', (err) => console.warn(`[fix-proposals] reseed spawn failed: ${err.message}`));
  child.unref();
}
