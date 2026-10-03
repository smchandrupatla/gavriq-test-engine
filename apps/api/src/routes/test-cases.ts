import type { FastifyInstance } from 'fastify';
import { query, withTransaction } from '../db/client.js';
import { uniqueName } from '../lib/naming.js';
import { ESTIMATED_DURATIONS, LABEL_PRIORITY, PRIORITY_LABEL, VISIBILITIES } from '../catalog/types.js';
import { narrateStep } from '../catalog/plain-language.js';
import { PRIORITY_LABEL_SQL, etagOf, statusLabel } from './test-bench.js';

/**
 * Test case repository API, answering in the representation the Test cases
 * screen uses (adopted from Sand Bench): every row carries the screen fields
 * (objective, priority label, owner, component, environment, estimated
 * duration, visibility, automation link, test data, attachments, triage,
 * notes, watchers) and the latest run (status, when, how long, where), and
 * the form's camelCase payload is accepted on create/update next to the
 * repository's snake_case columns.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILED = `('failed','error','timed_out')`;
const CASE_KEY = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,119}$/;

/** Case names are unique across the board (case-insensitive); `excludeId` lets a rename check against every other case. */
async function nameExists(name: string, excludeId?: string): Promise<boolean> {
  const { rows } = await query(
    excludeId
      ? `SELECT 1 FROM test_cases WHERE lower(name) = lower($1) AND id <> $2 LIMIT 1`
      : `SELECT 1 FROM test_cases WHERE lower(name) = lower($1) LIMIT 1`,
    excludeId ? [name, excludeId] : [name]
  );
  return rows.length > 0;
}

async function resolveEnvironmentId(v: unknown): Promise<string | null> {
  if (typeof v !== 'string' || !v) return null;
  const { rows } = await query(
    UUID.test(v) ? 'SELECT id FROM environments WHERE id = $1::uuid' : 'SELECT id FROM environments WHERE key = $1',
    [v]
  );
  return rows[0]?.id ?? null;
}

/** The screen's status/priority words and etag, added to a repository row. */
export function caseView(row: any) {
  const lastStatus = row.last_run_status ?? row.last_status ?? null;
  const status = statusLabel(lastStatus);
  const lifecycle = String(row.lifecycle || 'draft');
  return {
    ...row,
    priority_label: PRIORITY_LABEL[String(row.priority)] || 'Medium',
    status: lifecycle === 'draft' || lifecycle === 'ready_for_review' ? 'draft' : lifecycle === 'archived' || lifecycle === 'deprecated' ? 'archived' : 'active',
    run_status: status,
    last_run_result: lastStatus ? (status === 'Passed' ? 'pass' : status === 'Failed' ? 'fail' : status === 'Blocked' ? 'blocked' : lastStatus) : null,
    last_run_status: lastStatus,
    dependency_ids: Array.isArray(row.dependencies) ? row.dependencies : [],
    owner: row.owner_id ?? null,
    etag: etagOf(row),
    flaky: Number(row.recent_run_count || 0) >= 3 && Number(row.recent_failed_count || 0) > 0 && Number(row.recent_failed_count || 0) < Number(row.recent_run_count || 0),
    failure_rate: Number(row.recent_run_count || 0) > 0 ? Number(row.recent_failed_count || 0) / Number(row.recent_run_count) : null,
  };
}

/** Sand Bench form payload (camelCase) and repository columns (snake_case) → one patch. */
function readPayload(b: Record<string, any>) {
  const str = (...keys: string[]) => { for (const k of keys) if (typeof b[k] === 'string') return b[k] as string; return undefined; };
  const arr = (...keys: string[]) => { for (const k of keys) if (Array.isArray(b[k])) return b[k] as unknown[]; return undefined; };
  const priorityRaw = str('priority');
  const priority = priorityRaw ? (LABEL_PRIORITY[priorityRaw as keyof typeof LABEL_PRIORITY] || (/^p[0-4]$/.test(priorityRaw) ? priorityRaw : undefined)) : undefined;
  const statusRaw = str('status', 'lifecycle');
  const lifecycle = statusRaw === 'draft' ? 'draft' : statusRaw === 'active' ? 'active' : statusRaw === 'archived' ? 'archived' : statusRaw;
  const steps = arr('steps')?.map((s: any) =>
    typeof s === 'string'
      ? { text: s, expected: '', testData: '', attachments: [] }
      : { ...s, ...(s.text !== undefined || s.expected !== undefined ? {} : narrateStep(s)) }
  );
  const estimatedDuration = str('estimatedDuration', 'estimated_duration');
  const visibility = str('visibility');
  return {
    key: str('key', 'id'),
    name: str('name', 'title'),
    description: str('description'),
    objective: str('objective'),
    priority,
    severity: str('severity'),
    lifecycle,
    owner: str('owner', 'owner_id'),
    component: str('component'),
    environment: str('environment'),
    estimatedDuration: estimatedDuration && ESTIMATED_DURATIONS.includes(estimatedDuration as any) ? estimatedDuration : estimatedDuration === '' ? null : undefined,
    visibility: visibility && VISIBILITIES.includes(visibility as any) ? visibility : undefined,
    tags: arr('tags')?.map(String),
    preconditions: str('preconditions'),
    steps,
    dependencyIds: arr('dependencyIds', 'dependency_ids', 'dependencies')?.map(String),
    automationLink: str('automationLink', 'automation_link'),
    testData: str('testData', 'test_data'),
    testDataRef: str('test_data_ref'),
    attachments: arr('attachments'),
    flakinessNotes: str('flakinessNotes', 'flakiness_notes'),
    knownWorkarounds: str('knownWorkarounds', 'known_workarounds'),
    commonFailureCauses: str('commonFailureCauses', 'common_failure_causes'),
    expectedResults: str('expected_results', 'expectedResults', 'expected'),
    testType: str('test_type', 'testType'),
    executionMethod: str('execution_method', 'executionMethod', 'method'),
    script: str('script'),
    assertions: arr('assertions'),
    validationRules: b.validation_rules && typeof b.validation_rules === 'object' ? b.validation_rules : undefined,
    timeoutSeconds: Number.isFinite(Number(b.timeout_seconds)) && b.timeout_seconds !== undefined ? Number(b.timeout_seconds) : undefined,
    automationStatus: str('automation_status'),
    changeSummary: str('change_summary', 'changeSummary'),
    actor: str('updated_by', 'created_by', 'author'),
  };
}

export async function testCaseRoutes(app: FastifyInstance) {
  // List with filters — rows carry the Test cases screen fields and the latest run.
  app.get('/api/v1/test-cases', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const clauses: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (q.application_id) { clauses.push(`tc.application_id = $${i++}`); params.push(q.application_id); }
    if (q.application_key) { clauses.push(`tc.application_id = (SELECT id FROM applications WHERE key = $${i++})`); params.push(q.application_key); }
    if (q.lifecycle) { clauses.push(`tc.lifecycle = $${i++}`); params.push(q.lifecycle); }
    if (q.status === 'draft') clauses.push(`tc.lifecycle IN ('draft','ready_for_review')`);
    else if (q.status === 'active') clauses.push(`tc.lifecycle IN ('approved','active','maintenance')`);
    else if (q.status === 'archived') clauses.push(`tc.lifecycle IN ('archived','deprecated')`);
    if (q.test_type) { clauses.push(`tc.test_type = $${i++}`); params.push(q.test_type); }
    if (q.tag) { clauses.push(`$${i++} = ANY(tc.tags)`); params.push(q.tag); }
    if (q.component) { clauses.push(`tc.component = $${i++}`); params.push(q.component); }
    if (q.owner) { clauses.push(`tc.owner_id = $${i++}`); params.push(q.owner); }
    if (q.priority) {
      const p = LABEL_PRIORITY[q.priority as keyof typeof LABEL_PRIORITY] || q.priority;
      clauses.push(`tc.priority::text = $${i++}`); params.push(p);
    }
    if (q.q) {
      clauses.push(`(tc.name ILIKE $${i} OR tc.key ILIKE $${i} OR tc.description ILIKE $${i} OR tc.objective ILIKE $${i} OR $${i + 1} = ANY(tc.tags))`);
      params.push(`%${q.q}%`, q.q);
      i += 2;
    }
    const envId = await resolveEnvironmentId(q.environment_id);
    params.push(envId);
    const envParam = i++;

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Number(q.limit) || 50, 1000);
    const offset = Number(q.offset) || 0;
    // The screen lists ~800 cases: it gets the card columns; full=1 adds steps, scripts and rules.
    const columns = q.full === '1' ? 'tc.*' : `tc.id, tc.key, tc.name, tc.objective, tc.application_id, tc.test_type, tc.execution_method, tc.automation_status,
              tc.priority, tc.severity, tc.lifecycle, tc.tags, tc.owner_id, tc.component, tc.environment, tc.estimated_duration, tc.visibility,
              tc.triage_status, tc.assignee, tc.linked_issue_url, tc.automation_link, tc.dependencies, tc.watchers, tc.version, tc.created_at, tc.updated_at, tc.created_by`;

    const { rows } = await query(
      `SELECT ${columns}, ${PRIORITY_LABEL_SQL} AS priority_label,
              lr.status AS last_run_status, lr.created_at AS last_run_at, lr.duration_ms AS last_run_duration_ms,
              lr.environment_key AS last_run_environment, lr.execution_id AS last_run_execution_id, lr.id AS last_run_id,
              COALESCE(recent.total, 0)::int AS recent_run_count, COALESCE(recent.failed, 0)::int AS recent_failed_count,
              COALESCE(m.suite_ids, '{}') AS suite_ids
       FROM test_cases tc
       LEFT JOIN LATERAL (
         SELECT er.id, er.status, er.created_at, er.duration_ms, er.execution_id, env.key AS environment_key
         FROM execution_results er JOIN executions ex ON ex.id = er.execution_id LEFT JOIN environments env ON env.id = ex.environment_id
         WHERE er.test_case_id = tc.id AND ($${envParam}::uuid IS NULL OR ex.environment_id = $${envParam}::uuid)
         ORDER BY er.created_at DESC LIMIT 1
       ) lr ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS total, count(*) FILTER (WHERE r.status IN ${FAILED}) AS failed
         FROM (SELECT er.status FROM execution_results er JOIN executions ex ON ex.id = er.execution_id
               WHERE er.test_case_id = tc.id AND ($${envParam}::uuid IS NULL OR ex.environment_id = $${envParam}::uuid)
               ORDER BY er.created_at DESC LIMIT 10) r
       ) recent ON true
       LEFT JOIN LATERAL (
         SELECT array_agg(s.test_suite_id::text ORDER BY s.sort_order) AS suite_ids FROM test_case_suites s WHERE s.test_case_id = tc.id
       ) m ON true
       ${where} ORDER BY tc.updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const countRes = await query(`SELECT count(*)::int AS total FROM test_cases tc ${where}`, params.slice(0, -1));
    return reply.send({ data: rows.map(caseView), total: countRes.rows[0]?.total ?? rows.length });
  });

  // Get one — the full definition plus versions, suites and the latest run.
  app.get<{ Params: { id: string } }>('/api/v1/test-cases/:id', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const envId = await resolveEnvironmentId(q.environment_id);
    const { rows } = await query(
      `SELECT tc.*, ${PRIORITY_LABEL_SQL} AS priority_label,
              lr.status AS last_run_status, lr.created_at AS last_run_at, lr.duration_ms AS last_run_duration_ms,
              lr.environment_key AS last_run_environment, lr.execution_id AS last_run_execution_id, lr.id AS last_run_id,
              COALESCE(recent.total, 0)::int AS recent_run_count, COALESCE(recent.failed, 0)::int AS recent_failed_count
       FROM test_cases tc
       LEFT JOIN LATERAL (
         SELECT er.id, er.status, er.created_at, er.duration_ms, er.execution_id, env.key AS environment_key
         FROM execution_results er JOIN executions ex ON ex.id = er.execution_id LEFT JOIN environments env ON env.id = ex.environment_id
         WHERE er.test_case_id = tc.id AND ($2::uuid IS NULL OR ex.environment_id = $2::uuid)
         ORDER BY er.created_at DESC LIMIT 1
       ) lr ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS total, count(*) FILTER (WHERE r.status IN ${FAILED}) AS failed
         FROM (SELECT er.status FROM execution_results er JOIN executions ex ON ex.id = er.execution_id
               WHERE er.test_case_id = tc.id AND ($2::uuid IS NULL OR ex.environment_id = $2::uuid)
               ORDER BY er.created_at DESC LIMIT 10) r
       ) recent ON true
       WHERE tc.id::text = $1 OR tc.key = $1`,
      [req.params.id, envId]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Test case not found' });

    const [versions, suites, application] = await Promise.all([
      query('SELECT id, version, change_summary, created_by, created_at FROM test_case_versions WHERE test_case_id = $1 ORDER BY version DESC', [rows[0].id]),
      query(`SELECT s.id, s.key, s.name, s.suite_type FROM test_suites s JOIN test_case_suites m ON m.test_suite_id = s.id WHERE m.test_case_id = $1 ORDER BY s.name`, [rows[0].id]),
      query('SELECT id, key, name FROM applications WHERE id = $1', [rows[0].application_id]),
    ]);
    return reply.send({ data: { ...caseView(rows[0]), versions: versions.rows, suites: suites.rows, application: application.rows[0] || null } });
  });

  // Create — accepts the Test case form payload (camelCase, priority label, id as Test ID) or repository columns.
  app.post<{ Body: Record<string, unknown> }>('/api/v1/test-cases', async (req, reply) => {
    const b = req.body || {};
    const p = readPayload(b as Record<string, any>);
    let applicationId: string | null = typeof b.application_id === 'string' ? (b.application_id as string) : null;
    if (!applicationId && typeof b.application_key === 'string') {
      const a = await query('SELECT id FROM applications WHERE key = $1', [b.application_key]);
      applicationId = a.rows[0]?.id ?? null;
    }
    if (!p.name || !applicationId) {
      return reply.status(400).send({ error: 'name and application_id (or application_key) are required' });
    }
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'case';
    const key = p.key ? p.key.trim() : `TC-${slug.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    if (!CASE_KEY.test(key)) return reply.status(400).send({ error: 'Test ID must be 3-120 letters, digits, dot, dash or underscore, starting with a letter or digit' });
    const dup = await query('SELECT 1 FROM test_cases WHERE key = $1', [key]);
    if (dup.rows.length) return reply.status(409).send({ error: 'That Test ID is already in use' });

    const name = await uniqueName(p.name, (n) => nameExists(n));

    const row = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO test_cases (
           key, name, description, application_id, component_id, feature_id, requirement_id,
           scenario_id, test_type, test_level, preconditions, dependencies, test_data_ref,
           environment_requirements, execution_location_default, execution_method, script,
           steps, expected_results, assertions, validation_rules, timeout_seconds, retry_policy,
           severity, priority, tags, owner_id, author_id, automation_status, lifecycle,
           created_by, objective, component, environment, estimated_duration, visibility,
           automation_link, test_data, attachments, flakiness_notes, known_workarounds, common_failure_causes
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::test_type,'other'),$10,$11,COALESCE($12,'[]'::jsonb),
           $13,COALESCE($14,'{}'::jsonb),$15,$16,$17,COALESCE($18,'[]'::jsonb),$19,
           COALESCE($20,'[]'::jsonb),COALESCE($21,'{}'::jsonb),COALESCE($22,300),
           COALESCE($23,'{"max":0}'::jsonb),COALESCE($24::severity,'medium'),COALESCE($25::priority,'p2'),
           COALESCE($26::text[],'{}'),$27,$28,COALESCE($29::automation_status,'manual'),
           COALESCE($30::test_lifecycle,'draft'),$31,$32,$33,$34,$35,COALESCE($36,'Team'),
           $37,$38,COALESCE($39,'[]'::jsonb),$40,$41,$42
         ) RETURNING *`,
        [
          key, name, p.description ?? null, applicationId,
          b.component_id ?? null, b.feature_id ?? null, b.requirement_id ?? null,
          b.scenario_id ?? null, p.testType ?? null, b.test_level ?? null,
          p.preconditions ?? null, JSON.stringify(p.dependencyIds ?? []),
          p.testDataRef ?? p.testData ?? null, JSON.stringify(b.environment_requirements ?? {}),
          b.execution_location_default ?? null, p.executionMethod ?? (p.automationLink ? 'manual' : null), p.script ?? null,
          JSON.stringify(p.steps ?? []), p.expectedResults ?? null,
          JSON.stringify(p.assertions ?? []), JSON.stringify(p.validationRules ?? {}),
          p.timeoutSeconds ?? null, JSON.stringify(b.retry_policy ?? { max: 0 }),
          p.severity ?? null, p.priority ?? null, p.tags ?? [],
          p.owner ?? null, p.actor ?? req.actor?.id ?? null, p.automationStatus ?? (p.automationLink ? 'automated' : null),
          p.lifecycle ?? null, p.actor ?? req.actor?.id ?? null,
          p.objective ?? null, p.component ?? null, p.environment ?? null, p.estimatedDuration ?? null, p.visibility ?? null,
          p.automationLink ?? null, p.testData ?? null, p.attachments ? JSON.stringify(p.attachments) : null,
          p.flakinessNotes ?? null, p.knownWorkarounds ?? null, p.commonFailureCauses ?? null,
        ]
      );

      // Initial version snapshot
      await client.query(
        `INSERT INTO test_case_versions (test_case_id, version, snapshot, change_summary, created_by)
         VALUES ($1, 1, $2::jsonb, 'Initial version', $3)`,
        [rows[0].id, JSON.stringify(rows[0]), p.actor ?? req.actor?.id ?? null]
      );

      // Link to suites if provided
      if (Array.isArray(b.suite_ids)) {
        for (let i = 0; i < b.suite_ids.length; i++) {
          await client.query(
            `INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [rows[0].id, b.suite_ids[i], i]
          );
        }
      }

      return rows[0];
    });

    const view = caseView(row);
    return reply.status(201).send({ data: view, id: view.key, etag: view.etag });
  });

  // Update (creates new version) — same payload as create; If-Match (etag) is honoured when sent.
  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/test-cases/:id',
    async (req, reply) => {
      const b = req.body || {};
      const p = readPayload(b as Record<string, any>);
      const existing = await query(
        'SELECT * FROM test_cases WHERE id::text = $1 OR key = $1',
        [req.params.id]
      );
      if (!existing.rows[0]) return reply.status(404).send({ error: 'Test case not found' });

      const tc = existing.rows[0];
      const ifMatch = req.headers['if-match'];
      if (typeof ifMatch === 'string' && ifMatch && ifMatch !== etagOf(tc)) return reply.status(412).send({ error: 'Stale If-Match — the case changed since it was loaded' });
      const newVersion = tc.version + 1;
      const newName =
        typeof p.name === 'string' && p.name && p.name !== tc.name
          ? await uniqueName(p.name, (n) => nameExists(n, tc.id))
          : null;

      const row = await withTransaction(async (client) => {
        const { rows } = await client.query(
          `UPDATE test_cases SET
             name = COALESCE($2, name),
             description = COALESCE($3, description),
             test_type = COALESCE($4::test_type, test_type),
             preconditions = COALESCE($5, preconditions),
             script = COALESCE($6, script),
             steps = COALESCE($7::jsonb, steps),
             assertions = COALESCE($8::jsonb, assertions),
             expected_results = COALESCE($9, expected_results),
             severity = COALESCE($10::severity, severity),
             priority = COALESCE($11::priority, priority),
             tags = COALESCE($12::text[], tags),
             lifecycle = COALESCE($13::test_lifecycle, lifecycle),
             automation_status = COALESCE($14::automation_status, automation_status),
             timeout_seconds = COALESCE($15, timeout_seconds),
             version = $16,
             updated_at = now(),
             updated_by = $17,
             objective = COALESCE($18, objective),
             owner_id = COALESCE($19, owner_id),
             component = COALESCE($20, component),
             environment = COALESCE($21, environment),
             estimated_duration = CASE WHEN $22::text IS NULL THEN estimated_duration ELSE NULLIF($22, '') END,
             visibility = COALESCE($23, visibility),
             dependencies = COALESCE($24::jsonb, dependencies),
             automation_link = COALESCE($25, automation_link),
             test_data = COALESCE($26, test_data),
             attachments = COALESCE($27::jsonb, attachments),
             flakiness_notes = COALESCE($28, flakiness_notes),
             known_workarounds = COALESCE($29, known_workarounds),
             common_failure_causes = COALESCE($30, common_failure_causes),
             execution_method = COALESCE($31, execution_method),
             validation_rules = COALESCE($32::jsonb, validation_rules),
             test_data_ref = COALESCE($33, test_data_ref)
           WHERE id = $1
           RETURNING *`,
          [
            tc.id, newName, p.description ?? null, p.testType ?? null,
            p.preconditions ?? null, p.script ?? null,
            p.steps ? JSON.stringify(p.steps) : null,
            p.assertions ? JSON.stringify(p.assertions) : null,
            p.expectedResults ?? null, p.severity ?? null, p.priority ?? null,
            p.tags ?? null, p.lifecycle ?? null, p.automationStatus ?? null,
            p.timeoutSeconds ?? null, newVersion, p.actor ?? req.actor?.id ?? null,
            p.objective ?? null, p.owner ?? null, p.component ?? null, p.environment ?? null,
            p.estimatedDuration === undefined ? null : (p.estimatedDuration ?? ''), p.visibility ?? null,
            p.dependencyIds ? JSON.stringify(p.dependencyIds) : null,
            p.automationLink ?? null, p.testData ?? null, p.attachments ? JSON.stringify(p.attachments) : null,
            p.flakinessNotes ?? null, p.knownWorkarounds ?? null, p.commonFailureCauses ?? null,
            p.executionMethod ?? null, p.validationRules ? JSON.stringify(p.validationRules) : null, p.testDataRef ?? null,
          ]
        );

        await client.query(
          `INSERT INTO test_case_versions (test_case_id, version, snapshot, change_summary, created_by)
           VALUES ($1,$2,$3::jsonb,$4,$5)`,
          [tc.id, newVersion, JSON.stringify(rows[0]), p.changeSummary ?? `Version ${newVersion}`, p.actor ?? req.actor?.id ?? null]
        );

        return rows[0];
      });

      return reply.send({ data: caseView(row) });
    }
  );

  // Clone ("New from this case")
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/test-cases/:id/clone',
    async (req, reply) => {
      const { rows } = await query(
        'SELECT * FROM test_cases WHERE id::text = $1 OR key = $1',
        [req.params.id]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Test case not found' });

      const src = rows[0];
      const newKey = (req.body as any)?.key || `${src.key}-clone-${Date.now().toString(36)}`;
      const newName = await uniqueName(`Clone of ${src.name}`, (n) => nameExists(n));
      const { rows: created } = await query(
        `INSERT INTO test_cases (
           key, name, description, application_id, component_id, feature_id, requirement_id,
           test_type, test_level, preconditions, dependencies, script, steps, assertions,
           expected_results, severity, priority, tags, automation_status, lifecycle, author_id, created_by,
           objective, owner_id, component, environment, estimated_duration, visibility, automation_link,
           test_data, test_data_ref, attachments, flakiness_notes, known_workarounds, common_failure_causes,
           execution_method, validation_rules, timeout_seconds
         )
         SELECT $2, $3, description, application_id, component_id, feature_id, requirement_id,
                test_type, test_level, preconditions, dependencies, script, steps, assertions,
                expected_results, severity, priority, tags, automation_status, 'draft', $4, $4,
                objective, owner_id, component, environment, estimated_duration, visibility, automation_link,
                test_data, test_data_ref, attachments, flakiness_notes, known_workarounds, common_failure_causes,
                execution_method, validation_rules, timeout_seconds
         FROM test_cases WHERE id = $1
         RETURNING *`,
        [src.id, newKey, newName, (req.body as any)?.created_by ?? req.actor?.id ?? null]
      );

      return reply.status(201).send({ data: caseView(created[0]) });
    }
  );
}
