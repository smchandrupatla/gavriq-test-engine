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

export async function migrate() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const schemaPath = path.join(root, 'apps/api/src/db/schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('[migrate] schema applied successfully');
}
