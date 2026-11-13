#!/usr/bin/env tsx
/**
 * Rebaseline the Sand Bench API surface sweep against a deployed build.
 *
 *   npx tsx scripts/sandbench-route-baseline.mts                 report only
 *   npx tsx scripts/sandbench-route-baseline.mts --write         also write the baseline file
 *
 *   --source <dir>   exported Sand Bench source of the deployed commit
 *                    (default: the staging export of the commit the engine has on record)
 *   --api <url>      the deployed API (default: the staging environment's api var)
 *   --env <key>      engine environment to read both from (default sand-bench-staging)
 *
 * What it does:
 *   1. Reads the route table out of the deployed commit's source (every
 *      app.get/post/put/patch/delete registration under apps/api/src).
 *   2. Asks the deployed API who may call each route, with the same harmless
 *      probe the catalogue case sends (unknown reference, empty body): first
 *      without signing in, then as an operator, then as the administrator.
 *      Writes are only ever probed WITHOUT a session — a signed-in empty write
 *      can reset configuration or create default records.
 *   3. Writes apps/api/src/catalog/sandbench-route-baseline.json: one row per
 *      route with who may call it. catalog/sandbench-api-coverage-cases.ts
 *      builds one case per row.
 *
 * What it does NOT do: decide what a correct answer is. The allowed statuses come
 * from the route's kind (apiCoverageExpectation in the catalogue), not from what
 * was observed. A route that answers outside its allowed set — a server error
 * above all — is listed under "needs review" and its case will fail until the
 * application or the documented exception is fixed. Nothing observed here is
 * ever copied into an expectation.
 *
 * Every probe is sent from a made-up client address (X-Forwarded-For), so the
 * unauthenticated sign-in / sign-up probes do not count against this machine.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiCoverageExpectation, apiCoverageProbePath, type RouteAccess, type RouteRow } from '../apps/api/src/catalog/sandbench-api-coverage-cases.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const engine = (process.env.TE_BASE || 'http://127.0.0.1:8797').replace(/\/$/, '');
const envKey = opt('env', 'sand-bench-staging')!;
const outFile = path.join(root, 'apps/api/src/catalog/sandbench-route-baseline.json');
const PROBE_ADDRESS = '198.18.254.1';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|mjs|js)$/.test(name) && !/\.test\.|\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

function routeTable(source: string): Array<{ method: Method; path: string }> {
  const seen = new Set<string>();
  for (const file of sourceFiles(path.join(source, 'apps/api/src'))) {
    const text = readFileSync(file, 'utf8');
    const re = /\bapp\.(get|post|put|patch|delete)\s*(?:<[^>(]*>)?\(\s*(["'`])([^"'`]+)\2/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) if (!m[3]!.includes('${')) seen.add(`${m[1]!.toUpperCase()} ${m[3]}`);
  }
  return [...seen].sort().map((line) => {
    const [method, p] = line.split(' ');
    return { method: method as Method, path: p! };
  });
}

async function main() {
  const envRes = await fetch(`${engine}/api/v1/environments/${encodeURIComponent(envKey)}`).catch(() => null);
  const env = envRes?.ok ? ((await envRes.json()) as any).data : null;
  const vars = (env?.config?.vars || {}) as Record<string, string>;
  const commit = String(env?.config?.deployment?.commit || '');
  const source = path.resolve(opt('source', commit ? path.join(root, `../${envKey}/src/${commit.slice(0, 12)}`) : '')!);
  const api = (opt('api', vars.api) || '').replace(/\/$/, '');
  if (!existsSync(path.join(source, 'apps/api/src'))) throw new Error(`Sand Bench source not found at ${source} (pass --source)`);
  if (!api) throw new Error('No API base (pass --api)');

  const send = async (method: string, url: string, token?: string, body?: unknown) => {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json', 'x-forwarded-for': PROBE_ADDRESS, ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      const text = await res.text().catch(() => '');
      return { status: res.status, text: text.slice(0, 200) };
    } catch (err) {
      return { status: 0, text: (err as Error).name === 'TimeoutError' ? 'no answer within 60s' : (err as Error).message };
    }
  };
  const signIn = async (username: string, password: string) => {
    const res = await fetch(`${api}/api/v1/session/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const body = (await res.json().catch(() => ({}))) as { token?: string };
    if (!res.ok || !body.token) throw new Error(`sign-in as ${username} returned HTTP ${res.status}`);
    return body.token;
  };
  // The last lane's operator: the one a running suite is least likely to be using right now.
  const laneCount = Object.keys(vars).filter((k) => /^pool_user_\d+$/.test(k)).length;
  const operatorName = laneCount ? vars[`pool_user_${laneCount - 1}`]! : vars.username || 'operator';
  const operatorPass = laneCount ? vars[`pool_pass_${laneCount - 1}`] || vars.password || '' : vars.password || '';
  const operator = await signIn(operatorName, operatorPass);
  const admin = await signIn(vars.admin_username || 'admin', vars.admin_password || 'password');

  const routes = routeTable(source);
  const rows: RouteRow[] = [];
  const review: string[] = [];
  const refused = (s: number) => s === 401 || s === 403;

  for (const r of routes) {
    const url = `${api}${apiCoverageProbePath(r.method, r.path)}`;
    const anonymous = await send(r.method, url, undefined, r.method === 'GET' || r.method === 'DELETE' ? undefined : {});
    let access: RouteAccess;
    let seen = anonymous;
    if (r.method !== 'GET') {
      // Writes: only the sign-in boundary is probed.
      access = anonymous.status === 401 ? 'signed-in' : 'public';
    } else if (!refused(anonymous.status)) {
      access = 'public';
    } else {
      const asOperator = await send('GET', url, operator);
      if (!refused(asOperator.status)) { access = 'operator'; seen = asOperator; }
      else {
        const asAdmin = await send('GET', url, admin);
        seen = asAdmin;
        access = refused(asAdmin.status) ? 'nobody' : 'admin';
      }
    }
    const row: RouteRow = { method: r.method, path: r.path, access };
    rows.push(row);
    const allowed = apiCoverageExpectation(row).statuses;
    // The sign-in route's own case sends real credentials; this probe's empty body says nothing about it.
    const probedAsItsCaseDoes = !(r.method === 'POST' && r.path === '/api/v1/session/login');
    if (probedAsItsCaseDoes && !allowed.includes(seen.status)) {
      review.push(`${r.method} ${r.path}  [${access}] answered ${seen.status || 'nothing'}, allowed ${allowed.join('/')}  ${seen.text.replace(/\s+/g, ' ').slice(0, 140)}`);
    }
  }
  // The probes above are this tool's own sessions; end the operator's (it is a lane identity
  // nothing else is using right now). The administrator's is left: signing it out would end
  // every administrator session, including a running worker's.
  await send('POST', `${api}/api/v1/session/logout`, operator, {});

  const count = (a: RouteAccess) => rows.filter((r) => r.access === a).length;
  console.log(`source ${source}`);
  console.log(`api    ${api}`);
  console.log(`routes ${rows.length}: public ${count('public')}, operator ${count('operator')}, admin ${count('admin')}, signed-in writes ${count('signed-in')}, nobody ${count('nobody')}`);
  console.log(`\nneeds review (${review.length}) — answered outside the allowed statuses for its kind:`);
  for (const line of review) console.log(`  ${line}`);

  if (args.includes('--write')) {
    writeFileSync(outFile, `${JSON.stringify({
      note: 'Generated by scripts/sandbench-route-baseline.mts from the deployed commit. Do not edit by hand: rerun the script after a deploy.',
      source_commit: commit || path.basename(source),
      routes: rows,
    }, null, 1)}\n`);
    console.log(`\nwrote ${path.relative(root, outFile)}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
