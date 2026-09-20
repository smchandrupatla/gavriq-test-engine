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
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return false;
}

function runTsx(scriptPath: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const { spawn } = await import('node:child_process');
    const child = spawn('npx', ['tsx', scriptPath], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${scriptPath} exit ${code}`))
    );
  });
}

/** Optional seed when AUTO_SEED=true (e.g. first Docker / Render boot). */
export async function maybeAutoSeed() {
  const auto = process.env.AUTO_SEED === 'true';
  const forceSandbench = process.env.SEED_SANDBENCH === 'true';
  if (!auto && !forceSandbench) return;

  const dbReady = await waitForDatabase();
  if (!dbReady) {
    console.warn('[auto-seed] Database not available, skipping auto-seed');
    return;
  }

  try {
    if (auto) {
      const { rows } = await query(`SELECT count(*)::int AS c FROM test_cases`);
      if ((rows[0]?.c || 0) === 0) {
        console.log('[auto-seed] empty repository — seeding base smoke pack...');
        await runTsx('apps/api/src/seed.ts');
      } else {
        console.log('[auto-seed] test cases already present, skipping base seed');
      }
    }

    // Sand Bench taxonomy: seed when forced, or when AUTO_SEED and no sandbench-tagged cases yet
    if (forceSandbench || auto) {
      const { rows } = await query(
        `SELECT count(*)::int AS c FROM test_cases WHERE 'sandbench' = ANY(tags)`
      );
      const count = rows[0]?.c || 0;
      if (forceSandbench || count === 0) {
        console.log(
          forceSandbench
            ? '[auto-seed] SEED_SANDBENCH=true — loading Sand Bench catalog...'
            : '[auto-seed] no sandbench-tagged cases — loading Sand Bench catalog...'
        );
        await runTsx('apps/api/src/seed-sandbench-catalog.ts');
      } else {
        console.log(`[auto-seed] sandbench cases already present (${count}), skipping`);
      }
    }
  } catch (err) {
    console.warn('[auto-seed] skipped:', (err as Error).message);
  }
}
