/** Optional seed when AUTO_SEED=true (e.g. first Docker boot). */
import { query } from './db/client.js';

export async function maybeAutoSeed() {
  if (process.env.AUTO_SEED !== 'true') return;
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
