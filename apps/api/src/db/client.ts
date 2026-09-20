import pg from 'pg';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.TEST_ENGINE_DATABASE_URL ||
  'postgres://sitconsole:sitconsole@127.0.0.1:5432/sitconsole';

/**
 * Postgres schema for Test Engine objects (tables, enums, indexes).
 * Share one free Render Postgres with Sand Bench web by using a different schema:
 *   - Sand Bench web → schema `app` (or `public`)
 *   - Test Engine    → schema `test_engine` (this default)
 */
export const PG_SCHEMA = (process.env.PG_SCHEMA || process.env.TEST_ENGINE_PG_SCHEMA || 'test_engine')
  .replace(/[^a-zA-Z0-9_]/g, '')
  .slice(0, 63) || 'test_engine';

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DB_POOL_MAX || 10),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000),
});

pool.on('error', (err) => {
  console.error('[test-engine-db] idle client error', err.message);
});

/** Ensure every pooled client looks in the Test Engine schema first. */
pool.on('connect', (client) => {
  client
    .query(`SET search_path TO ${quoteIdent(PG_SCHEMA)}, public`)
    .catch((err) => console.warn('[test-engine-db] search_path set failed:', (err as Error).message));
});

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL search_path TO ${quoteIdent(PG_SCHEMA)}, public`);
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function waitForDatabase(attempts = Number(process.env.DB_WAIT_ATTEMPTS || 30)) {
  let last: Error | undefined;
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      if (i > 1) console.log(`[migrate] postgres ready after ${i} attempt(s)`);
      return;
    } catch (err) {
      last = err as Error;
      console.warn(`[migrate] waiting for postgres (${i}/${attempts}): ${last.message}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw last || new Error('postgres never became reachable');
}

/** Create schema and pin search_path before applying DDL. */
export async function ensureSchema() {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}`);
  await pool.query(`SET search_path TO ${quoteIdent(PG_SCHEMA)}, public`);
  console.log(`[migrate] using schema ${PG_SCHEMA}`);
}

export async function migrate() {
  // client.ts lives at apps/api/src/db — four levels up is the repo root.
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  const schemaPath = path.join(root, 'apps/api/src/db/schema.sql');
  let sql: string;
  try {
    sql = readFileSync(schemaPath, 'utf8');
  } catch (err) {
    throw new Error(
      `Cannot read schema at ${schemaPath} (repo root resolved to ${root}): ${(err as Error).message}`
    );
  }
  await waitForDatabase();
  await ensureSchema();
  await pool.query(sql);
  try {
    await pool.query(
      `ALTER TYPE ${quoteIdent(PG_SCHEMA)}.failure_classification ADD VALUE IF NOT EXISTS 'target_unreachable'`
    );
  } catch (err) {
    // Unqualified type name also works when search_path is set
    try {
      await pool.query(`ALTER TYPE failure_classification ADD VALUE IF NOT EXISTS 'target_unreachable'`);
    } catch (err2) {
      console.warn('[migrate] enum extend skipped:', (err2 as Error).message);
    }
  }
  console.log('[migrate] schema applied successfully from', schemaPath, '→', PG_SCHEMA);
}
