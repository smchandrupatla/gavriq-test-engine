#!/usr/bin/env tsx
import { migrate, pool } from './client.js';

migrate()
  .then(() => {
    console.log('Migration complete');
    return pool.end();
  })
  .catch((err) => {
    console.error('Migration failed', err);
    process.exit(1);
  });
