#!/usr/bin/env tsx
/**
 * Seed Sand Bench taxonomy (test types → suites → cases) into Postgres.
 * Source: data/sandbench-catalog.json (+ optional part files). Design HTML is NOT in the repo.
 * UI must read only from the database / API — no dummy data on screen.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query, migrate } from './db/client.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dataDir = path.join(root, 'data');

const TYPE_TO_ENUM: Record<string, string> = {
  unit: 'unit',
  integration: 'integration',
  screen: 'ui',
  usecase: 'acceptance',
  endurance: 'performance',
  performance: 'performance',
  rollingUpgrade: 'deployment',
  nonFunctional: 'resilience',
  vulnerabilityScanning: 'security',
  penTesting: 'security',
  regression: 'regression',
  smoke: 'smoke',
  compatibility: 'other',
  dataQuality: 'other',
  chaos: 'resilience',
  compliance: 'other',
  drRecovery: 'resilience',
};

type CaseDef = { name: string; status: string; tone: string; duration: string; tested: string };
type SuiteDef = {
  id: string; name: string; desc: string; target: string; owner: string; env: string;
  lastRun: string; tone: string; statusLabel: string; cases: CaseDef[];
};
type TypeDef = {
  key: string; label: string; kicker: string; icon: string; subtitle: string; category: string; suites: SuiteDef[];
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

function loadCatalog(): TypeDef[] {
  const files = existsSync(dataDir)
    ? readdirSync(dataDir)
        .filter((f) => f === 'sandbench-catalog.json' || /^sandbench-catalog-part\d+\.json$/.test(f))
        .sort()
    : [];
  if (!files.length) {
    console.error('Missing data/sandbench-catalog.json (and optional part files)');
    process.exit(1);
  }
  const types: TypeDef[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const part = JSON.parse(readFileSync(path.join(dataDir, f), 'utf8')) as { types: TypeDef[] };
    for (const t of part.types || []) {
      if (seen.has(t.key)) continue;
      seen.add(t.key);
      types.push(t);
    }
  }
  return types;
}

async function main() {
  await migrate();
  const types = loadCatalog();
  const catalog = { types };

  const appRes = await query(
    `INSERT INTO applications (key, name, description, status, metadata)
     VALUES ('sand-bench', 'Sand Bench', 'Sand Bench Test Intelligence', 'active', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now()
     RETURNING id`,
    [JSON.stringify({ brand: 'Sand Bench', tagline: 'TEST INTELLIGENCE' })]
  );
  const appId = appRes.rows[0].id;

  for (const [key, name, envType] of [
    ['sandbox', 'Sandbox', 'sit'],
    ['staging', 'Staging', 'staging'],
    ['local-dev', 'Local Dev', 'development'],
  ] as const) {
    await query(
      `INSERT INTO environments (key, name, env_type, status)
       VALUES ($1, $2, $3::environment_type, 'active')
       ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = now()`,
      [key, name, envType]
    );
  }

  let suiteCount = 0;
  let caseCount = 0;

  for (const t of catalog.types) {
    const typeEnum = TYPE_TO_ENUM[t.key] || 'other';
    const typeSuiteKey = `sb-type-${t.key}`;
    const typeSuiteRes = await query(
      `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by)
       VALUES ($1, $2, $3, $4, $5, 'sandbench-seed')
       ON CONFLICT (application_id, key) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description, suite_type = EXCLUDED.suite_type, updated_at = now()
       RETURNING id`,
      [typeSuiteKey, t.label, t.subtitle, appId, t.key]
    );
    const typeSuiteId = typeSuiteRes.rows[0].id;
    suiteCount++;

    for (const s of t.suites) {
      const suiteKey = `sb-${t.key}-${s.id}`;
      const suiteRes = await query(
        `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by)
         VALUES ($1, $2, $3, $4, $5, 'sandbench-seed')
         ON CONFLICT (application_id, key) DO UPDATE SET
           name = EXCLUDED.name, description = EXCLUDED.description, suite_type = EXCLUDED.suite_type, updated_at = now()
         RETURNING id`,
        [
          suiteKey,
          s.name,
          JSON.stringify({
            desc: s.desc, target: s.target, owner: s.owner, env: s.env,
            tone: s.tone, statusLabel: s.statusLabel, typeKey: t.key,
            category: t.category, icon: t.icon, kicker: t.kicker,
          }),
          appId,
          t.key,
        ]
      );
      const suiteId = suiteRes.rows[0].id;
      suiteCount++;

      for (const c of s.cases) {
        const caseKey = `SB-${t.key.toUpperCase()}-${s.id.toUpperCase()}-${slug(c.name).toUpperCase()}`.slice(0, 120);
        const { rows } = await query(
          `INSERT INTO test_cases (
             key, name, description, application_id, test_type, execution_method,
             automation_status, lifecycle, tags, severity, priority, author_id, created_by,
             expected_results
           ) VALUES (
             $1, $2, $3, $4, COALESCE($5::test_type, 'other'), 'http',
             'automated', 'active', $6, 'medium', 'p2', $7, 'sandbench-seed', $8
           )
           ON CONFLICT (key) DO UPDATE SET
             name = EXCLUDED.name, description = EXCLUDED.description, tags = EXCLUDED.tags,
             expected_results = EXCLUDED.expected_results, updated_at = now()
           RETURNING id`,
          [
            caseKey, c.name, `${s.name}: ${s.desc}`, appId, typeEnum,
            ['sandbench', 'seeded', t.key, t.category, s.id, `tone:${c.tone}`, `status:${c.status}`],
            s.owner, `Duration ref: ${c.duration}; last tested: ${c.tested}`,
          ]
        );
        await query(
          `INSERT INTO test_case_suites (test_case_id, test_suite_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [rows[0].id, suiteId]
        );
        await query(
          `INSERT INTO test_case_suites (test_case_id, test_suite_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [rows[0].id, typeSuiteId]
        );
        caseCount++;
      }
    }
  }

  await query(
    `UPDATE applications SET metadata = metadata || $1::jsonb, updated_at = now() WHERE id = $2`,
    [
      JSON.stringify({
        sandbench_types: catalog.types.map((t) => ({
          key: t.key, label: t.label, kicker: t.kicker, icon: t.icon,
          subtitle: t.subtitle, category: t.category,
          suiteCount: t.suites.length,
          caseCount: t.suites.reduce((n, s) => n + s.cases.length, 0),
        })),
      }),
      appId,
    ]
  );

  console.log(`Sand Bench catalog seeded: ${catalog.types.length} types, ${suiteCount} suites, ${caseCount} cases.`);
  console.log('All screen data must be loaded from Postgres via API — no hardcoded dummy rows in UI.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
