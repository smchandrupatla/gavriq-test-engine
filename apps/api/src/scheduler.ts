#!/usr/bin/env tsx
/**
 * Standalone scheduler (npm run start:scheduler).
 *
 * The API already ticks in-process. Run this only when the API runs with
 * SCHEDULER_IN_PROCESS=false, e.g. to keep firing on one dedicated process.
 * It shares the DB with the API and uses the same tick(), which is safe to run
 * from several processes at once.
 */
import { migrate } from './db/client.js';
import { startScheduler } from './schedule/service.js';

await migrate();
delete process.env.SCHEDULER_IN_PROCESS;
startScheduler();
setInterval(() => {}, 1 << 30); // keep the process alive; the ticker timer is unref'd
