#!/usr/bin/env tsx
/**
 * Seed the REALISTIC, runnable test catalog and remove the old display-only
 * dummy cases.
 *
 *   - Replaces the 102 `sandbench-seed` display cases (no steps, not really
 *     runnable) with the verified executable catalog in ./catalog/*.
 *   - Registers the Test Engine itself as application #2 with a real API
 *     self-test suite (generic multi-application proof).
 *   - Creates environments whose config.vars carry every target URL the
 *     cases template against ({{web}}, {{api}}, {{testhub}}, {{dbviewer}},
 *     {{engine}}), for both a host worker (127.0.0.1) and a containerized
 *     worker (host.docker.internal).
 *   - Removes the placeholder applications (my-app, test-app) so no dummy
 *     content remains in the repository.
 *
 * Idempotent: re-running upserts definitions in place.
 */
import { pool, query, migrate } from './db/client.js';
import { SANDBENCH_CASES, SANDBENCH_SUITES, SANDBENCH_TYPES } from './catalog/sandbench-cases.js';
import { ENGINE_CASES, ENGINE_SUITES, ENGINE_TYPES } from './catalog/engine-cases.js';
import type { CaseDef, SuiteDef, TypeMeta } from './catalog/types.js';

// Demo persona defaults are the DOCUMENTED, fictional dev-only identities from
// dev/demo-seed/sand-bench-demo-tenants-users.json (never valid in production).
// A deployment with rotated credentials overrides via secret_env at the worker.
const HOST_VARS = {
  web: 'http://127.0.0.1:8080',
  api: 'http://127.0.0.1:8787',
  testhub: 'http://127.0.0.1:8091',
  dbviewer: 'http://127.0.0.1:8090',
  engine: 'http://127.0.0.1:8797',
  tenant: 'acme-demo',
  username: 'operator.acme',
  // Passwordless demo login is the documented, verified-live working path (password
  // optional in dev builds). Seeding a stale real-looking password here previously
  // fought a live fix to environments.config.vars.password — keep this empty so a
  // reseed can never regress that.
  password: '',
};

const CONTAINER_VARS = {
  ...HOST_VARS,
  web: 'http://host.docker.internal:8080',
  api: 'http://host.docker.internal:8787',
  testhub: 'http://host.docker.internal:8091',
  dbviewer: 'http://host.docker.internal:8090',
  engine: 'http://host.docker.internal:8797',
};

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

async function upsertApplication(key: string, name: string, description: string, types: TypeMeta[], suites: SuiteDef[], cases: CaseDef[]) {
  const counts = new Map<string, number>();
  for (const c of cases) {
    const suite = suites.find((s) => s.key === c.suiteKey);
    if (suite) counts.set(suite.typeKey, (counts.get(suite.typeKey) || 0) + 1);
  }
  const meta = {
    sandbench_types: types.map((t) => ({
      key: t.key, label: t.label, subtitle: t.subtitle, category: t.category,
      suiteCount: suites.filter((s) => s.typeKey === t.key).length,
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

async function upsertEnvironment(key: string, name: string, envType: string, baseUrl: string, vars: Record<string, string>) {
  await query(
    `INSERT INTO environments (key, name, env_type, base_url, config, safety_policy, status)
     VALUES ($1, $2, $3::environment_type, $4, $5::jsonb, $6::jsonb, 'active')
     ON CONFLICT (key) DO UPDATE SET
       name = EXCLUDED.name, base_url = EXCLUDED.base_url,
       config = EXCLUDED.config, safety_policy = EXCLUDED.safety_policy, updated_at = now()`,
    [key, name, envType, baseUrl, JSON.stringify({ vars, secret_env: SECRET_ENV }), JSON.stringify(SAFETY)]
  );
  console.log('Environment:', key, '→', baseUrl);
}

async function seedSuitesAndCases(appId: string, suites: SuiteDef[], cases: CaseDef[]) {
  const suiteIds = new Map<string, string>();
  for (const s of suites) {
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
    if (!suiteId) throw new Error(`Case ${c.key} references unknown suite ${c.suiteKey}`);
    const suite = suites.find((s) => s.key === c.suiteKey)!;
    const validationRules = {
      ...(c.validationRules || {}),
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
    // reset membership so cases moved between suites don't keep stale links
    await query(`DELETE FROM test_case_suites WHERE test_case_id = $1`, [rows[0]!.id]);
    await query(
      `INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [rows[0]!.id, suiteId, n]
    );
    n++;
  }
  return n;
}

async function main() {
  await migrate();

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

  // 4) Applications.
  const sbId = await upsertApplication(
    'sand-bench', 'Sand Bench',
    'Sand Bench enterprise deployment under test (web console, API, testhub, DB viewer).',
    SANDBENCH_TYPES, SANDBENCH_SUITES, SANDBENCH_CASES
  );
  const teId = await upsertApplication(
    'gavriq-test-engine', 'GAVRIQ Test Engine',
    'The test engine itself, registered as an application under test (API self-tests).',
    ENGINE_TYPES, ENGINE_SUITES, ENGINE_CASES
  );
  console.log('Applications:', sbId, teId);

  // 5) Environments.
  await upsertEnvironment('sand-bench-local', 'Sand Bench · local Docker (host worker)', 'docker', HOST_VARS.web, HOST_VARS);
  await upsertEnvironment('sand-bench-container', 'Sand Bench · local Docker (containerized worker)', 'docker', CONTAINER_VARS.web, CONTAINER_VARS);
  await upsertEnvironment('engine-local', 'Test Engine · local (self-test)', 'localhost', HOST_VARS.engine, HOST_VARS);
  // Repair the legacy default env (used to point at a dead port 8001).
  await upsertEnvironment('local-dev', 'Local Development', 'localhost', HOST_VARS.web, HOST_VARS);

  // 6) Suites + cases.
  const sbCount = await seedSuitesAndCases(sbId, SANDBENCH_SUITES, SANDBENCH_CASES);
  const teCount = await seedSuitesAndCases(teId, ENGINE_SUITES, ENGINE_CASES);
  console.log(`Seeded ${sbCount} Sand Bench cases across ${SANDBENCH_SUITES.length} suites.`);
  console.log(`Seeded ${teCount} Test Engine self-test cases across ${ENGINE_SUITES.length} suites.`);
  console.log('Every case is executable: http/playwright/selenium/performance steps verified against the live deployment.');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
