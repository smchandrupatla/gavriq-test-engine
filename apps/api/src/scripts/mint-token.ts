#!/usr/bin/env tsx
/**
 * Mint a dev HS256 JWT for Test Engine API calls.
 *
 *   JWT_SECRET=dev-secret npx tsx apps/api/src/scripts/mint-token.ts test_engineer
 *   JWT_SECRET=dev-secret npx tsx apps/api/src/scripts/mint-token.ts test_admin,release_manager alice
 */
import { SignJWT } from 'jose';

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('Set JWT_SECRET');
  process.exit(1);
}

const roles = (process.argv[2] || 'test_engineer').split(',').map((r) => r.trim());
const sub = process.argv[3] || 'dev-user';

const token = await new SignJWT({ roles })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(sub)
  .setIssuedAt()
  .setExpirationTime('8h')
  .sign(new TextEncoder().encode(secret));

console.log(token);
console.error(`# sub=${sub} roles=${roles.join(',')} expires=8h`);
console.error(`# curl -H "Authorization: Bearer ${token.slice(0, 16)}…" http://localhost:8787/api/v1/dashboard`);
