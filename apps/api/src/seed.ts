#!/usr/bin/env tsx
/**
 * Seed Sand Bench application, smoke suite, Selenium main flows, and HTTP health case.
 */
import { pool, query, migrate } from './db/client.js';

const MAIN_FLOWS = [
  {
    key: 'TC-SB-SMOKE-HOME',
    name: 'Smoke: Homepage loads successfully',
    description: 'Verify the deployed Sand Bench homepage is reachable with correct title and content.',
    script: 'smoke_home',
    method: 'selenium',
    priority: 'p0',
    severity: 'critical',
  },
  {
    key: 'TC-SB-DASHBOARD-WIDGETS',
    name: 'Main Flow: Dashboard widgets visible',
    description: 'Verify Active Users, Builds Today and Tests Passed widgets render.',
    script: 'dashboard_widgets',
    method: 'selenium',
    priority: 'p0',
    severity: 'high',
  },
  {
    key: 'TC-SB-NAV-LOGIN',
    name: 'Main Flow: Navigate Home → Login',
    description: 'From homepage click Login and land on the login page.',
    script: 'nav_to_login',
    method: 'selenium',
    priority: 'p0',
    severity: 'high',
  },
  {
    key: 'TC-SB-LOGIN-FORM',
    name: 'Main Flow: Login page form elements',
    description: 'Login page contains email, password and submit controls.',
    script: 'login_page_elements',
    method: 'selenium',
    priority: 'p0',
    severity: 'high',
  },
  {
    key: 'TC-SB-LOGIN-SUBMIT',
    name: 'Main Flow: Login form submit (demo)',
    description: 'Fill credentials and submit the login form.',
    script: 'login_submit',
    method: 'selenium',
    priority: 'p1',
    severity: 'medium',
  },
  {
    key: 'TC-SB-HEADER',
    name: 'Main Flow: Header branding & navigation',
    description: 'Sand Bench branding and main nav links are present.',
    script: 'header_branding',
    method: 'selenium',
    priority: 'p1',
    severity: 'medium',
  },
  {
    key: 'TC-SB-FULL-SMOKE',
    name: 'Smoke Suite: Full main-flow walkthrough',
    description: 'End-to-end walkthrough of all primary user flows in one session.',
    script: 'full_smoke_suite',
    method: 'selenium',
    priority: 'p0',
    severity: 'critical',
  },
  {
    key: 'TC-SB-HEALTH',
    name: 'API: Health endpoint',
    description: 'GET /health returns 200 from the target environment.',
    script: 'health',
    method: 'http',
    priority: 'p0',
    severity: 'critical',
  },
];

async function main() {
  await migrate();

  const appRes = await query(
    `INSERT INTO applications (key, name, description, status)
     VALUES ('sand-bench', 'Sand Bench / Sandbox', 'Primary development sandbox under test', 'active')
     ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id, key`
  );
  const appId = appRes.rows[0].id;
  console.log('Application:', appRes.rows[0].key, appId);

  await query(
    `INSERT INTO environments (key, name, env_type, base_url, safety_policy)
     VALUES (
       'local-dev',
       'Local Development',
       'localhost',
       $1,
       '{"functional_smoke":"allowed","read_only_api":"allowed","write_api":"allowed","load":"approval_required","stress":"prohibited","chaos":"prohibited","destructive_db":"prohibited"}'::jsonb
     )
     ON CONFLICT (key) DO UPDATE SET base_url = EXCLUDED.base_url, updated_at = now()`,
    [process.env.TARGET_BASE_URL || 'http://127.0.0.1:8001']
  );
  console.log('Environment: local-dev');

  const suiteRes = await query(
    `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by)
     VALUES ('smoke-main-flows', 'Smoke / Main Flows', 'Primary user-flow suite for Sand Bench', $1, 'smoke', 'seed')
     ON CONFLICT (application_id, key) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id`,
    [appId]
  );
  const suiteId = suiteRes.rows[0].id;
  console.log('Suite: smoke-main-flows', suiteId);

  for (const tc of MAIN_FLOWS) {
    const { rows } = await query(
      `INSERT INTO test_cases (
         key, name, description, application_id, test_type, test_level,
         execution_method, script, automation_status, lifecycle,
         priority, severity, tags, author_id, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,'system',$6,$7,'automated','active',
         $8,$9,ARRAY['smoke','sand-bench'],'seed','seed'
       )
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name,
         script = EXCLUDED.script,
         execution_method = EXCLUDED.execution_method,
         updated_at = now()
       RETURNING id, key`,
      [
        tc.key,
        tc.name,
        tc.description,
        appId,
        'selenium-baseline',
        tc.method,
        tc.script,
        tc.priority,
        tc.severity,
      ]
    );
    await query(
      `INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order)
       VALUES ($1,$2,0) ON CONFLICT DO NOTHING`,
      [rows[0].id, suiteId]
    );
    console.log('  +', rows[0].key, `(${tc.method})`);
  }

  await query(
    `INSERT INTO test_packs (key, name, description, content)
     VALUES (
       'sand-bench-smoke',
       'Sand Bench Smoke Pack',
       'Baseline smoke pack for Sand Bench deployments',
       $1::jsonb
     )
     ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
    [JSON.stringify({ suite_key: 'smoke-main-flows', application_key: 'sand-bench' })]
  );

  console.log('Seed complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
