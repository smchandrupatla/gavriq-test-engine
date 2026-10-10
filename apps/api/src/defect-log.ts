/**
 * Defect log — every failure the engine logs, and every defect a person raises by hand,
 * kept with its lifecycle until it is handed to the implementation manager.
 *
 *   logged ──► validated ──► sent      (the implementation manager receives it)
 *     │            │
 *     └──► rejected ◄┘ ──► logged      (reopened for another look)
 *
 * Auto-logged defects arrive when a run's execution is ingested (defects/service.ts).
 * Their Defect Manager report is held until a person sends it, unless the application
 * has auto-approve switched on, in which case it is sent at once. Sending releases the
 * report to the product manager's queue; a manual defect gets its report when it is sent.
 */
import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { query, withTransaction } from './db/client.js';
import { evidenceUrl } from './evidence-store.js';
import { reportKey } from './defects/core.js';

export const LOG_STATUSES = ['logged', 'validated', 'rejected', 'sent'] as const;
export type LogStatus = (typeof LOG_STATUSES)[number];
export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const ATTACHMENT_KINDS = ['screenshot', 'log', 'other'] as const;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const MOVES: Record<LogStatus, LogStatus[]> = {
  logged: ['validated', 'rejected'],
  validated: ['rejected', 'sent'],
  rejected: ['logged'],
  sent: [],
};

/** May a defect move from one status to another. Sending is its own action, never a PATCH. */
export function canMoveLog(from: LogStatus, to: LogStatus): boolean {
  return from === to || MOVES[from].includes(to);
}

export function isLogStatus(v: unknown): v is LogStatus {
  return typeof v === 'string' && (LOG_STATUSES as readonly string[]).includes(v);
}

export function isSeverity(v: unknown): boolean {
  return typeof v === 'string' && (SEVERITIES as readonly string[]).includes(v);
}

/** The attachment bytes from base64, refusing anything over the limit. */
export function decodeAttachment(dataBase64: string): Buffer {
  const bytes = Buffer.from(dataBase64, 'base64');
  if (!bytes.length) throw new LogError(400, 'attachment is empty');
  if (bytes.length > MAX_ATTACHMENT_BYTES) throw new LogError(413, `attachment is larger than ${MAX_ATTACHMENT_BYTES} bytes`);
  return bytes;
}

export class LogError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

type Db = Pick<pg.PoolClient, 'query'>;

function historyEntry(by: string, action: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify([{ at: new Date().toISOString(), by, action, ...extra }]);
}

export async function autoApproveFor(db: Db, applicationKey: string | null | undefined): Promise<boolean> {
  if (!applicationKey) return false;
  const { rows } = await db.query(
    `SELECT COALESCE((metadata->>'defect_auto_approve')::boolean, false) AS on FROM applications WHERE key = $1`,
    [applicationKey]
  );
  return Boolean(rows[0]?.on);
}

export interface AutoLogInput {
  applicationKey: string;
  defectId: string;
  defectReportId: string;
  /** The report is held for a person to send (auto-approve is off). */
  held: boolean;
  executionId: string | null;
  executionResultId: string | null;
  testCaseId: string | null;
  caseKey: string;
  caseName: string;
  severity: string;
  message: string;
  runId: string | null;
  environmentId: string | null;
  loggedBy: string;
}

/** Log one defect the engine found. Its screenshots and logs come along as attachments. */
export async function logAutoDefect(db: Db, a: AutoLogInput): Promise<string> {
  const { rows: apps } = await db.query(`SELECT id FROM applications WHERE key = $1`, [a.applicationKey]);
  const applicationId = apps[0]?.id;
  if (!applicationId) throw new LogError(404, `application ${a.applicationKey} not found`);

  let envKey: string | null = null;
  let version = 'not recorded';
  if (a.environmentId) {
    const { rows: envs } = await db.query(`SELECT key, config FROM environments WHERE id = $1`, [a.environmentId]);
    envKey = envs[0]?.key ?? null;
    const dep = envs[0]?.config?.deployment ?? {};
    version = dep.version || dep.commit || 'not recorded';
  }

  // Pull the test case's intent and expected result so the implementation manager has the
  // full picture — what was being checked, what should have happened, and what did.
  let context = '';
  if (a.testCaseId) {
    const { rows: tcs } = await db.query(
      `SELECT objective, expected_results FROM test_cases WHERE id = $1`,
      [a.testCaseId]
    );
    const tc = tcs[0];
    if (tc?.objective) context += `\n\nWhat the test checks: ${tc.objective}`;
    if (tc?.expected_results) context += `\n\nExpected result: ${tc.expected_results}`;
  }

  const sentAt = a.held ? null : new Date();
  const { rows } = await db.query(
    `INSERT INTO defect_log (key, application_id, title, description, severity, status, origin, test_case_id, case_key,
                             run_id, execution_id, execution_result_id, environment_id, environment_key,
                             application_version, failure_message, defect_report_id, defect_id, logged_by,
                             sent_by, sent_at)
     VALUES ('DL-' || lpad(nextval('defect_log_key_seq')::text, 6, '0'), $1, $2, $3, $4, $5, 'auto', $6, $7,
             $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING id`,
    [
      applicationId,
      `${a.caseName} — ${a.severity} failure`,
      `Logged automatically from run ${a.runId ?? 'unknown'}. The case "${a.caseName}" failed with: ${a.message}${context}`,
      a.severity,
      a.held ? 'logged' : 'sent',
      a.testCaseId,
      a.caseKey,
      a.runId,
      a.executionId,
      a.executionResultId,
      a.environmentId,
      envKey,
      version,
      a.message,
      a.defectReportId,
      a.defectId,
      a.loggedBy,
      a.held ? null : 'auto-approve',
      sentAt,
    ]
  );
  const logId = rows[0].id as string;

  // System log: the failure text as the engine recorded it.
  await db.query(
    `INSERT INTO defect_log_attachments (defect_log_id, kind, name, content_type, size_bytes, sha256, content, created_by)
     VALUES ($1, 'log', 'failure-log.txt', 'text/plain; charset=utf-8', $2, $3, $4, $5)`,
    [logId, Buffer.byteLength(a.message), sha256(a.message), Buffer.from(a.message), a.loggedBy]
  );
  // Screenshots and other evidence recorded for the failing case in the same run.
  if (a.executionResultId) {
    await db.query(
      `INSERT INTO defect_log_attachments (defect_log_id, kind, name, content_type, size_bytes, sha256, evidence_id, created_by)
       SELECT $1,
              CASE WHEN ev.evidence_type::text ILIKE '%screenshot%' THEN 'screenshot'
                   WHEN ev.evidence_type::text ILIKE '%log%' THEN 'log' ELSE 'other' END,
              ev.evidence_type::text, ev.content_type, COALESCE(ev.size_bytes, 0), ev.metadata->>'sha256', ev.id, $3
         FROM evidence ev WHERE ev.execution_result_id = $2`,
      [logId, a.executionResultId, a.loggedBy]
    );
  }
  return logId;
}

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

// ------------------------------------------------------------------ settings

export interface ImplementationManager {
  name: string;
  contact?: string;
}

export interface AppDefectSettings {
  application: string;
  auto_approve: boolean;
  implementation_manager: ImplementationManager | null;
}

/** Read the implementation manager and auto-approve configured for an application. */
export async function getAutoApprove(appKey: string): Promise<AppDefectSettings | null> {
  const { rows } = await query(
    `SELECT key, COALESCE((metadata->>'defect_auto_approve')::boolean, false) AS on,
            metadata->'implementation_manager' AS im
       FROM applications WHERE key = $1`,
    [appKey]
  );
  if (!rows[0]) return null;
  return {
    application: rows[0].key,
    auto_approve: Boolean(rows[0].on),
    implementation_manager: normalizeManager(rows[0].im),
  };
}

function normalizeManager(raw: unknown): ImplementationManager | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = String((raw as any).name ?? '').trim();
  if (!name) return null;
  const contact = String((raw as any).contact ?? '').trim();
  return contact ? { name, contact } : { name };
}

/** Name the implementation manager who receives this application's defects (or clear it with null). */
export async function setImplementationManager(appKey: string, manager: ImplementationManager | null): Promise<AppDefectSettings> {
  const value = manager && manager.name?.trim() ? normalizeManager(manager) : null;
  const { rows } = await query(
    `UPDATE applications
        SET metadata = CASE WHEN $2::jsonb IS NULL
                            THEN COALESCE(metadata, '{}'::jsonb) - 'implementation_manager'
                            ELSE COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('implementation_manager', $2::jsonb) END,
            updated_at = now()
      WHERE key = $1
      RETURNING key`,
    [appKey, value ? JSON.stringify(value) : null]
  );
  if (!rows[0]) throw new LogError(404, `application ${appKey} not found`);
  return (await getAutoApprove(appKey))!;
}

/** Turn auto-approve on or off for an application. Held reports stay held: a person releases them. */
export async function setAutoApprove(appKey: string, on: boolean): Promise<AppDefectSettings> {
  const { rows } = await query(
    `UPDATE applications
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('defect_auto_approve', $2::boolean),
            updated_at = now()
      WHERE key = $1
      RETURNING key`,
    [appKey, on]
  );
  if (!rows[0]) throw new LogError(404, `application ${appKey} not found`);
  return (await getAutoApprove(appKey))!;
}

// ------------------------------------------------------------------ CRUD

export interface ListFilter {
  application?: string;
  status?: string;
  run_id?: string;
  origin?: string;
  environment?: string;
  limit?: number;
}

export async function listDefectLog(f: ListFilter) {
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (f.application) {
    params.push(f.application);
    clauses.push(`a.key = $${params.length}`);
  }
  if (f.status) {
    params.push(f.status);
    clauses.push(`dl.status = $${params.length}`);
  }
  if (f.run_id) {
    params.push(f.run_id);
    clauses.push(`dl.run_id = $${params.length}`);
  }
  if (f.origin) {
    params.push(f.origin);
    clauses.push(`dl.origin = $${params.length}`);
  }
  if (f.environment) {
    params.push(f.environment);
    clauses.push(`(dl.environment_key = $${params.length} OR dl.environment_id::text = $${params.length})`);
  }
  params.push(Math.min(Math.max(f.limit || 200, 1), 1000));
  const { rows } = await query(
    `SELECT dl.id, dl.key, a.key AS application, dl.title, dl.severity, dl.status, dl.origin, dl.case_key,
            dl.run_id, dl.environment_key, dl.application_version, dl.logged_by, dl.validated_by, dl.sent_by,
            dl.sent_at, dl.implementation_manager, dl.rejected_reason, dl.created_at, dl.updated_at,
            (SELECT count(*)::int FROM defect_log_attachments att WHERE att.defect_log_id = dl.id) AS attachments
       FROM defect_log dl JOIN applications a ON a.id = dl.application_id
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY dl.created_at DESC
       LIMIT $${params.length}`,
    params
  );
  return rows;
}

export async function getDefectLog(id: string) {
  const { rows } = await query(
    `SELECT dl.*, a.key AS application, a.name AS application_name,
            a.metadata->'implementation_manager' AS app_implementation_manager,
            tc.name AS case_name, tc.objective AS case_objective, tc.preconditions AS case_preconditions,
            tc.steps AS case_steps, tc.expected_results AS case_expected,
            d.status AS defect_status, d.assignee AS defect_assignee, d.fix_ref AS defect_fix_ref, d.key AS defect_key,
            dr.status AS report_status, dr.claimed_by AS report_claimed_by, dr.key AS report_key
       FROM defect_log dl
       JOIN applications a ON a.id = dl.application_id
       LEFT JOIN test_cases tc ON tc.id = dl.test_case_id
       LEFT JOIN defects d ON d.id = dl.defect_id
       LEFT JOIN defect_reports dr ON dr.id = dl.defect_report_id
      WHERE dl.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const { rows: attachments } = await query(
    `SELECT att.id, att.kind, att.name, att.content_type, att.size_bytes, att.sha256, att.created_by, att.created_at,
            (att.evidence_id IS NOT NULL) AS from_run, ev.storage_key
       FROM defect_log_attachments att
       LEFT JOIN evidence ev ON ev.id = att.evidence_id
      WHERE att.defect_log_id = $1
      ORDER BY att.created_at`,
    [id]
  );
  return {
    ...rows[0],
    attachments: attachments.map(({ storage_key, ...rest }: any) => ({
      ...rest,
      url: rest.from_run && storage_key ? evidenceUrl(storage_key) : `/api/v1/defect-log/attachments/${rest.id}`,
    })),
  };
}

export interface CreateInput {
  application: string;
  title: string;
  description?: string;
  severity?: string;
  case_key?: string | null;
  environment?: string | null;
  application_version?: string | null;
  run_id?: string | null;
}

export async function createManual(input: CreateInput, by: string) {
  if (!input.title?.trim()) throw new LogError(400, 'title is required');
  const severity = input.severity ?? 'medium';
  if (!isSeverity(severity)) throw new LogError(400, `severity must be one of ${SEVERITIES.join(', ')}`);
  const { rows: apps } = await query(`SELECT id FROM applications WHERE key = $1`, [input.application]);
  if (!apps[0]) throw new LogError(404, `application ${input.application} not found`);
  const caseRow = input.case_key
    ? (await query(`SELECT id, key FROM test_cases WHERE key = $1 AND application_id = $2`, [input.case_key, apps[0].id])).rows[0]
    : null;
  if (input.case_key && !caseRow) throw new LogError(404, `test case ${input.case_key} not found in ${input.application}`);
  const env = input.environment
    ? (await query(`SELECT id, key, config FROM environments WHERE key = $1 OR id::text = $1`, [input.environment])).rows[0]
    : null;
  if (input.environment && !env) throw new LogError(404, `environment ${input.environment} not found`);
  const dep = env?.config?.deployment ?? {};
  const { rows } = await query(
    `INSERT INTO defect_log (key, application_id, title, description, severity, status, origin, test_case_id, case_key,
                             run_id, environment_id, environment_key, application_version, logged_by)
     VALUES ('DL-' || lpad(nextval('defect_log_key_seq')::text, 6, '0'), $1, $2, $3, $4, 'logged', 'manual', $5, $6,
             $7, $8, $9, $10, $11)
     RETURNING id, key`,
    [
      apps[0].id, input.title.trim(), input.description ?? '', severity, caseRow?.id ?? null, caseRow?.key ?? null,
      input.run_id ?? null, env?.id ?? null, env?.key ?? null,
      input.application_version || dep.version || dep.commit || 'not recorded', by,
    ]
  );
  return rows[0]!;
}

export interface PatchInput {
  title?: string;
  description?: string;
  severity?: string;
  case_key?: string | null;
  application_version?: string;
  status?: string;
  rejected_reason?: string;
}

export async function updateDefectLog(id: string, patch: PatchInput, by: string) {
  return withTransaction(async (db) => {
    const { rows } = await db.query(`SELECT * FROM defect_log WHERE id = $1 FOR UPDATE`, [id]);
    const cur = rows[0];
    if (!cur) throw new LogError(404, 'defect not found');

    const sets: string[] = [];
    const params: unknown[] = [id];
    const set = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };

    if (patch.title !== undefined) {
      if (!patch.title.trim()) throw new LogError(400, 'title cannot be empty');
      set('title', patch.title.trim());
    }
    if (patch.description !== undefined) set('description', patch.description);
    if (patch.application_version !== undefined) set('application_version', patch.application_version || 'not recorded');
    if (patch.severity !== undefined) {
      if (!isSeverity(patch.severity)) throw new LogError(400, `severity must be one of ${SEVERITIES.join(', ')}`);
      set('severity', patch.severity);
    }
    if (patch.case_key !== undefined) {
      const c = patch.case_key
        ? (await db.query(`SELECT id, key FROM test_cases WHERE key = $1 AND application_id = $2`, [patch.case_key, cur.application_id])).rows[0]
        : null;
      if (patch.case_key && !c) throw new LogError(404, `test case ${patch.case_key} not found`);
      set('test_case_id', c?.id ?? null);
      set('case_key', c?.key ?? null);
    }
    if (patch.status !== undefined) {
      if (!isLogStatus(patch.status) || patch.status === 'sent') {
        throw new LogError(400, 'status can be set to logged, validated or rejected; sending is a separate action');
      }
      if (!canMoveLog(cur.status, patch.status)) {
        throw new LogError(409, `a ${cur.status} defect cannot move to ${patch.status}`);
      }
      if (patch.status !== cur.status) {
        if (patch.status === 'validated') {
          set('validated_by', by);
          sets.push('validated_at = now()');
        }
        if (patch.status === 'rejected') {
          const reason = patch.rejected_reason?.trim();
          if (!reason) throw new LogError(400, 'rejected_reason is required to reject a defect');
          set('rejected_reason', reason);
        }
        set('status', patch.status);
      }
    }
    if (!sets.length) return cur;
    sets.push('updated_at = now()');
    const { rows: updated } = await db.query(`UPDATE defect_log SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
    return updated[0];
  });
}

export async function deleteDefectLog(id: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM defect_log WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

// --------------------------------------------------------- implementation managers

/** The implementation managers already named on any application, so one can be reused. */
export async function listManagers(): Promise<ImplementationManager[]> {
  const { rows } = await query(
    `SELECT DISTINCT metadata->'implementation_manager' AS im
       FROM applications WHERE metadata ? 'implementation_manager'`
  );
  const seen = new Set<string>();
  const out: ImplementationManager[] = [];
  for (const r of rows) {
    const m = normalizeManager(r.im);
    if (m && !seen.has(m.name.toLowerCase())) {
      seen.add(m.name.toLowerCase());
      out.push(m);
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ------------------------------------------------------------------ comments

export async function listComments(id: string) {
  const { rows } = await query(
    `SELECT id, author, body, created_at FROM defect_log_comments WHERE defect_log_id = $1 ORDER BY created_at`,
    [id]
  );
  return rows;
}

export async function addComment(id: string, body: string, author: string) {
  if (!body?.trim()) throw new LogError(400, 'comment body is required');
  const { rows: exists } = await query(`SELECT 1 FROM defect_log WHERE id = $1`, [id]);
  if (!exists[0]) throw new LogError(404, 'defect not found');
  const { rows } = await query(
    `INSERT INTO defect_log_comments (defect_log_id, author, body) VALUES ($1, $2, $3)
     RETURNING id, author, body, created_at`,
    [id, author || 'operator', body.trim().slice(0, 4000)]
  );
  return rows[0]!;
}

// ------------------------------------------------------------------ timeline

export interface TimelineItem {
  at: string;
  by: string;
  kind: 'comment' | 'event';
  action: string;
  detail?: string;
}

/** The whole life of a defect as one conversation: the engine logging it, the review on the
 *  test side, the hand-off, then everything the implementation manager and reruns did to it,
 *  interleaved with the manual comments people added. */
export async function getTimeline(id: string): Promise<TimelineItem[]> {
  const { rows } = await query(
    `SELECT dl.key, dl.created_at, dl.logged_by, dl.origin, dl.run_id, dl.validated_at, dl.validated_by,
            dl.rejected_reason, dl.sent_at, dl.sent_by, dl.implementation_manager, dl.updated_at,
            dl.defect_id, dl.defect_report_id, d.history AS defect_history, dr.history AS report_history
       FROM defect_log dl
       LEFT JOIN defects d ON d.id = dl.defect_id
       LEFT JOIN defect_reports dr ON dr.id = dl.defect_report_id
      WHERE dl.id = $1`,
    [id]
  );
  const dl = rows[0];
  if (!dl) throw new LogError(404, 'defect not found');

  const items: TimelineItem[] = [];
  const ev = (at: string | null, by: string | null, action: string, detail?: string) => {
    if (at) items.push({ at: new Date(at).toISOString(), by: by || '—', kind: 'event', action, detail });
  };

  ev(dl.created_at, dl.logged_by, dl.origin === 'auto' ? 'Logged by the engine' : 'Raised by hand',
    dl.run_id ? `Run ${dl.run_id}` : undefined);
  ev(dl.validated_at, dl.validated_by, 'Validated on the test side');
  if (dl.rejected_reason) ev(dl.updated_at, null, 'Rejected', dl.rejected_reason);
  ev(dl.sent_at, dl.sent_by, 'Sent to the implementation manager',
    dl.implementation_manager ? `To ${dl.implementation_manager}` : 'To the application queue');

  // The implementation-manager side of the loop: claim, fix, rerun, verify or reopen.
  const histories: Array<{ src: string; h: any }> = [];
  if (Array.isArray(dl.report_history)) histories.push({ src: 'report', h: dl.report_history });
  if (Array.isArray(dl.defect_history)) histories.push({ src: 'defect', h: dl.defect_history });
  for (const { h } of histories) {
    for (const e of h) {
      if (!e?.at) continue;
      const detailBits = [e.reason, e.fix_ref ? `fix: ${e.fix_ref}` : null, e.execution ? `run ${e.execution}` : null]
        .filter(Boolean)
        .join(' · ');
      items.push({ at: new Date(e.at).toISOString(), by: e.by || '—', kind: 'event', action: labelAction(e.action), detail: detailBits || undefined });
    }
  }

  for (const c of await listComments(id)) {
    items.push({ at: new Date(c.created_at).toISOString(), by: c.author, kind: 'comment', action: 'Comment', detail: c.body });
  }

  items.sort((a, b) => a.at.localeCompare(b.at));
  return items;
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Report created',
  opened: 'Defect opened',
  released: 'Released to the implementation manager',
  claimed: 'Picked up by the implementation manager',
  with_pm: 'Picked up by the implementation manager',
  fixing: 'Implementation manager started fixing',
  fixed: 'Marked fixed by the implementation manager',
  reopened: 'Reopened',
  regressed: 'Regressed in a later run',
  verified: 'Fix verified by a rerun',
  rerun_verified: 'Rerun passed — fix verified',
  rerun_reopened: 'Rerun failed — reopened',
  seen_again: 'Seen again in a run',
};
function labelAction(a: string): string {
  if (!a) return 'Update';
  return ACTION_LABELS[a] ?? a.replace(/_/g, ' ');
}

// ------------------------------------------------------------------ bulk

export const BULK_ACTIONS = ['delete', 'send', 'validate', 'reject'] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

export function isBulkAction(v: unknown): v is BulkAction {
  return typeof v === 'string' && (BULK_ACTIONS as readonly string[]).includes(v);
}

/** Apply one action to many defects, reporting per-id success so the UI can show what stuck. */
export async function bulkAction(action: BulkAction, ids: string[], by: string, reason?: string) {
  const done: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  for (const id of ids) {
    try {
      if (action === 'delete') {
        if (!(await deleteDefectLog(id))) throw new LogError(404, 'defect not found');
      } else if (action === 'send') {
        await sendToManager(id, by);
      } else if (action === 'validate') {
        await updateDefectLog(id, { status: 'validated' }, by);
      } else if (action === 'reject') {
        await updateDefectLog(id, { status: 'rejected', rejected_reason: reason || 'Rejected in bulk' }, by);
      }
      done.push(id);
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { action, done: done.length, failed };
}

// ------------------------------------------------------------------ dashboard

/** One defect_log row as the dashboard reads it: its lifecycle status and the status of
 *  the downstream defect, once it has been sent to the implementation manager. */
export interface DashRow {
  log_status: string;
  application: string;
  environment: string | null;
  severity: string;
  defect_status: string | null;
}

/** A sent defect's lane: in_progress until the implementation manager reports a fix, then
 *  fixed, then verified once a rerun confirms it. Anything not sent yet is not_sent. */
export type ProgressLane = 'not_sent' | 'in_progress' | 'fixed' | 'verified';

function laneOf(r: DashRow): ProgressLane {
  if (r.log_status !== 'sent') return 'not_sent';
  if (r.defect_status === 'verified') return 'verified';
  if (r.defect_status === 'fixed') return 'fixed';
  return 'in_progress';
}

interface Group {
  name: string;
  total: number;
  logged: number;
  validated: number;
  rejected: number;
  sent: number;
  not_sent: number;
  in_progress: number;
  fixed: number;
  verified: number;
}

function emptyGroup(name: string): Group {
  return { name, total: 0, logged: 0, validated: 0, rejected: 0, sent: 0, not_sent: 0, in_progress: 0, fixed: 0, verified: 0 };
}

/** Roll raw rows up into the counts the dashboard draws: lifecycle status, fix progress,
 *  and both split per application and per environment. Pure, so it is tested without a DB. */
export function rollupDashboard(rows: DashRow[]) {
  const by_status: Record<string, number> = { logged: 0, validated: 0, rejected: 0, sent: 0 };
  const by_severity: Record<string, number> = {};
  const progress: Record<ProgressLane, number> = { not_sent: 0, in_progress: 0, fixed: 0, verified: 0 };
  const apps = new Map<string, Group>();
  const envs = new Map<string, Group>();

  const tally = (map: Map<string, Group>, key: string, r: DashRow, lane: ProgressLane) => {
    let g = map.get(key);
    if (!g) { g = emptyGroup(key); map.set(key, g); }
    g.total++;
    if (r.log_status in g) (g as any)[r.log_status]++;
    g[lane]++;
  };

  for (const r of rows) {
    by_status[r.log_status] = (by_status[r.log_status] ?? 0) + 1;
    const sev = r.severity || 'unknown';
    by_severity[sev] = (by_severity[sev] ?? 0) + 1;
    const lane = laneOf(r);
    progress[lane]++;
    tally(apps, r.application, r, lane);
    tally(envs, r.environment || 'not recorded', r, lane);
  }
  const sorted = (m: Map<string, Group>) => [...m.values()].sort((a, b) => b.total - a.total);
  return {
    total: rows.length,
    by_status,
    by_severity,
    progress,
    open: progress.not_sent + progress.in_progress,
    done: progress.fixed + progress.verified,
    by_application: sorted(apps),
    by_environment: sorted(envs),
  };
}

export async function dashboardStats(f: { application?: string; environment?: string }) {
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (f.application) {
    params.push(f.application);
    clauses.push(`a.key = $${params.length}`);
  }
  if (f.environment) {
    params.push(f.environment);
    clauses.push(`(dl.environment_key = $${params.length} OR dl.environment_id::text = $${params.length})`);
  }
  const { rows } = await query(
    `SELECT dl.status AS log_status, a.key AS application, dl.environment_key AS environment,
            dl.severity, d.status AS defect_status
       FROM defect_log dl
       JOIN applications a ON a.id = dl.application_id
       LEFT JOIN defects d ON d.id = dl.defect_id
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}`,
    params
  );
  return rollupDashboard(rows as DashRow[]);
}

// ------------------------------------------------------------------ attachments

export async function addAttachment(id: string, a: { name: string; kind?: string; content_type?: string; data_base64: string }, by: string) {
  if (!a.name?.trim()) throw new LogError(400, 'name is required');
  const kind = a.kind ?? 'other';
  if (!(ATTACHMENT_KINDS as readonly string[]).includes(kind)) throw new LogError(400, `kind must be one of ${ATTACHMENT_KINDS.join(', ')}`);
  const bytes = decodeAttachment(a.data_base64 || '');
  const { rows: exists } = await query(`SELECT 1 FROM defect_log WHERE id = $1`, [id]);
  if (!exists[0]) throw new LogError(404, 'defect not found');
  const { rows } = await query(
    `INSERT INTO defect_log_attachments (defect_log_id, kind, name, content_type, size_bytes, sha256, content, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, kind, name, content_type, size_bytes, sha256, created_at`,
    [id, kind, a.name.trim().slice(0, 200), a.content_type || 'application/octet-stream', bytes.length, sha256(bytes), bytes, by]
  );
  return rows[0]!;
}

export async function getAttachment(attId: string) {
  const { rows } = await query(
    `SELECT att.name, att.content_type, att.content, ev.storage_key
       FROM defect_log_attachments att LEFT JOIN evidence ev ON ev.id = att.evidence_id
      WHERE att.id = $1`,
    [attId]
  );
  return rows[0] ?? null;
}

export async function deleteAttachment(attId: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM defect_log_attachments WHERE id = $1`, [attId]);
  return (rowCount ?? 0) > 0;
}

// ------------------------------------------------------------------ sending

/**
 * Send a defect to the implementation manager. A defect logged by the engine already has
 * its report: sending releases it to the product manager's queue. A manual defect gets a
 * report and a defect row now, so it can be tracked the same way.
 */
export async function sendToManager(id: string, by: string) {
  return withTransaction(async (db) => {
    const { rows } = await db.query(
      `SELECT dl.*, a.key AS application_key, a.metadata->'implementation_manager' AS im
         FROM defect_log dl JOIN applications a ON a.id = dl.application_id
        WHERE dl.id = $1 FOR UPDATE OF dl`,
      [id]
    );
    const cur = rows[0];
    if (!cur) throw new LogError(404, 'defect not found');
    if (cur.status === 'sent') throw new LogError(409, 'this defect was already sent');
    if (cur.status === 'rejected') throw new LogError(409, 'a rejected defect must be reopened before it is sent');

    const manager = normalizeManager(cur.im);
    const managerName = manager?.name ?? null;
    const route = { defect_log: cur.key, application: cur.application_key, implementation_manager: managerName };

    let reportId: string | null = cur.defect_report_id;
    let defectId: string | null = cur.defect_id;
    if (!reportId) {
      const rkey = reportKey(new Date(), randomUUID().replace(/-/g, ''));
      const { rows: reports } = await db.query(
        `INSERT INTO defect_reports (key, source, status, held, application_key, history)
         VALUES ($1, 'manual', 'open', false, $2, $3::jsonb) RETURNING id`,
        [rkey, cur.application_key, historyEntry(by, 'created', route)]
      );
      reportId = reports[0].id as string;
      const { rows: seq } = await db.query<{ n: string }>(`SELECT nextval('defect_key_seq')::text AS n`);
      const dkey = `DEF-${String(seq[0]!.n).padStart(5, '0')}`;
      const { rows: caseNames } = cur.test_case_id
        ? await db.query(`SELECT name FROM test_cases WHERE id = $1`, [cur.test_case_id])
        : { rows: [] as any[] };
      const { rows: defects } = await db.query(
        `INSERT INTO defects (key, report_id, fingerprint, test_case_id, case_key, case_name, test_type, category,
                              severity, status, message, history)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, 'manual', $7, 'open', $8, $9::jsonb) RETURNING id`,
        [
          dkey, reportId, sha256(`manual:${cur.id}`), cur.test_case_id, cur.case_key ?? 'MANUAL',
          caseNames[0]?.name ?? cur.title, cur.severity, cur.description || cur.title,
          historyEntry(by, 'opened', { defect_log: cur.key }),
        ]
      );
      defectId = defects[0].id as string;
    } else {
      await db.query(
        `UPDATE defect_reports
            SET held = false, application_key = COALESCE(application_key, $3), updated_at = now(),
                history = history || $2::jsonb
          WHERE id = $1`,
        [reportId, historyEntry(by, 'released', route), cur.application_key]
      );
    }

    const { rows: sent } = await db.query(
      `UPDATE defect_log
          SET status = 'sent', sent_by = $2, sent_at = now(), defect_report_id = $3, defect_id = $4,
              implementation_manager = $5, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [id, by, reportId, defectId, managerName]
    );
    return sent[0];
  });
}

// ------------------------------------------------------------------ backfill

/**
 * Log the defects that were ingested before the defect log existed. Each becomes an auto
 * entry: sent if its report already reached the manager, otherwise logged for a person.
 */
export async function backfill(by: string): Promise<{ logged: number }> {
  const { rows } = await query(
    `SELECT d.id AS defect_id, d.case_key, d.case_name, d.severity, d.message, d.execution_id, d.execution_result_id,
            d.test_case_id, dr.id AS report_id, dr.held, e.metadata->>'application_key' AS application_key,
            e.metadata->>'run_group' AS run_id, e.environment_id
       FROM defects d
       JOIN defect_reports dr ON dr.id = d.report_id
       LEFT JOIN executions e ON e.id = d.execution_id
       LEFT JOIN defect_log dl ON dl.defect_id = d.id
      WHERE dl.id IS NULL AND e.metadata->>'application_key' IS NOT NULL`
  );
  let logged = 0;
  for (const r of rows) {
    await withTransaction((db) =>
      logAutoDefect(db, {
        applicationKey: r.application_key,
        defectId: r.defect_id,
        defectReportId: r.report_id,
        held: Boolean(r.held),
        executionId: r.execution_id,
        executionResultId: r.execution_result_id,
        testCaseId: r.test_case_id,
        caseKey: r.case_key,
        caseName: r.case_name,
        severity: r.severity,
        message: r.message,
        runId: r.run_id,
        environmentId: r.environment_id,
        loggedBy: by,
      })
    );
    logged++;
  }
  return { logged };
}
