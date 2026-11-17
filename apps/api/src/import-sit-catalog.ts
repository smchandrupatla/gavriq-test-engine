#!/usr/bin/env tsx
/**
 * Register the application team's SIT suite (sit/cases/*.sit.ts) in the test
 * repository: one runnable case per test, exactly one.
 *
 *   tsx apps/api/src/import-sit-catalog.ts --env sand-bench-staging
 *   tsx apps/api/src/import-sit-catalog.ts --source <dir with sit/cases> [--dry-run]
 *
 * The suite belongs to a commit of the application. `--env` reads it from the
 * exported source of the commit DEPLOYED on that environment (the folder
 * deploy/staging/deploy.mjs writes, mounted in the containers at /app/sbe-src),
 * so what is registered is what the worker will run there
 * (apps/worker/src/runners/sit.ts sitSourceRoot). Without either option the copy
 * bundled in this repository is read.
 *
 * It also RECONCILES. The repository had collected several registrations of the
 * same test under different keys — an earlier import that cut keys at 40
 * characters, and a registration script on the application side that could not
 * see every existing row and so registered tests again, twice in places, with no
 * script to run. After this import every test of the suite has ONE active case
 * (the oldest existing registration is kept and made runnable; a new one is
 * created only when there is none), and every other SIT registration — a
 * duplicate, or a test the deployed suite no longer has — is archived. Archived,
 * not deleted: results that point at it stay readable.
 *
 * A case's identity is its `automation_link`, written exactly as the application
 * side writes it, so its registration script finds every test already present
 * and adds nothing.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query, migrate, withTransaction } from './db/client.js';
import { listSitTests, sharesSuite, sitKeyFor, sitScreenFields, sitScriptFor, sitTimeoutFor } from './sit-inventory.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DRY_RUN = argv.includes('--dry-run');

class DryRun extends Error {
  constructor(public summary: { duplicates: number; stale: number }) {
    super('dry run');
  }
}

async function sourceRoot(): Promise<{ dir: string; origin: string }> {
  const explicit = opt('source');
  if (explicit) return { dir: path.resolve(explicit), origin: explicit };
  const envKey = opt('env');
  if (envKey) {
    const { rows } = await query(`SELECT config FROM environments WHERE key = $1`, [envKey]);
    const commit = String(rows[0]?.config?.deployment?.commit || '');
    if (commit.length < 12) throw new Error(`environment "${envKey}" has no deployed commit on record`);
    const base = process.env.SIT_SOURCES_DIR || path.join(root, 'sbe-src');
    const dir = path.join(base, commit.slice(0, 12));
    if (!existsSync(path.join(dir, 'sit/cases'))) throw new Error(`the exported source of ${commit.slice(0, 12)} is not at ${dir} (is the sources folder mounted?)`);
    return { dir, origin: `commit ${commit.slice(0, 12)} deployed on ${envKey}` };
  }
  return { dir: root, origin: 'the copy bundled in this repository' };
}

/** `sit/cases/<file>[::<test>]` a registration stands for, from its script or its automation link. */
function identityOf(row: { script?: string | null; automation_link?: string | null }): string | null {
  const script = String(row.script || '').trim();
  if (script.startsWith('sit/cases/')) return script;
  const m = /^(sit\/cases\/.+?) \(SIT runner, node:test\)$/.exec(String(row.automation_link || '').trim());
  return m ? m[1]! : null;
}

async function main() {
  await migrate();
  const { dir, origin } = await sourceRoot();
  const { files, tests } = await listSitTests(dir);

  const app = await query(
    `INSERT INTO applications (key, name, description, status)
     VALUES ('sand-bench', 'Sand Bench', 'Sand Bench enterprise deployment under test', 'active')
     ON CONFLICT (key) DO UPDATE SET updated_at = now()
     RETURNING id`,
  );
  const appId = app.rows[0]!.id as string;

  // Every SIT registration this application has. Kept first: an active one that can already run, then the oldest.
  const { rows: existing } = await query(
    `SELECT id, key, script, automation_link, lifecycle::text AS lifecycle
     FROM test_cases
     WHERE application_id = $1 AND (key LIKE 'SIT-%' OR script LIKE 'sit/cases/%' OR automation_link LIKE 'sit/cases/%')
     ORDER BY (lifecycle = 'active') DESC, (coalesce(script, '') <> '') DESC, created_at, key`,
    [appId]
  );
  const byIdentity = new Map<string, any[]>();
  for (const row of existing) {
    const identity = identityOf(row);
    if (identity) byIdentity.set(identity, [...(byIdentity.get(identity) || []), row]);
  }
  const takenKeys = new Set<string>((await query(`SELECT key FROM test_cases`)).rows.map((r: any) => r.key));

  // Where a file's tests already live. A file whose tests were grouped by hand — the
  // business use cases under "Business Use Cases Test", the penetration files under one
  // suite — stays where it was put; only a file with no home yet gets a suite of its own.
  const homeOfFile = new Map<string, string>();
  if (existing.length) {
    const { rows: memberships } = await query(
      `SELECT x.test_case_id, x.test_suite_id FROM test_case_suites x WHERE x.test_case_id = ANY($1::uuid[])`,
      [existing.map((row: any) => row.id)]
    );
    const suiteOfCase = new Map<string, string>(memberships.map((m: any) => [m.test_case_id, m.test_suite_id]));
    const votes = new Map<string, Map<string, number>>();
    for (const row of existing) {
      const file = identityOf(row)?.split('::')[0];
      const suite = suiteOfCase.get(row.id);
      if (!file || !suite) continue;
      const tally = votes.get(file) || new Map<string, number>();
      tally.set(suite, (tally.get(suite) || 0) + 1);
      votes.set(file, tally);
    }
    for (const [file, tally] of votes) homeOfFile.set(file, [...tally.entries()].sort((a, b) => b[1] - a[1])[0]![0]);
  }

  let created = 0;
  let kept = 0;
  const keep = new Set<string>();
  const summary = await withTransaction(async (client) => {
    const suiteIds = new Map<string, string>();
    for (const test of tests) {
      const { meta } = test;
      const home = homeOfFile.get(`sit/cases/${test.file}`);
      if (!home && !suiteIds.has(meta.suite)) {
        const { rows } = await client.query(
          `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by)
           VALUES ($1,$2,$3,$4,$5,'sit-import')
           ON CONFLICT (application_id, key) DO UPDATE SET updated_at = now()
           RETURNING id`,
          [meta.suite, meta.suite, `The application team's SIT checks in sit/cases/${test.file}${sharesSuite(test.fileKey) ? ' and the files grouped with it' : ''}`, appId, meta.type]
        );
        suiteIds.set(meta.suite, rows[0].id);
      }
      const suiteId = home || suiteIds.get(meta.suite)!;
      const identity = sitScriptFor(test.file, test.name);
      const sf = sitScreenFields(test);
      const budget = sitTimeoutFor(test.fileKey, meta);
      const tags = [...new Set(['sit', 'imported', meta.type, test.fileKey, ...meta.tags, ...(budget.longRunning ? ['cat:long-running'] : [])])];
      const name = test.name || `SIT file: ${test.file}`;
      const fields = [
        name, sf.description, meta.type, meta.method, identity, tags,
        sf.objective, sf.owner, sf.component, sf.environment, sf.estimated_duration, sf.visibility, sf.automation_link,
        sf.test_data, JSON.stringify(sf.attachments), sf.flakiness_notes, sf.known_workarounds, sf.common_failure_causes,
        sf.preconditions, JSON.stringify(sf.steps), budget.seconds,
      ];
      const canonical = (byIdentity.get(identity) || [])[0];
      let id: string;
      if (canonical) {
        id = canonical.id;
        kept++;
        await client.query(
          `UPDATE test_cases SET
             name = $2, description = $3, test_type = $4::test_type, execution_method = $5, script = $6,
             automation_status = 'automated', lifecycle = 'active', tags = $7,
             objective = $8, owner_id = COALESCE(owner_id, $9), component = $10, environment = $11,
             estimated_duration = $12, visibility = COALESCE(NULLIF(visibility, ''), $13), automation_link = $14,
             test_data = $15, attachments = $16::jsonb, flakiness_notes = $17, known_workarounds = $18,
             common_failure_causes = $19, preconditions = $20, steps = $21::jsonb, timeout_seconds = $22,
             updated_at = now(), updated_by = 'sit-import'
           WHERE id = $1`,
          [id, ...fields]
        );
      } else {
        let key = sitKeyFor(test.fileKey, test.name);
        if (takenKeys.has(key)) key = `${key.slice(0, 111)}-${createHash('sha1').update(identity).digest('hex').slice(0, 8)}`;
        takenKeys.add(key);
        const { rows } = await client.query(
          `INSERT INTO test_cases (
             key, application_id, name, description, test_type, execution_method, script,
             automation_status, lifecycle, tags, author_id, created_by,
             objective, owner_id, component, environment, estimated_duration, visibility, automation_link,
             test_data, attachments, flakiness_notes, known_workarounds, common_failure_causes, preconditions, steps,
             timeout_seconds
           ) VALUES ($1,$2,$3,$4,$5::test_type,$6,$7,'automated','active',$8,'sit-import','sit-import',
             $9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22::jsonb,$23)
           RETURNING id`,
          [key, appId, ...fields]
        );
        id = rows[0].id;
        created++;
      }
      keep.add(id);
      await client.query(`DELETE FROM test_case_suites WHERE test_case_id = $1 AND test_suite_id <> $2`, [id, suiteId]);
      await client.query(`INSERT INTO test_case_suites (test_case_id, test_suite_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, suiteId]);
    }

    // Every other SIT registration that a run would still pick up (active or draft): a second
    // copy of a kept test, or a test the deployed suite no longer has.
    const surplus = existing.filter((row: any) => !keep.has(row.id) && row.lifecycle !== 'archived' && row.lifecycle !== 'deprecated');
    const wanted = new Set(tests.map((t) => sitScriptFor(t.file, t.name)));
    const duplicates = surplus.filter((row: any) => { const i = identityOf(row); return i !== null && wanted.has(i); }).length;
    if (argv.includes('--list-stale')) {
      for (const row of surplus) {
        const i = identityOf(row);
        if (i === null || !wanted.has(i)) console.log(`stale\t${row.key}\t${i ?? '(no script or link)'}`);
      }
    }
    if (surplus.length) {
      const ids = surplus.map((row: any) => row.id);
      await client.query(
        `UPDATE test_cases SET lifecycle = 'archived', updated_at = now(), updated_by = 'sit-import-reconcile' WHERE id = ANY($1::uuid[])`,
        [ids]
      );
      await client.query(`DELETE FROM test_case_suites WHERE test_case_id = ANY($1::uuid[])`, [ids]);
    }
    const result = { duplicates, stale: surplus.length - duplicates };
    if (DRY_RUN) throw new DryRun(result);
    return result;
  }).catch((err) => {
    if (err instanceof DryRun) return err.summary;
    throw err;
  });

  console.log(`SIT suite from ${origin}: ${files.length} files, ${tests.length} tests.`);
  console.log(`${DRY_RUN ? '[dry run — nothing was changed] ' : ''}Cases: ${kept} existing made current, ${created} created; archived ${summary.duplicates} duplicate registration(s) and ${summary.stale} registration(s) of tests the suite no longer has.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
