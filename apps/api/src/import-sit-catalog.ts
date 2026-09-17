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
      const { rows } = await query(
        `INSERT INTO test_cases (
           key, name, description, application_id, test_type, execution_method,
           script, automation_status, lifecycle, tags, author_id, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'automated','active',$8,'sit-import','sit-import')
         ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
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
      const { rows } = await query(
        `INSERT INTO test_cases (
           key, name, description, application_id, test_type, execution_method,
           script, automation_status, lifecycle, tags, author_id, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'automated','active',$8,'sit-import','sit-import')
         ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now()
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
