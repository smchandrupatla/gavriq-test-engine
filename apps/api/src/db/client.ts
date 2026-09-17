import pg from 'pg';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.TEST_ENGINE_DATABASE_URL ||
  'postgres://sitconsole:sitconsole@127.0.0.1:5432/sitconsole';

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DB_POOL_MAX || 10),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000),
});

pool.on('error', (err) => {
  console.error('[test-engine-db] idle client error', err.message);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
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
  await pool.query(sql);
  try {
    await pool.query(`ALTER TYPE failure_classification ADD VALUE IF NOT EXISTS 'target_unreachable'`);
  } catch (err) {
    console.warn('[migrate] enum extend skipped:', (err as Error).message);
  }
  console.log('[migrate] schema applied successfully from', schemaPath);
}
