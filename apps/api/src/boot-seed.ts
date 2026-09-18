import { query } from './db/client.js';

/** Wait for database to be ready with retries and exponential backoff. */
export async function waitForDatabase(maxRetries = 30, baseDelayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await query(`SELECT 1`);
      console.log(`[db-ready] Database available after ${attempt} attempt(s)`);
      return true;
    } catch (err) {
      const error = err as Error;
      if (attempt === maxRetries) {
        console.error('[db-unavailable] Max retries reached, database not accessible:', error.message);
        return false;
      }
      const delay = baseDelayMs * Math.pow(1.5, attempt - 1);
      console.log(`[db-retry] Attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return false;
}

/** Optional seed when AUTO_SEED=true (e.g. first Docker boot). */
export async function maybeAutoSeed() {
  if (process.env.AUTO_SEED !== 'true') return;
  // Wait for database to be ready before attempting any operations
  const dbReady = await waitForDatabase();
  if (!dbReady) {
    console.warn('[auto-seed] Database not available, skipping auto-seed');
    return;
  }
  try {
    const { rows } = await query(`SELECT count(*)::int AS c FROM test_cases`);
    if ((rows[0]?.c || 0) > 0) {
      console.log('[auto-seed] test cases already present, skipping');
      return;
    }
    console.log('[auto-seed] empty repository — seeding Sand Bench smoke pack...');
    // Dynamic import so migrate path stays light when AUTO_SEED is off
    const { spawn } = await import('node:child_process');
    await new Promise<void>((resolve, reject) => {
      const child = spawn('npx', ['tsx', 'apps/api/src/seed.ts'], {
        stdio: 'inherit',
        env: process.env,
      });
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`seed exit ${code}`))));
    });
  } catch (err) {
    console.warn('[auto-seed] skipped:', (err as Error).message);
  }
}
