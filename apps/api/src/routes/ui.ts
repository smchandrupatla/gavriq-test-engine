import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { currentDeployLoop } from '../deploy-loop.js';
import { currentCycle } from '../cycle-run.js';

/**
 * Lean read models for the unified console (apps/api/public/catalog).
 *
 * The console used to boot from ~12 calls returning full rows (scripts, steps,
 * evidence). These endpoints return only what the tiles, nav and tables draw;
 * details (case body, run evidence, history) are fetched lazily on demand.
 *
 *   GET  /api/v1/ui/summary          envs, application, suites — NO per-case rows
 *   GET  /api/v1/ui/overview-stats   build summary + per-type status rollup (opening Overview)
 *   GET  /api/v1/ui/catalog-counts   per-type and per-suite counts (sidebar numbers)
 *   GET  /api/v1/ui/cases            paged, filterable case list (type/suite/method/tag/search)
 *   GET  /api/v1/ui/live?since=      poll: executions with progress, workers, case statuses changed since
 *   GET  /api/v1/ui/runs             full, paginated, filterable run history (environment/status/date range)
 *   GET  /api/v1/ui/executions/:id   run screen: per-case results without evidence bodies
 *   POST /api/v1/ui/history          tile graph: per-run pass/fail for a set of cases
 *   GET  /api/v1/ui/build-history    tile graph: per-build pass/fail for in-container results
 *
 * summary, live, overview-stats and history take environment_id (id or key): case
 * statuses and run history are then those recorded on that environment only.
 *
 * Lazy-loading contract: the console no longer preloads the whole case catalog
 * on boot. The sidebar paints from /catalog-counts (a few KB), the Overview
 * paints its tiles from /overview-stats (per-type rollup), and every per-type
 * / per-suite / per-method / per-tag / search view fetches its page from
 * /ui/cases on demand.
 */

const ACTIVE = `('queued','preparing','running')`;
const FAILED = `('failed','error','timed_out')`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: Set<string> = new Set([
  'queued', 'preparing', 'running', 'passed', 'failed', 'skipped', 'blocked', 'cancelled', 'error', 'timed_out',
]);

function clampInt(v: unknown, def: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : def;
}

function parseSince(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * A case's status is a fact about one deployment: the same case can pass on
 * staging and fail on development. Accepts an environment id or key; an
 * unknown or absent value means "latest result on any environment".
 */
async function resolveEnvironmentId(v: unknown): Promise<string | null> {
  if (typeof v !== 'string' || !v) return null;
  const { rows } = await query(
    UUID.test(v) ? 'SELECT id FROM environments WHERE id = $1::uuid' : 'SELECT id FROM environments WHERE key = $1',
    [v]
  );
  return rows[0]?.id ?? null;
}

// In-memory classification cache keyed by application_key. Entries hold the
// classified-type for every case id, so /ui/cases and /ui/catalog-counts can
// skip the typeOfCase recomputation on every call. Invalidated by a 60 s TTL
// and whenever a seeded catalog_sig changes.
type ClassifyCache = {
  signature: string;
  computedAt: number;
  typeByCaseId: Map<string, string>;
  suiteIdsByCaseId: Map<string, string[]>;
  tagsByCaseId: Map<string, string[]>;
  byType: Record<string, number>;
  bySuite: Record<string, number>;
  total: number;
};
const classifyCache = new Map<string, ClassifyCache>();
const CLASSIFY_TTL_MS = 60_000;

async function buildClassifyCache(appKey: string): Promise<ClassifyCache> {
  const [appRows, caseRows, suiteRows, sigRow] = await Promise.all([
    query(
      `SELECT COALESCE(metadata->'types', metadata->'sandbench_types', '[]'::jsonb) AS types
       FROM applications WHERE key = $1`,
      [appKey]
    ),
    query(
      `SELECT tc.id, tc.tags,
              COALESCE(array_agg(s.test_suite_id ORDER BY s.sort_order) FILTER (WHERE s.test_suite_id IS NOT NULL), '{}') AS suite_ids
       FROM test_cases tc
       LEFT JOIN test_case_suites s ON s.test_case_id = tc.id
       WHERE tc.application_id = (SELECT id FROM applications WHERE key = $1)
         AND tc.lifecycle NOT IN ('archived','deprecated')
       GROUP BY tc.id, tc.tags`,
      [appKey]
    ),
    query(
      `SELECT id, key, suite_type FROM test_suites
       WHERE application_id = (SELECT id FROM applications WHERE key = $1)`,
      [appKey]
    ),
    query(
      `SELECT (SELECT count(*) FROM test_cases)::text || ':' ||
              COALESCE((SELECT max(updated_at) FROM test_cases)::text, '') AS sig`
    ),
  ]);

  const appTypes: Array<{ key?: string }> = (appRows.rows[0]?.types ?? []) as any;
  const typeKeyOrder = appTypes.map((t) => String(t?.key || '')).filter(Boolean);
  const typeKeySet = new Set(typeKeyOrder);
  const suiteById = new Map<string, { suite_type: string | null; key: string | null }>();
  for (const s of suiteRows.rows as any[]) suiteById.set(s.id, { suite_type: s.suite_type, key: s.key });

  const typeByCaseId = new Map<string, string>();
  const suiteIdsByCaseId = new Map<string, string[]>();
  const tagsByCaseId = new Map<string, string[]>();
  const byType: Record<string, number> = {};
  const bySuite: Record<string, number> = {};

  for (const row of caseRows.rows as any[]) {
    const tags: string[] = (row.tags || []).map((t: unknown) => String(t));
    const suiteIds: string[] = row.suite_ids || [];
    suiteIdsByCaseId.set(row.id, suiteIds);
    tagsByCaseId.set(row.id, tags);
    const tagSet = new Set(tags.map((t) => t.toLowerCase()));
    let t: string;
    if (tagSet.has('sit')) t = 'sit';
    else {
      t = '';
      for (const sid of suiteIds) {
        const s = suiteById.get(sid);
        if (!s) continue;
        const st = String(s.suite_type || '');
        if (typeKeySet.has(st)) { t = st; break; }
        const k = String(s.key || '');
        if (k.startsWith('sb-')) {
          const parts = k.split('-');
          if (parts.length >= 2 && typeKeySet.has(parts[1]!)) { t = parts[1]!; break; }
        }
      }
      if (!t) {
        for (const tk of typeKeyOrder) {
          if (tagSet.has(tk.toLowerCase())) { t = tk; break; }
        }
      }
      if (!t) t = 'other';
    }
    typeByCaseId.set(row.id, t);
    byType[t] = (byType[t] || 0) + 1;
    for (const sid of suiteIds) bySuite[sid] = (bySuite[sid] || 0) + 1;
  }

  return {
    signature: sigRow.rows[0]?.sig ?? '',
    computedAt: Date.now(),
    typeByCaseId,
    suiteIdsByCaseId,
    tagsByCaseId,
    byType,
    bySuite,
    total: caseRows.rows.length,
  };
}

async function getClassifyCache(appKey: string): Promise<ClassifyCache> {
  const cached = classifyCache.get(appKey);
  if (cached && Date.now() - cached.computedAt < CLASSIFY_TTL_MS) return cached;
  const fresh = await buildClassifyCache(appKey);
  classifyCache.set(appKey, fresh);
  return fresh;
}

export async function uiRoutes(app: FastifyInstance) {
  // Catalog counts — the single source of truth for the sidebar, Overview tiles
  // and every "how many of X" badge. Payload is tiny (a few KB) regardless of
  // how many thousand cases the app has, so it loads instantly and the sidebar
  // paints before the full case list arrives.
  //
  // The per-type classification mirrors the client's typeOfCase() exactly:
  //   1. tag "sit" -> type "sit"
  //   2. suite's suite_type matches an application type -> that type
  //   3. suite.key starts with "sb-<type>-" -> that type
  //   4. any tag matches an application type (iteration order of app.types) -> that type
  //   5. else "other"
  app.get('/api/v1/ui/catalog-counts', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';
    const c = await getClassifyCache(appKey);
    reply.header('Cache-Control', 'private, max-age=10');
    return reply.send({ data: { total: c.total, by_type: c.byType, by_suite: c.bySuite } });
  });

  // Paged, filterable list of cases for one view (type page, suite page, search,
  // method filter, tag filter, scope-picker typeahead).
  //
  // The server classifies by the same typeOfCase rules the counts endpoint uses,
  // so a request for type_id=apiPortalIntegration returns the portal cases
  // whose generic DB test_type is "integration" but whose suite_type is the
  // specific portal one.
  //
  // Any combination of (type_id, suite_id, execution_method, tag, q) narrows
  // the result; omitting them all returns every case for the app (paged).
  app.get('/api/v1/ui/cases', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';
    const typeId = (q.type_id || '').trim();
    const suiteId = (q.suite_id || '').trim();
    const method = (q.execution_method || '').trim().toLowerCase();
    const tag = (q.tag || '').trim().toLowerCase();
    const search = (q.q || '').trim();
    const envId = await resolveEnvironmentId(q.environment_id);
    const limit = Math.max(1, Math.min(500, Number(q.limit) || 50));
    const offset = Math.max(0, Number(q.offset) || 0);

    // Classification uses the per-app cache; the first call populates it, every
    // subsequent call reads instantly.
    const classify = await getClassifyCache(appKey);

    // Candidate case ids after filtering by type_id / suite_id / tag — we only
    // hit Postgres for the compact card data of the final page, not for
    // everything. Method is applied in the final SQL (it is a column on
    // test_cases) so the candidate set does not need the method as a filter.
    const candidateIds: string[] = [];
    for (const [id, type] of classify.typeByCaseId) {
      if (typeId && type !== typeId) continue;
      if (suiteId) {
        const sids = classify.suiteIdsByCaseId.get(id) || [];
        if (!sids.includes(suiteId)) continue;
      }
      if (tag) {
        const tags = classify.tagsByCaseId.get(id) || [];
        if (!tags.some((t) => t.toLowerCase() === tag)) continue;
      }
      candidateIds.push(id);
    }

    // Server-side search works against name+key via a parameterised ILIKE so
    // Postgres can use its indexes; the server fetches names only for the
    // narrowed candidate set. The method filter is pushed into the same hit
    // query so we only pay for one scan instead of a two-step narrowing.
    const needle = search ? `%${search.replace(/[%_\\]/g, (m) => '\\' + m)}%` : null;
    let ids = candidateIds;
    if (needle || method) {
      const where: string[] = ['id = ANY($1::uuid[])'];
      const args: unknown[] = [candidateIds];
      if (needle) { where.push(`(name ILIKE $${args.length + 1} OR key ILIKE $${args.length + 1})`); args.push(needle); }
      if (method) { where.push(`lower(execution_method) = $${args.length + 1}`); args.push(method); }
      const { rows: hits } = await query(
        `SELECT id FROM test_cases WHERE ${where.join(' AND ')}`,
        args
      );
      const hitSet = new Set((hits as any[]).map((r) => r.id));
      ids = candidateIds.filter((id) => hitSet.has(id));
    }

    const total = ids.length;
    const pageIds = ids.slice(offset, offset + limit);
    if (!pageIds.length) return reply.send({ data: [], total });

    const { rows } = await query(
      `SELECT tc.id, tc.key, tc.name, tc.tags, tc.test_type, tc.execution_method,
              COALESCE(array_agg(s.test_suite_id ORDER BY s.sort_order) FILTER (WHERE s.test_suite_id IS NOT NULL), '{}') AS suite_ids,
              lr.status AS last_status, COALESCE(lr.finished_at, lr.created_at) AS last_at, lr.duration_ms AS last_duration_ms
       FROM test_cases tc
       LEFT JOIN test_case_suites s ON s.test_case_id = tc.id
       LEFT JOIN LATERAL (
         SELECT er.status, er.finished_at, er.created_at, er.duration_ms
         FROM execution_results er JOIN executions ex ON ex.id = er.execution_id
         WHERE er.test_case_id = tc.id AND ($2::uuid IS NULL OR ex.environment_id = $2::uuid)
         ORDER BY er.created_at DESC LIMIT 1
       ) lr ON true
       WHERE tc.id = ANY($1::uuid[])
       GROUP BY tc.id, lr.status, lr.finished_at, lr.created_at, lr.duration_ms
       ORDER BY tc.key`,
      [pageIds, envId]
    );
    return reply.send({ data: rows, total });
  });

  // Lean summary: environments, application metadata, suite names — the few
  // things every view needs to render chrome (sidebar sections, env selector,
  // scope pickers). The ~12 k-case lateral-join that used to live here has
  // moved to /ui/overview-stats and /ui/cases, which only run when the user
  // opens a view that needs their data.
  app.get('/api/v1/ui/summary', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';
    const envId = await resolveEnvironmentId(q.environment_id);

    const [suites, envs, application, nowRow] = await Promise.all([
      query(
        `SELECT id, key, name, suite_type FROM test_suites
         WHERE application_id = (SELECT id FROM applications WHERE key = $1)
         ORDER BY name`,
        [appKey]
      ),
      query(
        `SELECT id, key, name, env_type, base_url, config->'deployment' AS deployment,
                CASE WHEN config->'infra'->>'driver' = 'compose' THEN config->'infra' END AS infra
         FROM environments
         WHERE status = 'active'
           AND (NOT (config ? 'applications') OR config->'applications' ? $1)
         ORDER BY name`,
        [appKey]
      ),
      query(
        `SELECT id, key, name, metadata->'sandbench_types' AS types
         FROM applications WHERE key = $1`,
        [appKey]
      ),
      query(`SELECT now() AS now`),
    ]);

    reply.header('Cache-Control', 'private, max-age=5');
    return reply.send({
      data: {
        now: nowRow.rows[0]?.now,
        application: application.rows[0] || null,
        environment_id: envId,
        suites: suites.rows,
        environments: envs.rows,
      },
    });
  });

  /**
   * Overview-stats: the per-type pass/fail/other/never rollup the Overview
   * tiles draw, plus the latest build summary and the 7-day run stats.
   * Fetched only when the user opens Overview — a single pre-aggregated query
   * instead of streaming every case row to the client.
   */
  app.get('/api/v1/ui/overview-stats', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';
    const envId = await resolveEnvironmentId(q.environment_id);

    const classify = await getClassifyCache(appKey);
    const caseIds = [...classify.typeByCaseId.keys()];
    const typeByCaseId = classify.typeByCaseId;

    // Server-side rollup: one lateral join per case to find its last status,
    // then group by the classified type. Returning per-type aggregates (not
    // 12k rows) keeps the payload at a few hundred bytes however big the
    // catalog gets.
    const [statusRows, build, stats] = await Promise.all([
      caseIds.length
        ? query(
            `SELECT tc.id AS case_id, lr.status AS last_status,
                    COALESCE(lr.finished_at, lr.created_at) AS last_at
             FROM test_cases tc
             LEFT JOIN LATERAL (
               SELECT er.status, er.finished_at, er.created_at
               FROM execution_results er
               JOIN executions ex ON ex.id = er.execution_id
               WHERE er.test_case_id = tc.id
                 AND ($2::uuid IS NULL OR ex.environment_id = $2::uuid)
               ORDER BY er.created_at DESC LIMIT 1
             ) lr ON true
             WHERE tc.id = ANY($1::uuid[])`,
            [caseIds, envId]
          )
        : Promise.resolve({ rows: [] as any[] }),
      query(
        `WITH latest AS (
           SELECT build_id FROM build_test_results WHERE application_key = $1
           GROUP BY build_id ORDER BY max(reported_at) DESC LIMIT 1
         )
         SELECT b.build_id, max(b.reported_at) AS reported_at, max(b.commit_sha) AS commit_sha,
                max(b.branch) AS branch, count(*)::int AS total,
                count(*) FILTER (WHERE b.status = 'passed')::int AS passed,
                count(*) FILTER (WHERE b.status IN ('failed','error'))::int AS failed,
                count(*) FILTER (WHERE lower(COALESCE(b.suite,'')) = 'unit' OR b.test_key LIKE 'unit%')::int AS unit_total,
                count(*) FILTER (WHERE (lower(COALESCE(b.suite,'')) = 'unit' OR b.test_key LIKE 'unit%') AND b.status = 'passed')::int AS unit_passed
         FROM build_test_results b JOIN latest l ON l.build_id = b.build_id
         WHERE b.application_key = $1
         GROUP BY b.build_id`,
        [appKey]
      ),
      query(
        `SELECT (SELECT count(*)::int FROM execution_results
                 WHERE status IN ${FAILED} AND created_at > now() - interval '7 days') AS failed_7d,
                (SELECT count(*)::int FROM executions
                 WHERE created_at > now() - interval '7 days') AS runs_7d`
      ),
    ]);

    type TypeRollup = {
      total: number;
      passed: number;
      failed: number;
      other: number;
      never: number;
      lastAt: string | null;
    };
    const byType: Record<string, TypeRollup> = {};
    const bump = (t: string): TypeRollup => {
      let r = byType[t];
      if (!r) { r = { total: 0, passed: 0, failed: 0, other: 0, never: 0, lastAt: null }; byType[t] = r; }
      return r;
    };
    // Seed every known type with zeros so a type that only has unrun cases
    // still shows up with a correct `never` count.
    for (const t of classify.typeByCaseId.values()) bump(t);
    const FAILED_SET = new Set(['failed', 'error', 'timed_out']);
    const statusByCase = new Map<string, { status: string | null; last_at: string | null }>();
    for (const r of statusRows.rows as any[]) statusByCase.set(r.case_id, { status: r.last_status, last_at: r.last_at });
    for (const [caseId, t] of typeByCaseId) {
      const r = bump(t);
      r.total += 1;
      const s = statusByCase.get(caseId);
      const status = s?.status;
      const lastAt = s?.last_at ?? null;
      if (!status) r.never += 1;
      else if (status === 'passed') r.passed += 1;
      else if (FAILED_SET.has(String(status))) r.failed += 1;
      else r.other += 1;
      if (lastAt && (!r.lastAt || lastAt > r.lastAt)) r.lastAt = lastAt;
    }

    reply.header('Cache-Control', 'private, max-age=5');
    return reply.send({
      data: {
        now: new Date().toISOString(),
        build: build.rows[0] || null,
        stats: { failed_7d: stats.rows[0]?.failed_7d ?? 0, runs_7d: stats.rows[0]?.runs_7d ?? 0 },
        by_type: byType,
      },
    });
  });

  app.get('/api/v1/ui/live', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';
    const limit = clampInt(q.limit, 50, 200);
    const since = parseSince(q.since);
    const envId = await resolveEnvironmentId(q.environment_id);

    const [executions, workers, changed, sig, envDeployment] = await Promise.all([
      query(
        `SELECT e.id, e.key, e.name, e.status, e.trigger_source, e.test_suite_id, e.worker_id,
                e.environment_id,
                (SELECT env.name FROM environments env WHERE env.id = e.environment_id) AS environment_name,
                e.created_at, e.started_at, e.finished_at,
                cardinality(e.test_case_ids)::int AS total,
                COALESCE(r.done, 0)::int AS done,
                COALESCE(r.passed, 0)::int AS passed,
                COALESCE(r.failed, 0)::int AS failed,
                GREATEST(e.started_at, r.last_at) AS last_activity_at,
                CASE WHEN e.status IN ${ACTIVE} THEN e.test_case_ids END AS case_ids,
                CASE WHEN e.status = 'running' THEN (
                  SELECT u.cid FROM unnest(e.test_case_ids) WITH ORDINALITY AS u(cid, ord)
                  WHERE NOT EXISTS (
                    SELECT 1 FROM execution_results x WHERE x.execution_id = e.id AND x.test_case_id = u.cid
                  )
                  ORDER BY u.ord LIMIT 1
                ) END AS current_case_id
         FROM executions e
         LEFT JOIN LATERAL (
           SELECT count(*) AS done,
                  count(*) FILTER (WHERE status = 'passed') AS passed,
                  count(*) FILTER (WHERE status IN ${FAILED}) AS failed,
                  max(created_at) AS last_at
           FROM execution_results WHERE execution_id = e.id
         ) r ON true
         WHERE (e.status IN ${ACTIVE}
            OR e.id IN (SELECT id FROM executions WHERE ($2::uuid IS NULL OR environment_id = $2::uuid) AND metadata->>'application_key' = $3 ORDER BY created_at DESC LIMIT $1))
            AND ($2::uuid IS NULL OR e.environment_id = $2::uuid)
            AND e.metadata->>'application_key' = $3
         ORDER BY e.created_at DESC`,
        [limit, envId, appKey]
      ),
      query(
        // A worker whose heartbeat is stale is offline no matter what it last
        // reported — dozens of dead registrations otherwise show "online" forever.
        `SELECT id, name,
                CASE WHEN last_heartbeat IS NULL OR last_heartbeat < now() - interval '60 seconds'
                     THEN 'offline' ELSE status END AS status,
                last_heartbeat, current_load
         FROM workers ORDER BY name`
      ),
      since
        ? query(
            // Margin covers results whose insert committed after an earlier poll's snapshot.
            `SELECT DISTINCT ON (er.test_case_id)
                    er.test_case_id, er.status, COALESCE(er.finished_at, er.created_at) AS last_at, er.duration_ms
             FROM execution_results er
             JOIN executions ex ON ex.id = er.execution_id
             WHERE er.created_at > $1::timestamptz - interval '10 seconds'
               AND ($2::uuid IS NULL OR ex.environment_id = $2::uuid)
             ORDER BY er.test_case_id, er.created_at DESC`,
            [since, envId]
          )
        : Promise.resolve({ rows: [] as any[] }),
      query(
        `SELECT now() AS now,
                (SELECT count(*) FROM test_cases)::text || ':' ||
                COALESCE((SELECT max(updated_at) FROM test_cases)::text, '') || ':' ||
                (SELECT count(*) FROM test_suites)::text || ':' ||
                (SELECT count(*) FROM test_case_suites)::text || ':' ||
                COALESCE((SELECT max(reported_at) FROM build_test_results WHERE application_key = $1)::text, '')
                  AS catalog_sig`,
        [appKey]
      ),
      // The selected environment's stack state (config.deployment: up/down/deploying…) so the console's
      // chip follows a deploy or teardown without reloading the summary.
      envId
        ? query(`SELECT config->'deployment' AS deployment, key FROM environments WHERE id = $1::uuid`, [envId])
        : Promise.resolve({ rows: [] as any[] }),
    ]);

    // Deploy-failure loop for this app+env (if one is open): the console banners
    // it, so the user sees retries in flight and the parked state at the cap.
    const envKey = envDeployment.rows[0]?.key as string | undefined;
    const [deployLoop, cycleRun] = envKey
      ? await Promise.all([currentDeployLoop(appKey, envKey), currentCycle(appKey, envKey)])
      : [null, null];

    return reply.send({
      data: {
        now: sig.rows[0]?.now,
        catalog_sig: sig.rows[0]?.catalog_sig,
        executions: executions.rows,
        workers: workers.rows,
        changed: changed.rows,
        environment_deployment: envId ? (envDeployment.rows[0]?.deployment ?? null) : undefined,
        environment_deploy_loop: envId ? deployLoop : undefined,
        environment_cycle_run: envId ? cycleRun : undefined,
      },
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/ui/executions/:id', async (req, reply) => {
    // Resolve the id to either a single execution or every execution in a
    // run_group. Grouped lookup lets a UI link to a run (one row per
    // metadata.run_group) open the aggregate view with cases from every worker.
    const { rows: groupMembers } = await query(
      `SELECT * FROM executions WHERE metadata->>'run_group' = $1 ORDER BY created_at`,
      [req.params.id]
    );
    let execs: any[];
    if (groupMembers.length) {
      execs = groupMembers;
    } else {
      const { rows: solo } = await query(
        `SELECT * FROM executions WHERE id::text = $1 OR key = $1`,
        [req.params.id]
      );
      if (!solo.length) return reply.status(404).send({ error: 'Execution not found' });
      execs = solo;
    }
    // Hydrate environment + suite names for the first execution; the rest share them.
    const first = execs[0];
    const { rows: envRows } = await query(
      `SELECT env.name AS environment_name, env.key AS environment_key, s.name AS suite_name
         FROM executions e
         LEFT JOIN environments env ON env.id = e.environment_id
         LEFT JOIN test_suites s ON s.id = e.test_suite_id
        WHERE e.id = $1`,
      [first.id]
    );
    const chrome = envRows[0] || {};
    // Union the planned case ids across every execution in the group so the
    // run shows every case the operator queued, not just the first worker's slice.
    const allCaseIds = Array.from(new Set(
      (execs as any[]).flatMap((e: any) => (e.test_case_ids || [])).map(String)
    ));
    const execIds = (execs as any[]).map((e: any) => e.id);
    // One result row per (test_case_id) across every execution in the group.
    // DISTINCT ON picks the latest result (ORDER BY created_at DESC).
    const [results, cases] = await Promise.all([
      query(
        `SELECT DISTINCT ON (er.test_case_id)
                er.id, er.test_case_id, er.status, er.duration_ms, er.message, er.classification, er.remarks, er.verdict,
                er.started_at, COALESCE(er.finished_at, er.created_at) AS finished_at,
                er.execution_id,
                (SELECT count(*)::int FROM evidence ev WHERE ev.execution_result_id = er.id) AS evidence_count
         FROM execution_results er
         WHERE er.execution_id = ANY($1::uuid[])
         ORDER BY er.test_case_id, er.created_at DESC`,
        [execIds]
      ),
      query(`SELECT id, key, name, execution_method FROM test_cases WHERE id = ANY($1::uuid[])`, [allCaseIds]),
    ]);

    // The "primary" execution carries the chrome (status + started/finished).
    // For a run_group we aggregate the status across its members.
    const anyActive = (execs as any[]).some((e: any) => ['queued','preparing','running','claiming'].includes(e.status));
    const anyFailed = (execs as any[]).some((e: any) => ['failed','error','timed_out'].includes(e.status));
    const allCancelled = (execs as any[]).every((e: any) => e.status === 'cancelled');
    const groupStatus = anyActive ? 'running' : anyFailed ? 'failed' : allCancelled ? 'cancelled' : 'passed';
    const minCreated = (execs as any[]).reduce((min: any, e: any) => !min || new Date(e.created_at) < new Date(min) ? e.created_at : min, null);
    const minStarted = (execs as any[]).reduce((min: any, e: any) => e.started_at && (!min || new Date(e.started_at) < new Date(min)) ? e.started_at : min, null);
    const maxFinished = anyActive ? null : (execs as any[]).reduce((max: any, e: any) => e.finished_at && (!max || new Date(e.finished_at) > new Date(max)) ? e.finished_at : max, null);
    const workerIds = Array.from(new Set((execs as any[]).map((e: any) => e.worker_id).filter(Boolean)));

    return reply.send({
      data: {
        ...first,
        id: req.params.id, // keep the id the caller used (group id or exec id)
        status: groupMembers.length ? groupStatus : first.status,
        created_at: groupMembers.length ? minCreated : first.created_at,
        started_at: groupMembers.length ? minStarted : first.started_at,
        finished_at: groupMembers.length ? maxFinished : first.finished_at,
        test_case_ids: allCaseIds,
        worker_id: workerIds.length === 1 ? workerIds[0] : (workerIds.length > 1 ? `${workerIds.length} workers` : first.worker_id),
        execution_count: execs.length,
        ...chrome,
        results: results.rows,
        cases: cases.rows,
      },
    });
  });

  app.post<{ Body: { case_ids?: unknown; limit?: unknown; environment_id?: unknown; application_key?: unknown; all?: unknown } }>('/api/v1/ui/history', async (req, reply) => {
    const raw = Array.isArray(req.body?.case_ids) ? req.body.case_ids : [];
    const ids = [...new Set(raw.map(String).filter((id) => UUID.test(id)))];
    const limit = clampInt(req.body?.limit, 20, 100);
    // "all" mode scopes the aggregate to every case in an application, so the
    // Overview's "All tests" tile doesn't need to ship the whole case id list
    // (12 k UUIDs on a large catalog is dozens of KB per poll).
    const useAll = !!req.body?.all;
    const appKey = typeof req.body?.application_key === 'string' ? req.body.application_key : null;
    if (!ids.length && !useAll) return reply.send({ data: { runs: [], top_failing: [], totals: { cases_run: 0, results: 0 } } });
    const envId = await resolveEnvironmentId(req.body?.environment_id);

    // When "all" is set we match on application_key via the executions.metadata
    // JSONB — the same key /ui/live uses to scope the live board.
    const scope = useAll
      ? { clause: `e.metadata->>'application_key' = $1`, args: [appKey || 'sand-bench'] as unknown[] }
      : { clause: `er.test_case_id = ANY($1::uuid[])`, args: [ids] as unknown[] };

    const [runs, top, totals] = await Promise.all([
      query(
        `SELECT e.id, e.key, e.name, e.status, e.trigger_source, e.created_at, e.started_at, e.finished_at,
                count(*)::int AS total,
                count(*) FILTER (WHERE er.status = 'passed')::int AS passed,
                count(*) FILTER (WHERE er.status IN ${FAILED})::int AS failed,
                count(*) FILTER (WHERE er.status NOT IN ('passed','failed','error','timed_out'))::int AS other,
                COALESCE(sum(er.duration_ms), 0)::bigint AS duration_ms
         FROM execution_results er
         JOIN executions e ON e.id = er.execution_id
         WHERE ${scope.clause}
           AND ($${scope.args.length + 2}::uuid IS NULL OR e.environment_id = $${scope.args.length + 2}::uuid)
         GROUP BY e.id
         ORDER BY e.created_at DESC
         LIMIT $${scope.args.length + 1}`,
        [...scope.args, limit, envId]
      ),
      query(
        `SELECT er.test_case_id, tc.key, tc.name,
                count(*)::int AS runs,
                count(*) FILTER (WHERE er.status IN ${FAILED})::int AS failures,
                max(er.created_at) FILTER (WHERE er.status IN ${FAILED}) AS last_failed_at
         FROM execution_results er
         JOIN executions e ON e.id = er.execution_id
         JOIN test_cases tc ON tc.id = er.test_case_id
         WHERE ${scope.clause}
           AND ($${scope.args.length + 1}::uuid IS NULL OR e.environment_id = $${scope.args.length + 1}::uuid)
         GROUP BY er.test_case_id, tc.key, tc.name
         HAVING count(*) FILTER (WHERE er.status IN ${FAILED}) > 0
         ORDER BY failures DESC, last_failed_at DESC
         LIMIT 5`,
        [...scope.args, envId]
      ),
      query(
        `SELECT count(DISTINCT er.test_case_id)::int AS cases_run, count(*)::int AS results, min(er.created_at) AS first_at
         FROM execution_results er
         JOIN executions e ON e.id = er.execution_id
         WHERE ${scope.clause}
           AND ($${scope.args.length + 1}::uuid IS NULL OR e.environment_id = $${scope.args.length + 1}::uuid)`,
        [...scope.args, envId]
      ),
    ]);

    return reply.send({
      data: {
        runs: runs.rows.map((r: any) => ({ ...r, duration_ms: Number(r.duration_ms) })),
        top_failing: top.rows,
        totals: totals.rows[0],
      },
    });
  });

  /**
   * Full run history, paginated and filterable — unlike /ui/live (active runs +
   * a capped recent tail for the nav badge/live board), this is the source for
   * the Test Runs page's table so every run is reachable, not just the last N.
   */
  app.get('/api/v1/ui/runs', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';
    const envId = await resolveEnvironmentId(q.environment_id);
    const status = typeof q.status === 'string' && STATUSES.has(q.status) ? q.status : null;
    const trigger = typeof q.trigger_source === 'string' && q.trigger_source.trim() ? q.trigger_source.trim() : null;
    // Application version: stored in executions.metadata.application_version
    // (e.g. "main", a branch name, or a tag). Empty filter matches any value.
    const version = typeof q.application_version === 'string' && q.application_version.trim() ? q.application_version.trim() : null;
    const from = parseSince(q.from);
    const to = parseSince(q.to);
    const limit = clampInt(q.limit, 50, 200);
    const offset = Math.max(0, Math.floor(Number(q.offset) || 0));

    const clauses = [`e.metadata->>'application_key' = $1`];
    const params: unknown[] = [appKey];
    if (envId) { params.push(envId); clauses.push(`e.environment_id = $${params.length}`); }
    if (status) { params.push(status); clauses.push(`e.status = $${params.length}::execution_status`); }
    if (trigger) { params.push(trigger); clauses.push(`e.trigger_source = $${params.length}`); }
    if (version) { params.push(version); clauses.push(`e.metadata->>'application_version' = $${params.length}`); }
    if (from) { params.push(from); clauses.push(`e.created_at >= $${params.length}::timestamptz`); }
    if (to) { params.push(to); clauses.push(`e.created_at <= $${params.length}::timestamptz`); }
    const where = clauses.join(' AND ');

    const [rows, total, facets] = await Promise.all([
      query(
        `SELECT e.id, e.key, e.name, e.status, e.trigger_source, e.environment_id,
                env.name AS environment_name, e.created_at, e.started_at, e.finished_at,
                cardinality(e.test_case_ids)::int AS total,
                COALESCE(r.done, 0)::int AS done,
                COALESCE(r.passed, 0)::int AS passed,
                COALESCE(r.failed, 0)::int AS failed,
                COALESCE(app.name, e.metadata->>'application_key') AS application_name,
                e.metadata->>'application_version' AS application_version
         FROM executions e
         LEFT JOIN environments env ON env.id = e.environment_id
         LEFT JOIN applications app ON app.key = e.metadata->>'application_key'
         LEFT JOIN LATERAL (
           SELECT count(*) AS done,
                  count(*) FILTER (WHERE status = 'passed') AS passed,
                  count(*) FILTER (WHERE status IN ${FAILED}) AS failed
           FROM execution_results WHERE execution_id = e.id
         ) r ON true
         WHERE ${where}
         ORDER BY e.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
      query(`SELECT count(*)::int AS c FROM executions e WHERE ${where}`, params),
      // Facet lists for the filter dropdowns: distinct trigger sources and
      // application versions seen for this application. Scoped by app only so
      // the dropdowns do not go empty when the user picks a different status.
      query(
        `SELECT array_agg(DISTINCT e.trigger_source) FILTER (WHERE e.trigger_source IS NOT NULL) AS triggers,
                array_agg(DISTINCT e.metadata->>'application_version') FILTER (WHERE e.metadata ? 'application_version') AS versions
         FROM executions e WHERE e.metadata->>'application_key' = $1`,
        [appKey]
      ),
    ]);

    return reply.send({
      data: rows.rows,
      total: total.rows[0]?.c ?? 0,
      limit, offset,
      facets: {
        triggers: facets.rows[0]?.triggers || [],
        versions: facets.rows[0]?.versions || [],
      },
    });
  });

  // Grouped run list: one row per metadata.run_group (an execution with no
  // group id falls back to its own id, so a solo run still shows as a single
  // row). Aggregates case-level counts across every execution in the group so
  // the console shows the cumulative pass / fail / queued / running count even
  // when two workers drained the same run.
  app.get('/api/v1/ui/run-groups', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';
    const envId = await resolveEnvironmentId(q.environment_id);
    const status = typeof q.status === 'string' && STATUSES.has(q.status) ? q.status : null;
    const trigger = typeof q.trigger_source === 'string' && q.trigger_source.trim() ? q.trigger_source.trim() : null;
    const version = typeof q.application_version === 'string' && q.application_version.trim() ? q.application_version.trim() : null;
    const from = parseSince(q.from);
    const to = parseSince(q.to);
    const limit = clampInt(q.limit, 50, 200);
    const offset = Math.max(0, Math.floor(Number(q.offset) || 0));

    const clauses = [`e.metadata->>'application_key' = $1`];
    const params: unknown[] = [appKey];
    if (envId) { params.push(envId); clauses.push(`e.environment_id = $${params.length}`); }
    if (trigger) { params.push(trigger); clauses.push(`e.trigger_source = $${params.length}`); }
    if (version) { params.push(version); clauses.push(`e.metadata->>'application_version' = $${params.length}`); }
    if (from) { params.push(from); clauses.push(`e.created_at >= $${params.length}::timestamptz`); }
    if (to) { params.push(to); clauses.push(`e.created_at <= $${params.length}::timestamptz`); }
    const where = clauses.join(' AND ');

    // Group-level status: running if any exec is active, else failed if any
    // non-pass terminal, else cancelled if everyone cancelled, else passed.
    // The groups CTE below reads from `exec` (no alias), so the FILTER
    // predicates reference `status` directly — not `e.status`, which would
    // break out of the exec CTE's scope.
    const groupStatus = `CASE
      WHEN count(*) FILTER (WHERE status IN ('queued','preparing','running')) > 0 THEN 'running'
      WHEN count(*) FILTER (WHERE status IN ('failed','error','timed_out')) > 0 THEN 'failed'
      WHEN count(*) FILTER (WHERE status = 'cancelled') = count(*) THEN 'cancelled'
      ELSE 'passed'
    END`;

    // The main grouped SELECT: use COALESCE(run_group, id) as the group key
    // so a solo execution still appears as one row. Case-level counts come
    // from execution_results joined back to the group's execution ids.
    const baseSelect = `WITH exec AS (
      SELECT e.id, e.environment_id,
             COALESCE(e.metadata->>'run_group', e.id::text) AS group_id,
             COALESCE(e.name, e.key) AS name, e.key, e.status, e.trigger_source,
             e.created_at, e.started_at, e.finished_at,
             cardinality(e.test_case_ids)::int AS planned_cases,
             e.metadata->>'application_key' AS application_key,
             e.metadata->>'application_version' AS application_version
        FROM executions e
       WHERE ${where}
    ),
    groups AS (
      SELECT group_id,
             min(created_at) AS created_at,
             min(started_at) AS started_at,
             max(finished_at) AS finished_at,
             count(*)::int AS executions,
             max(application_key) AS application_key,
             max(application_version) AS application_version,
             max(trigger_source) AS trigger_source,
             (array_agg(environment_id) FILTER (WHERE environment_id IS NOT NULL))[1] AS environment_id,
             (array_agg(name ORDER BY created_at) FILTER (WHERE name IS NOT NULL))[1] AS name,
             (array_agg(key ORDER BY created_at) FILTER (WHERE key IS NOT NULL))[1] AS key,
             sum(planned_cases)::int AS planned_cases,
             ${groupStatus} AS status
        FROM exec
       GROUP BY group_id
    ),
    results AS (
      SELECT COALESCE(e.metadata->>'run_group', e.id::text) AS group_id,
             count(*)::int AS done,
             count(*) FILTER (WHERE er.status = 'passed')::int AS passed,
             count(*) FILTER (WHERE er.status IN ('failed','error','timed_out'))::int AS failed,
             count(*) FILTER (WHERE er.status NOT IN ('passed','failed','error','timed_out'))::int AS other
        FROM execution_results er
        JOIN executions e ON e.id = er.execution_id
       WHERE e.metadata->>'application_key' = $1
       GROUP BY group_id
    )
    SELECT g.group_id AS id, g.key, g.name, g.status, g.trigger_source,
           g.environment_id, env.name AS environment_name,
           g.created_at, g.started_at, g.finished_at,
           g.executions,
           g.planned_cases AS total,
           COALESCE(r.done, 0) AS done,
           COALESCE(r.passed, 0) AS passed,
           COALESCE(r.failed, 0) AS failed,
           COALESCE(r.other, 0) AS other,
           GREATEST(0, g.planned_cases - COALESCE(r.done, 0)) AS queued,
           COALESCE(app.name, g.application_key) AS application_name,
           g.application_version
      FROM groups g
      LEFT JOIN results r ON r.group_id = g.group_id
      LEFT JOIN environments env ON env.id = g.environment_id
      LEFT JOIN applications app ON app.key = g.application_key`;

    const whereFilter = status ? `WHERE g.status = $${params.length + 1}` : '';
    if (status) params.push(status);
    const sql = `${baseSelect}
      ${whereFilter}
      ORDER BY (g.status = 'running') DESC, g.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`;
    const countSql = `${baseSelect}
      ${whereFilter}`;

    const [rows, totalRows, facets] = await Promise.all([
      query(sql, params),
      query(`SELECT count(*)::int AS c FROM (${countSql}) t`, params),
      query(
        `SELECT array_agg(DISTINCT e.trigger_source) FILTER (WHERE e.trigger_source IS NOT NULL) AS triggers,
                array_agg(DISTINCT e.metadata->>'application_version') FILTER (WHERE e.metadata ? 'application_version') AS versions
         FROM executions e WHERE e.metadata->>'application_key' = $1`,
        [appKey]
      ),
    ]);

    return reply.send({
      data: rows.rows,
      total: totalRows.rows[0]?.c ?? 0,
      limit, offset,
      facets: {
        triggers: facets.rows[0]?.triggers || [],
        versions: facets.rows[0]?.versions || [],
      },
    });
  });

  // Delete executions in bulk. Hard-delete: execution_results and remarks
  // cascade; evidence rows are set to NULL. Caller must send a non-empty
  // {ids: [uuid, ...]} body — refuses an empty list so an accidental
  // POST with no body does not wipe runs.
  app.post<{ Body: { ids?: unknown } }>('/api/v1/executions/delete-batch', async (req, reply) => {
    const raw = Array.isArray((req.body as any)?.ids) ? ((req.body as any).ids as unknown[]) : [];
    const ids = raw.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x));
    if (!ids.length) return reply.code(400).send({ error: 'ids array required (uuids)' });
    const { rowCount } = await query(`DELETE FROM executions WHERE id = ANY($1::uuid[])`, [ids]);
    return reply.send({ data: { deleted: rowCount || 0 } });
  });

  // Cancel a selected batch of runs — only those still in a cancellable state
  // (queued/preparing/running) are updated; already-finished rows are skipped.
  app.post<{ Body: { ids?: unknown } }>('/api/v1/executions/cancel-batch', async (req, reply) => {
    const raw = Array.isArray((req.body as any)?.ids) ? ((req.body as any).ids as unknown[]) : [];
    const ids = raw.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x));
    if (!ids.length) return reply.code(400).send({ error: 'ids array required (uuids)' });
    const { rowCount } = await query(
      `UPDATE executions SET status = 'cancelled', finished_at = now()
         WHERE id = ANY($1::uuid[]) AND status IN ('queued','preparing','running')`,
      [ids]
    );
    return reply.send({ data: { cancelled: rowCount || 0, requested: ids.length } });
  });

  app.get('/api/v1/ui/build-history', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';
    const limit = clampInt(q.limit, 20, 100);

    const [builds, top] = await Promise.all([
      query(
        `SELECT build_id AS id, build_id AS key, max(reported_at) AS created_at,
                max(commit_sha) AS commit_sha, max(branch) AS branch,
                count(*)::int AS total,
                count(*) FILTER (WHERE status = 'passed')::int AS passed,
                count(*) FILTER (WHERE status IN ('failed','error'))::int AS failed,
                count(*) FILTER (WHERE status NOT IN ('passed','failed','error'))::int AS other,
                COALESCE(sum(duration_ms), 0)::bigint AS duration_ms
         FROM build_test_results WHERE application_key = $1
         GROUP BY build_id ORDER BY max(reported_at) DESC LIMIT $2`,
        [appKey, limit]
      ),
      query(
        `SELECT test_key AS key, max(test_name) AS name, count(*)::int AS runs,
                count(*) FILTER (WHERE status IN ('failed','error'))::int AS failures,
                max(reported_at) FILTER (WHERE status IN ('failed','error')) AS last_failed_at
         FROM build_test_results WHERE application_key = $1
         GROUP BY test_key
         HAVING count(*) FILTER (WHERE status IN ('failed','error')) > 0
         ORDER BY failures DESC, last_failed_at DESC
         LIMIT 5`,
        [appKey]
      ),
    ]);

    return reply.send({
      data: {
        runs: builds.rows.map((r: any) => ({ ...r, duration_ms: Number(r.duration_ms) })),
        top_failing: top.rows,
      },
    });
  });

  // Holistic Quality Insights summary — a single cheap aggregation the console
  // can show at the top of the Insights page. Covers:
  //   - never-run cases
  //   - top-passing / flaky cases
  //   - average case duration
  //   - execution duration + size histogram
  //   - worker usage (max concurrent on the window)
  //   - rules-based recommendations (actionable text)
  app.get('/api/v1/ui/insights-summary', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';
    const windowDays = Math.min(90, Math.max(1, Number(q.window_days) || 30));

    // Resolve the application id first — the executions table isn't joined
    // directly to applications; executions are scoped either by metadata
    // (application_key stamped on the run) or by their test case ids. We take
    // the broad view: any execution_result whose case belongs to this app.
    const appRow = await query<any>(`SELECT id FROM applications WHERE key = $1`, [appKey]);
    const appId = appRow.rows[0]?.id;
    if (!appId) return reply.send({ data: { window_days: windowDays, totals: {}, flakiest: [], longest: [], run_size_buckets: {}, recommendations: [] } });

    const [caseAgg, executions, workers] = await Promise.all([
      // Per-case aggregates over the window from execution_results.
      query<any>(
        `WITH last AS (
           SELECT er.test_case_id,
                  count(*)::int AS runs,
                  count(*) FILTER (WHERE er.status = 'passed')::int AS passed,
                  count(*) FILTER (WHERE er.status IN ('failed','error'))::int AS failed,
                  avg(er.duration_ms)::bigint AS avg_duration_ms
             FROM execution_results er
             JOIN test_cases tc ON tc.id = er.test_case_id
            WHERE tc.application_id = $1
              AND er.created_at > now() - ($2::int * interval '1 day')
            GROUP BY er.test_case_id
         )
         SELECT c.id, c.key, c.name,
                COALESCE(l.runs,0)::int AS runs,
                COALESCE(l.passed,0)::int AS passed,
                COALESCE(l.failed,0)::int AS failed,
                COALESCE(l.avg_duration_ms,0)::bigint AS avg_duration_ms
           FROM test_cases c
      LEFT JOIN last l ON l.test_case_id = c.id
          WHERE c.application_id = $1`,
        [appId, windowDays]
      ),
      // Per-run duration + case count — used for the "size of each test run" chart.
      // Executions are scoped by their metadata.application_key OR by the fact
      // that any of their test_case_ids belongs to this app's cases.
      query<any>(
        `SELECT ex.id, ex.key, ex.name, ex.status,
                COALESCE(cardinality(ex.test_case_ids),0)::int AS cases,
                CASE WHEN ex.started_at IS NULL THEN NULL
                     ELSE EXTRACT(EPOCH FROM (COALESCE(ex.finished_at, now()) - ex.started_at)) * 1000
                END AS duration_ms,
                ex.started_at, ex.finished_at, ex.worker_id
           FROM executions ex
          WHERE (ex.metadata->>'application_key' = $1
                 OR ex.test_case_ids && (SELECT COALESCE(array_agg(id),'{}'::uuid[]) FROM test_cases WHERE application_id = $2))
            AND ex.created_at > now() - ($3::int * interval '1 day')
          ORDER BY ex.started_at DESC NULLS LAST
          LIMIT 500`,
        [appKey, appId, windowDays]
      ),
      // Distinct workers that drained a run for this app over the window.
      query<any>(
        `SELECT count(DISTINCT ex.worker_id) FILTER (WHERE ex.worker_id IS NOT NULL)::int AS used_workers
           FROM executions ex
          WHERE (ex.metadata->>'application_key' = $1
                 OR ex.test_case_ids && (SELECT COALESCE(array_agg(id),'{}'::uuid[]) FROM test_cases WHERE application_id = $2))
            AND ex.created_at > now() - ($3::int * interval '1 day')`,
        [appKey, appId, windowDays]
      ),
    ]);

    const cases = caseAgg.rows;
    const neverRun = cases.filter((c: any) => c.runs === 0).length;
    const everRun = cases.length - neverRun;
    const passRate = (c: any) => (c.runs > 0 ? c.passed / c.runs : 0);
    const alwaysPass = cases.filter((c: any) => c.runs >= 3 && c.failed === 0).length;
    const flaky = cases.filter((c: any) => c.runs >= 3 && c.passed > 0 && c.failed > 0).length;
    const alwaysFail = cases.filter((c: any) => c.runs >= 3 && c.passed === 0 && c.failed > 0).length;
    const totalRuns = cases.reduce((n: number, c: any) => n + c.runs, 0);
    const totalFail = cases.reduce((n: number, c: any) => n + c.failed, 0);
    const avgFailRate = totalRuns > 0 ? totalFail / totalRuns : 0;
    const avgDurMs = everRun > 0
      ? Math.round(cases.filter((c: any) => c.runs > 0).reduce((n: number, c: any) => n + Number(c.avg_duration_ms || 0), 0) / Math.max(1, everRun))
      : 0;

    const flakiest = cases
      .filter((c: any) => c.runs >= 3)
      .map((c: any) => ({ ...c, pass_rate: passRate(c), avg_duration_ms: Number(c.avg_duration_ms || 0) }))
      .sort((a: any, b: any) => Math.abs(0.5 - a.pass_rate) - Math.abs(0.5 - b.pass_rate))
      .slice(0, 10);
    const longest = cases
      .map((c: any) => ({ ...c, avg_duration_ms: Number(c.avg_duration_ms || 0) }))
      .filter((c: any) => c.runs > 0)
      .sort((a: any, b: any) => b.avg_duration_ms - a.avg_duration_ms)
      .slice(0, 10);

    // Per-run size histogram buckets: cases per run, grouped.
    const runs = executions.rows.map((r: any) => ({ ...r, duration_ms: r.duration_ms == null ? null : Number(r.duration_ms) }));
    const bucket = (n: number) => (n <= 1 ? '1' : n <= 5 ? '2-5' : n <= 25 ? '6-25' : n <= 100 ? '26-100' : '100+');
    const runSizeBuckets: Record<string, number> = {};
    for (const r of runs) runSizeBuckets[bucket(r.cases)] = (runSizeBuckets[bucket(r.cases)] || 0) + 1;

    const workerCounts = workers.rows[0] || { used_workers: 0 };
    workerCounts.distinct_workers = workerCounts.used_workers;

    // Rules-based recommendations — actionable text plus a structured `apply`
    // payload the client can act on when the operator agrees. Shape:
    //   { kind: 'run-cases', case_ids, label }      queue a run for those cases
    //   { kind: 'open-case', case_id }              deep-link to a case screen
    //   { kind: 'open-fix-log' }                    open the fix log view
    //   { kind: 'show-instructions', text }         show an instructions dialog
    //   { kind: 'enable-auto-fix' }                 flip auto-fix on
    const neverRunIds = cases.filter((c: any) => c.runs === 0).map((c: any) => c.id).slice(0, 500);
    const flakyIds = flakiest.map((c: any) => c.id).slice(0, 50);
    const alwaysFailIds = cases.filter((c: any) => c.runs >= 3 && c.passed === 0 && c.failed > 0).map((c: any) => c.id).slice(0, 50);
    const longestFirst = longest[0];

    const recs: Array<{ id: string; severity: string; title: string; action: string; detail: string; apply?: unknown }> = [];
    if (neverRun > 0)
      recs.push({
        id: 'rec-never-run', severity: 'high',
        title: `${neverRun} test case${neverRun === 1 ? '' : 's'} never ran in the last ${windowDays} days`,
        action: 'Create a run for the never-run cases',
        detail: 'Open Create run, pick scope "All", filter the catalogue to the never-run cases or run all cases on the environment.',
        apply: { kind: 'run-cases', case_ids: neverRunIds, label: `${neverRun} never-run case${neverRun === 1 ? '' : 's'}` },
      });
    if (flaky >= 3)
      recs.push({
        id: 'rec-flaky', severity: 'medium',
        title: `${flaky} flaky case${flaky === 1 ? '' : 's'} (sometimes pass, sometimes fail)`,
        action: 'Rerun the flakiest cases to shake out intermittents',
        detail: 'Flaky tests mask real regressions. Rerunning them generates more data to classify intermittent vs. real; the loop can then stabilise them with auto-fix.',
        apply: { kind: 'run-cases', case_ids: flakyIds, label: `top ${flakyIds.length} flaky case${flakyIds.length === 1 ? '' : 's'}` },
      });
    if (alwaysFail >= 1)
      recs.push({
        id: 'rec-always-fail', severity: 'high',
        title: `${alwaysFail} case${alwaysFail === 1 ? '' : 's'} fail on every recent run`,
        action: 'Open the fix log and rerun the failing cases',
        detail: 'A case that only fails produces noise. Fix the underlying defect or disable the case until a fix lands. Applying this reruns them with auto-fix on.',
        apply: { kind: 'run-cases', case_ids: alwaysFailIds, label: `${alwaysFailIds.length} always-failing case${alwaysFailIds.length === 1 ? '' : 's'}`, auto_fix: { enabled: true, max_attempts: 2 } },
      });
    if (avgFailRate > 0.1)
      recs.push({
        id: 'rec-fail-rate', severity: 'medium',
        title: `Average failure rate is ${(avgFailRate * 100).toFixed(1)}%`,
        action: 'Enable the auto-fix loop so failing cases retry automatically',
        detail: `More than 1 in 10 case results in the last ${windowDays} days failed. Turning auto-fix on makes a transient failure retry without a redeploy; a real defect triggers the fixer agent (or files a defect in production).`,
        apply: { kind: 'enable-auto-fix' },
      });
    if (avgDurMs > 60_000 && longestFirst)
      recs.push({
        id: 'rec-slow-cases', severity: 'low',
        title: `Average case duration is ${(avgDurMs / 1000).toFixed(1)}s`,
        action: 'Open the slowest case to see where the time is spent',
        detail: 'Slow cases eat worker time. The Longest-running list below opens the top one so you can look at step durations and consider trimming or splitting it.',
        apply: { kind: 'open-case', case_id: longestFirst.id, label: longestFirst.name || longestFirst.key },
      });
    if (workerCounts.used_workers <= 1 && runs.length > 10)
      recs.push({
        id: 'rec-add-worker', severity: 'medium',
        title: `Only ${workerCounts.used_workers} worker${workerCounts.used_workers === 1 ? '' : 's'} drained runs in the window`,
        action: 'Start another worker to parallelise',
        detail: 'A second worker on the same application roughly halves wall-clock time for a batch; the planner distributes runs across them.',
        apply: { kind: 'show-instructions', title: 'Start another worker', text: 'On the host:\n\n  cd /path/to/gavriq-test-engine\n  docker compose -f docker-compose.yml up -d --scale test-engine-worker=2\n\nThe new worker will register and start claiming runs within ~30s. Check /api/v1/workers to confirm.' },
      });
    if (!recs.length)
      recs.push({ id: 'rec-ok', severity: 'none', title: 'No urgent recommendations', action: '', detail: `Everything looks healthy over the last ${windowDays} days. Keep the auto-fix loop armed and the catalog groomed.` });

    return reply.send({
      data: {
        window_days: windowDays,
        totals: {
          cases: cases.length,
          never_run: neverRun,
          ever_run: everRun,
          always_pass: alwaysPass,
          flaky,
          always_fail: alwaysFail,
          avg_fail_rate: avgFailRate,
          avg_duration_ms: avgDurMs,
          runs: runs.length,
          max_workers: Number(workerCounts.used_workers || 0),
          distinct_workers: Number(workerCounts.distinct_workers || 0),
        },
        flakiest,
        longest,
        run_size_buckets: runSizeBuckets,
        recommendations: recs,
      },
    });
  });
}
