#!/usr/bin/env tsx
/**
 * Import file-based SIT cases (sit/cases/*.sit.ts) into the enterprise Test Repository.
 * Each file becomes a suite; each extracted test becomes a test case.
 * Does not re-execute SIT — registers definitions so the engine can track & display them.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query, migrate } from './db/client.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const casesDir = path.join(root, 'sit/cases');

const CATEGORY: Record<string, { suite: string; type: string; method: string }> = {
  '00-health': { suite: 'sit-health', type: 'smoke', method: 'http' },
  '10-mq-round-trip': { suite: 'sit-mq', type: 'integration', method: 'http' },
  '20-kafka-round-trip': { suite: 'sit-kafka', type: 'integration', method: 'http' },
  '30-api-round-trip': { suite: 'sit-api', type: 'api', method: 'http' },
  '40-worker-job': { suite: 'sit-worker', type: 'integration', method: 'http' },
  '50-dbviewer-cross-check': { suite: 'sit-db', type: 'database', method: 'http' },
  '51-use-case-api': { suite: 'sit-use-case-api', type: 'api', method: 'http' },
  '60-gui-smoke': { suite: 'sit-gui-smoke', type: 'ui', method: 'playwright' },
  '60-ui-eventing': { suite: 'sit-ui-eventing', type: 'ui', method: 'playwright' },
  '61-selenium-screens': { suite: 'sit-selenium-screens', type: 'ui', method: 'selenium' },
  '62-selenium-fields': { suite: 'sit-selenium-fields', type: 'ui', method: 'selenium' },
  '63-selenium-workflows': { suite: 'sit-selenium-workflows', type: 'ui', method: 'selenium' },
  '64-use-case-ui': { suite: 'sit-use-case-ui', type: 'ui', method: 'selenium' },
  '66-official-clicks': { suite: 'sit-official-clicks', type: 'ui', method: 'selenium' },
  '67-feature-access-ui': { suite: 'sit-feature-access', type: 'ui', method: 'selenium' },
  '68-console-chrome': { suite: 'sit-console-chrome', type: 'ui', method: 'selenium' },
  '70-e2e-ux': { suite: 'sit-e2e-ux', type: 'e2e', method: 'selenium' },
  '70-ui-pages': { suite: 'sit-ui-pages', type: 'ui', method: 'selenium' },
  '80-security-auth': { suite: 'sit-security', type: 'security', method: 'http' },
  '80-ui-workflows': { suite: 'sit-ui-workflows', type: 'ui', method: 'selenium' },
  '81-security-api': { suite: 'sit-security', type: 'security', method: 'http' },
  '82-security-headers': { suite: 'sit-security', type: 'security', method: 'http' },
  '83-security-vuln': { suite: 'sit-security', type: 'security', method: 'http' },
  '84-security-zap': { suite: 'sit-security', type: 'security', method: 'http' },
  '85-security-sast': { suite: 'sit-security', type: 'security', method: 'http' },
  '90-agents': { suite: 'sit-agents', type: 'integration', method: 'http' },
};

/**
 * Test cases screen fields for an imported SIT case (adopted from Sand Bench's
 * representation): the part of the application it exercises, who looks after
 * it, how long it takes, where its script lives, and what usually breaks it.
 */
const COMPONENT: Record<string, string> = {
  '00-health': 'Deployment health', '10-mq-round-trip': 'MQ channel', '20-kafka-round-trip': 'Kafka channel', '30-api-round-trip': 'API channel',
  '40-worker-job': 'Background worker', '50-dbviewer-cross-check': 'Database viewer', '51-use-case-api': 'Use cases (API)',
  '60-gui-smoke': 'Web console', '60-ui-eventing': 'Web console · eventing', '61-selenium-screens': 'Web console · screens', '62-selenium-fields': 'Web console · forms',
  '63-selenium-workflows': 'Web console · workflows', '64-use-case-ui': 'Web console · use cases', '66-official-clicks': 'Web console · controls',
  '67-feature-access-ui': 'Web console · feature access', '68-console-chrome': 'Web console · chrome', '70-e2e-ux': 'End-to-end operator journeys', '70-ui-pages': 'Web console · pages',
  '80-security-auth': 'Security · sign-in', '80-ui-workflows': 'Web console · workflows', '81-security-api': 'Security · API', '82-security-headers': 'Security · headers',
  '83-security-vuln': 'Security · vulnerabilities', '84-security-zap': 'Security · ZAP scan', '85-security-sast': 'Security · static analysis',
  '90-agents': 'Agents', '91-performance-soak': 'Performance · soak', '92-performance-burst': 'Performance · burst',
};

function screenFieldsFor(fileKey: string, file: string, name: string | null, meta: { type: string; method: string }) {
  const security = fileKey.includes('security');
  const perf = fileKey.includes('performance');
  const browser = meta.method !== 'http';
  const plainName = (name || file).replace(/\s+/g, ' ').trim();
  const lowered = plainName.charAt(0).toLowerCase() + plainName.slice(1);
  return {
    objective: name
      ? `Run the application team's own SIT check that ${lowered}${/[.!?]$/.test(plainName) ? '' : '.'}`
      : `Run every check in the application team's SIT file ${file} against the deployed Sand Bench.`,
    owner: security || perf ? 'Quality control team' : 'Quality assurance team',
    component: COMPONENT[fileKey] || 'Sand Bench',
    environment: 'sand-bench-local',
    estimated_duration: perf ? '5-15m' : browser ? '1-5m' : 'Under 1m',
    visibility: 'Team',
    automation_link: `sit/cases/${file}${name ? `::${name}` : ''} (SIT runner, node:test)`,
    test_data: 'Defined inside the SIT script: the demo operator identity from the environment plus per-run generated messages.',
    attachments: JSON.stringify([{ name: `SIT script ${file}`, url: `sit/cases/${file}` }, { name: 'Catalog documentation', url: 'docs/TEST-CASE-CATALOG.md' }]),
    flakiness_notes: browser
      ? 'The SIT scripts follow the deployed console closely: a selector or copy change upstream shows up here as a failure before anything else does.'
      : 'None known — a scripted request-and-check; round-trip checks poll for up to a few seconds.',
    known_workarounds: 'Compare sit/cases/<file> with the upstream Sand Bench repository and probe the deployed page before treating a red result as an application defect; test names are the catalogue identity, so fix the body of a test, never its name.',
    common_failure_causes: `${browser ? 'Worker image without sit/ or the browser engine; console changed under the test; ' : 'Worker image without sit/; '}demo sign-in disabled or its password rotated; target stack not fully up.`,
  };
}

/** Extract test() names from a .sit.ts source file */
function extractTestNames(source: string): string[] {
  const names: string[] = [];
  const re = /\b(?:test|it)\s*\(\s*[`'"]([^`'"\n]+)[`'"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) names.push(m[1]);
  return [...new Set(names)];
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function main() {
  await migrate();

  const appRes = await query(
    `INSERT INTO applications (key, name, description, status)
     VALUES ('sand-bench', 'Sand Bench / Sandbox', 'Primary development sandbox under test', 'active')
     ON CONFLICT (key) DO UPDATE SET updated_at = now()
     RETURNING id`
  );
  const appId = appRes.rows[0].id;

  if (!existsSync(casesDir)) {
    console.error('sit/cases not found at', casesDir);
    process.exit(1);
  }

  const files = readdirSync(casesDir).filter((f) => f.endsWith('.sit.ts')).sort();
  let imported = 0;

  for (const file of files) {
    const fileKey = file.replace(/\.sit\.ts$/, '');
    const meta = CATEGORY[fileKey] || {
      suite: `sit-${fileKey}`,
      type: 'other',
      method: 'http',
    };
    const source = readFileSync(path.join(casesDir, file), 'utf8');
    const names = extractTestNames(source);

    const suiteRes = await query(
      `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by)
       VALUES ($1,$2,$3,$4,$5,'sit-import')
       ON CONFLICT (application_id, key) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
      [meta.suite, meta.suite, `Imported from sit/cases/${file}`, appId, meta.type]
    );
    const suiteId = suiteRes.rows[0].id;

    if (!names.length) {
      // File-level placeholder case
      const key = `SIT-${fileKey.toUpperCase().replace(/-/g, '_')}`;
      const sf = screenFieldsFor(fileKey, file, null, meta);
      const { rows } = await query(
        `INSERT INTO test_cases (
           key, name, description, application_id, test_type, execution_method,
           script, automation_status, lifecycle, tags, author_id, created_by,
           objective, owner_id, component, environment, estimated_duration, visibility, automation_link, test_data, attachments,
           flakiness_notes, known_workarounds, common_failure_causes, preconditions
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'automated','active',$8,'sit-import','sit-import',
           $9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21)
         ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = now(),
           objective = EXCLUDED.objective, owner_id = COALESCE(test_cases.owner_id, EXCLUDED.owner_id), component = EXCLUDED.component,
           environment = COALESCE(test_cases.environment, EXCLUDED.environment), estimated_duration = EXCLUDED.estimated_duration,
           automation_link = EXCLUDED.automation_link, test_data = EXCLUDED.test_data, attachments = EXCLUDED.attachments,
           flakiness_notes = EXCLUDED.flakiness_notes, known_workarounds = EXCLUDED.known_workarounds,
           common_failure_causes = EXCLUDED.common_failure_causes, preconditions = EXCLUDED.preconditions
         RETURNING id`,
        [
          key,
          `SIT file: ${file}`,
          `Registered from ${file} (no static test() names extracted)`,
          appId,
          meta.type,
          meta.method,
          `sit/cases/${file}`,
          ['sit', 'imported', meta.type],
          sf.objective, sf.owner, sf.component, sf.environment, sf.estimated_duration, sf.visibility, sf.automation_link, sf.test_data, sf.attachments,
          sf.flakiness_notes, sf.known_workarounds, sf.common_failure_causes,
          'The deployed Sand Bench stack (web, API, test hub, database viewer) is up and the demo operator identity is enabled; the worker image carries sit/ and, for browser checks, the browser engine.',
        ]
      );
      await query(
        `INSERT INTO test_case_suites (test_case_id, test_suite_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [rows[0].id, suiteId]
      );
      imported++;
      console.log('  +', key, '(file-level)');
      continue;
    }

    for (const name of names) {
      const key = `SIT-${fileKey.toUpperCase().replace(/-/g, '_')}-${slug(name).toUpperCase().slice(0, 40)}`;
      const sf = screenFieldsFor(fileKey, file, name, meta);
      const { rows } = await query(
        `INSERT INTO test_cases (
           key, name, description, application_id, test_type, execution_method,
           script, automation_status, lifecycle, tags, author_id, created_by,
           objective, owner_id, component, environment, estimated_duration, visibility, automation_link, test_data, attachments,
           flakiness_notes, known_workarounds, common_failure_causes, preconditions
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'automated','active',$8,'sit-import','sit-import',
           $9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21)
         ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now(),
           objective = EXCLUDED.objective, owner_id = COALESCE(test_cases.owner_id, EXCLUDED.owner_id), component = EXCLUDED.component,
           environment = COALESCE(test_cases.environment, EXCLUDED.environment), estimated_duration = EXCLUDED.estimated_duration,
           automation_link = EXCLUDED.automation_link, test_data = EXCLUDED.test_data, attachments = EXCLUDED.attachments,
           flakiness_notes = EXCLUDED.flakiness_notes, known_workarounds = EXCLUDED.known_workarounds,
           common_failure_causes = EXCLUDED.common_failure_causes, preconditions = EXCLUDED.preconditions
         RETURNING id`,
        [
          key.slice(0, 120),
          name,
          `Imported from sit/cases/${file}`,
          appId,
          meta.type,
          meta.method,
          `sit/cases/${file}::${name}`,
          ['sit', 'imported', meta.type, fileKey],
          sf.objective, sf.owner, sf.component, sf.environment, sf.estimated_duration, sf.visibility, sf.automation_link, sf.test_data, sf.attachments,
          sf.flakiness_notes, sf.known_workarounds, sf.common_failure_causes,
          'The deployed Sand Bench stack (web, API, test hub, database viewer) is up and the demo operator identity is enabled; the worker image carries sit/ and, for browser checks, the browser engine.',
        ]
      );
      await query(
        `INSERT INTO test_case_suites (test_case_id, test_suite_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [rows[0].id, suiteId]
      );
      imported++;
      console.log('  +', key.slice(0, 80));
    }
  }

  console.log(`\nImported ${imported} test case definitions from ${files.length} SIT files.`);
  console.log('Note: these are registry entries for tracking/display. Execution still uses sit/runner or engine workers.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
