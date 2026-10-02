#!/usr/bin/env tsx
/**
 * Seed the REALISTIC, runnable test catalog and remove the old display-only
 * dummy cases.
 *
 *   - Replaces the 102 `sandbench-seed` display cases (no steps, not really
 *     runnable) with the verified executable catalog in ./catalog/*.
 *   - Registers the Test Engine itself as application #2 with its own
 *     self-test catalogue across the same test types (./catalog/engine-*).
 *   - Creates one environment per deployment, scoped to the application that
 *     runs there; config.vars carry every target URL the cases template
 *     against ({{web}}, {{api}}, {{testhub}}, {{dbviewer}}, {{engine}}).
 *     Targets are written for the host (127.0.0.1); a containerized worker
 *     re-points them at the host gateway. The staging environments are
 *     registered when staging is deployed: Sand Bench by
 *     deploy/staging/deploy.mjs, the engine itself by
 *     deploy/engine-staging/deploy.mjs.
 *   - Removes the placeholder applications (my-app, test-app) so no dummy
 *     content remains in the repository.
 *
 * Idempotent: re-running upserts definitions in place.
 *
 *   --app <key>    seed one application only (its cases, types and environment);
 *                  nothing of any other application is touched
 *   --no-suites    upsert cases only: no suite rows are created and existing
 *                  suite membership is left as it is (for an engine whose
 *                  suites are maintained by hand)
 */
import { pool, query, migrate } from './db/client.js';
import { SANDBENCH_CASES, SANDBENCH_SUITES, SANDBENCH_TYPES } from './catalog/sandbench-cases.js';
import { ENGINE_CASES, ENGINE_SUITES, ENGINE_TYPES } from './catalog/engine-cases.js';
import type { CaseDef, SuiteDef, TypeMeta } from './catalog/types.js';

// Demo persona defaults are the DOCUMENTED, fictional dev-only identities from
// dev/demo-seed/sand-bench-demo-tenants-users.json (never valid in production).
// A deployment with rotated credentials overrides via secret_env at the worker.
//
// 2026-10-02: Sand Bench collapsed to one hidden internal tenant and removed
// the tenant field from login entirely (see sand-bench-enterprise's
// db/migrations/046_single_tenant_identity.sql and apps/api/src/kernel/config.ts
// DEFAULT_TENANT_ID/DEFAULT_TENANT_SLUG). `tenant` is kept here, set to the one
// real (hidden) tenant's slug, only because SB-DQ-TENANT-PRESENT
// (apps/api/src/catalog/sandbench-cases.ts) still reads it to confirm that row
// exists; no login case uses it any more. `username`/`password` are a real demo
// persona -- login now always requires a password.
const HOST_VARS = {
  web: 'http://127.0.0.1:8080',
  api: 'http://127.0.0.1:8787',
  testhub: 'http://127.0.0.1:8091',
  dbviewer: 'http://127.0.0.1:8090',
  engine: 'http://127.0.0.1:8797',
  tenant: 'default',
  username: 'analyst',
  password: 'SandBenchDemo1234',
};

// Duplicates of sand-bench-local from before the worker re-pointed loopback
// targets itself. Retired, not deleted: past executions still reference them.
const RETIRED_ENVIRONMENTS = ['sand-bench-container', 'local-dev'];

const SECRET_ENV = { password: 'SB_DEMO_PASSWORD' };

const SAFETY = {
  functional_smoke: 'allowed',
  read_only_api: 'allowed',
  write_api: 'allowed',
  load: 'allowed',
  stress: 'approval_required',
  soak: 'allowed',
  chaos: 'allowed',
  destructive_db: 'prohibited',
  security_scan: 'allowed',
};

const APPLICATIONS = ['sand-bench', 'gavriq-test-engine'];
const argv = process.argv.slice(2);
const ONLY_APP = argv.includes('--app') ? argv[argv.indexOf('--app') + 1] : undefined;
const WITH_SUITES = !argv.includes('--no-suites');
const wanted = (appKey: string) => !ONLY_APP || ONLY_APP === appKey;

async function upsertApplication(key: string, name: string, description: string, types: TypeMeta[], suites: SuiteDef[], cases: CaseDef[]) {
  const counts = new Map<string, number>();
  for (const c of cases) {
    const suite = suites.find((s) => s.key === c.suiteKey);
    if (suite) counts.set(suite.typeKey, (counts.get(suite.typeKey) || 0) + 1);
  }
  const meta = {
    sandbench_types: types.map((t) => ({
      key: t.key, label: t.label, subtitle: t.subtitle, category: t.category,
      suiteCount: WITH_SUITES ? suites.filter((s) => s.typeKey === t.key).length : 0,
      caseCount: counts.get(t.key) || 0,
    })),
  };
  const { rows } = await query(
    `INSERT INTO applications (key, name, description, status, metadata)
     VALUES ($1, $2, $3, 'active', $4::jsonb)
     ON CONFLICT (key) DO UPDATE SET
       name = EXCLUDED.name, description = EXCLUDED.description,
       metadata = applications.metadata || EXCLUDED.metadata, updated_at = now()
     RETURNING id`,
    [key, name, description, JSON.stringify(meta)]
  );
  return rows[0]!.id as string;
}

async function upsertEnvironment(key: string, name: string, envType: string, baseUrl: string, vars: Record<string, string>, applications: string[]) {
  await query(
    // config is merged so keys the seed does not own (e.g. deployment) survive a reseed.
    `INSERT INTO environments (key, name, env_type, base_url, config, safety_policy, status)
     VALUES ($1, $2, $3::environment_type, $4, $5::jsonb, $6::jsonb, 'active')
     ON CONFLICT (key) DO UPDATE SET
       name = EXCLUDED.name, env_type = EXCLUDED.env_type, base_url = EXCLUDED.base_url,
       config = environments.config || EXCLUDED.config,
       safety_policy = EXCLUDED.safety_policy, status = 'active', updated_at = now()`,
    [key, name, envType, baseUrl, JSON.stringify({ applications, vars, secret_env: SECRET_ENV }), JSON.stringify(SAFETY)]
  );
  console.log('Environment:', key, '→', baseUrl);
}

async function seedSuitesAndCases(appId: string, suites: SuiteDef[], cases: CaseDef[]) {
  const suiteIds = new Map<string, string>();
  for (const s of WITH_SUITES ? suites : []) {
    const { rows } = await query(
      `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by)
       VALUES ($1, $2, $3, $4, $5, 'realistic-catalog')
       ON CONFLICT (application_id, key) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description,
         suite_type = EXCLUDED.suite_type, updated_at = now()
       RETURNING id`,
      [s.key, s.name, s.description, appId, s.typeKey]
    );
    suiteIds.set(s.key, rows[0]!.id);
  }

  let n = 0;
  for (const c of cases) {
    const suiteId = suiteIds.get(c.suiteKey);
    const suite = suites.find((s) => s.key === c.suiteKey);
    if (!suite || (WITH_SUITES && !suiteId)) throw new Error(`Case ${c.key} references unknown suite ${c.suiteKey}`);
    const validationRules = {
      ...(c.validationRules || {}),
      ...(c.cleanupSteps?.length ? { cleanup_steps: c.cleanupSteps } : {}),
      ...(c.cleanupTimeoutSeconds ? { cleanup_timeout_seconds: c.cleanupTimeoutSeconds } : {}),
      data_profile: c.dataProfile,
    };
    const { rows } = await query(
      `INSERT INTO test_cases (
         key, name, description, application_id, test_type, test_level,
         preconditions, test_data_ref, execution_method, steps, expected_results,
         validation_rules, timeout_seconds, severity, priority, tags,
         automation_status, lifecycle, author_id, created_by, environment_requirements
       ) VALUES (
         $1,$2,$3,$4,$5::test_type,'system',
         $6,$7,$8,$9::jsonb,$10,
         $11::jsonb,$12,$13::severity,$14::priority,$15,
         'automated','active','realistic-catalog','realistic-catalog',$16::jsonb
       )
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description,
         application_id = EXCLUDED.application_id,
         test_type = EXCLUDED.test_type,
         preconditions = EXCLUDED.preconditions,
         test_data_ref = EXCLUDED.test_data_ref,
         execution_method = EXCLUDED.execution_method,
         steps = EXCLUDED.steps,
         expected_results = EXCLUDED.expected_results,
         validation_rules = EXCLUDED.validation_rules,
         timeout_seconds = EXCLUDED.timeout_seconds,
         severity = EXCLUDED.severity, priority = EXCLUDED.priority,
         tags = EXCLUDED.tags, lifecycle = 'active',
         automation_status = 'automated',
         updated_at = now(), updated_by = 'realistic-catalog'
       RETURNING id`,
      [
        c.key, c.name, c.description, appId, c.testType,
        c.preconditions,
        `${c.dataProfile.profile}: ${c.dataProfile.data} (source: ${c.dataProfile.source})`,
        c.method,
        JSON.stringify(c.steps || []),
        c.expected,
        JSON.stringify(validationRules),
        c.timeoutSeconds || 60,
        c.severity, c.priority, c.tags,
        JSON.stringify({ suite: suite.key, type: suite.typeKey }),
      ]
    );
    if (suiteId) {
      // reset membership so cases moved between suites don't keep stale links
      await query(`DELETE FROM test_case_suites WHERE test_case_id = $1`, [rows[0]!.id]);
      await query(
        `INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [rows[0]!.id, suiteId, n]
      );
    }
    n++;
  }
  return n;
}

async function main() {
  if (ONLY_APP && !APPLICATIONS.includes(ONLY_APP)) {
    throw new Error(`--app must be one of ${APPLICATIONS.join(', ')} (got "${ONLY_APP}")`);
  }
  await migrate();

  if (!ONLY_APP) {
    // 1) Remove the display-only dummy catalog (cases + their suites).
    const delCases = await query(
      `DELETE FROM test_cases WHERE created_by = 'sandbench-seed' RETURNING key`
    );
    const delSuites = await query(
      `DELETE FROM test_suites WHERE created_by = 'sandbench-seed' RETURNING key`
    );
    console.log(`Removed dummy display catalog: ${delCases.rowCount} cases, ${delSuites.rowCount} suites`);

    // 2) Remove legacy generic-app flow cases replaced by the new baseline.
    const legacy = await query(
      `DELETE FROM test_cases WHERE key = ANY($1) RETURNING key`,
      [['TC-SB-DASHBOARD-WIDGETS', 'TC-SB-NAV-LOGIN', 'TC-SB-LOGIN-FORM', 'TC-SB-LOGIN-SUBMIT', 'TC-SB-FULL-SMOKE']]
    );
    await query(`DELETE FROM test_suites WHERE key = 'smoke-main-flows'`);
    console.log(`Removed legacy generic-app flows: ${legacy.rowCount} cases`);

    // 3) Remove placeholder applications (their suites/cases cascade).
    const delApps = await query(
      `DELETE FROM applications WHERE key IN ('my-app', 'test-app') RETURNING key`
    );
    console.log(`Removed placeholder applications: ${delApps.rows.map((r: any) => r.key).join(', ') || 'none'}`);

    const retired = await query(
      `UPDATE environments SET status = 'retired', updated_at = now()
       WHERE key = ANY($1) AND status <> 'retired' RETURNING key`,
      [RETIRED_ENVIRONMENTS]
    );
    console.log(`Retired environments: ${retired.rows.map((r: any) => r.key).join(', ') || 'none'}`);
  }

  // 4) Applications, each with the environment it is developed on and its suites + cases.
  const grouping = WITH_SUITES ? 'suites' : 'suite definitions (not applied: --no-suites)';
  if (wanted('sand-bench')) {
    const sbId = await upsertApplication(
      'sand-bench', 'Sand Bench',
      'Sand Bench enterprise deployment under test (web console, API, testhub, DB viewer).',
      SANDBENCH_TYPES, SANDBENCH_SUITES, SANDBENCH_CASES
    );
    await upsertEnvironment('sand-bench-local', 'Sand Bench · local Docker (development)', 'docker', HOST_VARS.web, HOST_VARS, ['sand-bench']);
    const sbCount = await seedSuitesAndCases(sbId, SANDBENCH_SUITES, SANDBENCH_CASES);
    console.log(`Seeded ${sbCount} Sand Bench cases across ${SANDBENCH_SUITES.length} ${grouping}.`);
  }
  if (wanted('gavriq-test-engine')) {
    const teId = await upsertApplication(
      'gavriq-test-engine', 'GAVRIQ Test Engine',
      'The test engine itself as an application under test: control-plane API, console, worker protocol, scheduler and evidence store.',
      ENGINE_TYPES, ENGINE_SUITES, ENGINE_CASES
    );
    await upsertEnvironment('engine-local', 'Test Engine · local Docker (development)', 'docker', HOST_VARS.engine, HOST_VARS, ['gavriq-test-engine']);
    const teCount = await seedSuitesAndCases(teId, ENGINE_SUITES, ENGINE_CASES);
    console.log(`Seeded ${teCount} Test Engine self-test cases across ${ENGINE_SUITES.length} ${grouping}.`);
  }
  console.log('Every case is executable: http/playwright/selenium/performance steps verified against the live deployment.');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
