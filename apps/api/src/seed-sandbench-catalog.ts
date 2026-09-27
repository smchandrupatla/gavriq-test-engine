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
import { catalogHash, loadAutomation } from './sandbench-catalog-source.js';

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
  'selenium-baseline': 'selenium-baseline',
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
  const appId = appRes.rows[0]!.id;

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
  let automated = 0;
  let retired = 0;
  const automation = loadAutomation();

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
    const typeSuiteId = typeSuiteRes.rows[0]!.id;
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
      const suiteId = suiteRes.rows[0]!.id;
      suiteCount++;

      for (const c of s.cases) {
        // The key stays derived from the original catalog name so renames keep the row.
        const caseKey = `SB-${t.key.toUpperCase()}-${s.id.toUpperCase()}-${slug(c.name).toUpperCase()}`.slice(0, 120);
        // The catalog JSON is a design taxonomy: its status / duration / "tested" fields are
        // mock-up values, not results, and it carries no script. What actually runs comes
        // from data/sandbench-catalog-automation.json: a SIT test, a load profile, or a
        // retirement reason. A case with no entry stays an honest draft to be automated.
        const plan = automation[`${t.key}/${s.id}/${c.name}`] || {};
        const tags = ['sandbench', 'seeded', t.key, t.category, s.id];
        let method = 'http', script: string | null = null, rules: Record<string, unknown> = {};
        let automationStatus = 'to_be_automated', lifecycle = 'draft';
        let description = `${s.name}: ${s.desc}`;
        if (plan.retire) {
          automationStatus = 'not_automatable';
          lifecycle = 'deprecated';
          description = `${description}\nRetired: ${plan.retire}`;
          tags.push('retired');
          retired++;
        } else if (plan.script) {
          method = 'sit'; script = plan.script;
          automationStatus = 'automated'; lifecycle = 'active';
          automated++;
        } else if (plan.validation_rules) {
          method = plan.execution_method || 'performance'; rules = plan.validation_rules;
          automationStatus = 'automated'; lifecycle = 'active';
          automated++;
        }
        const { rows } = await query(
          `INSERT INTO test_cases (
             key, name, description, application_id, test_type, execution_method, script,
             validation_rules, automation_status, lifecycle, tags, severity, priority, author_id, created_by
           ) VALUES (
             $1, $2, $3, $4, COALESCE($5::test_type, 'other'), $6, $7,
             $8::jsonb, $9::automation_status, $10::test_lifecycle, $11, 'medium', 'p2', $12, 'sandbench-seed'
           )
           ON CONFLICT (key) DO UPDATE SET
             name = EXCLUDED.name, description = EXCLUDED.description, tags = EXCLUDED.tags,
             execution_method = EXCLUDED.execution_method, script = EXCLUDED.script,
             validation_rules = EXCLUDED.validation_rules, automation_status = EXCLUDED.automation_status,
             lifecycle = EXCLUDED.lifecycle, updated_at = now()
           RETURNING id`,
          [
            caseKey, plan.title || c.name, description, appId, typeEnum, method, script,
            JSON.stringify(rules), automationStatus, lifecycle, tags, s.owner,
          ]
        );
        await query(
          `INSERT INTO test_case_suites (test_case_id, test_suite_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [rows[0]!.id, suiteId]
        );
        await query(
          `INSERT INTO test_case_suites (test_case_id, test_suite_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [rows[0]!.id, typeSuiteId]
        );
        caseCount++;
      }
    }
  }

  await query(
    `UPDATE applications SET metadata = metadata || $1::jsonb, updated_at = now() WHERE id = $2`,
    [
      JSON.stringify({
        sandbench_catalog_hash: catalogHash(),
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

  console.log(`Sand Bench catalog seeded: ${catalog.types.length} types, ${suiteCount} suites, ${caseCount} cases (${automated} automated, ${retired} retired, ${caseCount - automated - retired} to be automated).`);
  console.log('All screen data must be loaded from Postgres via API — no hardcoded dummy rows in UI.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
