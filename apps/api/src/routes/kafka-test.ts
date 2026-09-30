/**
 * Kafka test menu: the two on-demand tests (Schedule → Kafka, Data feeder → Kafka), what each
 * checks, where the systems they need stand right now, and the evidence of past runs.
 *
 * Running a test is not done here: the menu posts to POST /api/v1/sit-runs {files:[...]}, the
 * same path as every other on-demand SIT run, so a Kafka test is queued, logged (kit-log) and
 * recorded like any other. Evidence files are written by the tests themselves into
 * EVIDENCE_DIR/kafka-test, the volume shared by the engine's processes.
 */
import type { FastifyInstance } from 'fastify';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KAFKA_TEST_CASES } from '../../../../sit/kafka-test/plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const casesDir = path.join(root, 'sit/cases');

const evidenceDir = () => path.join(process.env.EVIDENCE_DIR || path.resolve(process.cwd(), 'evidence'), 'kafka-test');
const trim = (u: string) => u.replace(/\/$/, '');
const sandBenchBase = () => trim(process.env.SIT_API_BASE || 'http://host.docker.internal:8787');
const deskBase = () => trim(process.env.SIT_KAFKA_DESK_BASE || 'http://kafka-desk:8095');
const sitBase = () => trim(process.env.SIT_CONSOLE_BASE || process.env.SIT_CONSOLE_URL || 'http://127.0.0.1:8098');

type CaseDef = { key: string; file: string; title: string; summary: string; checkpoints: Array<{ id: string; system: string; title: string }> };
type Evidence = {
  case: string; title: string; runId: string; result: string; startedAt: string; finishedAt: string | null; error: string | null;
  checkpoints: Array<{ id: string; system: string; title: string; status: string; at: string; detail?: string }>;
  messages: unknown[]; environment?: Record<string, unknown>; sandBench?: Record<string, unknown>;
};

function testNameIn(file: string): string | null {
  const full = path.join(casesDir, file);
  if (!existsSync(full)) return null;
  const match = /\btest\(\s*"((?:[^"\\]|\\.)*)"/.exec(readFileSync(full, 'utf8'));
  return match ? match[1]!.replace(/\\"/g, '"') : null;
}

function readEvidence(file: string): Evidence | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Evidence;
  } catch {
    return null;
  }
}

function summarize(e: Evidence) {
  const passed = e.checkpoints.filter((c) => c.status === 'passed').length;
  const failed = e.checkpoints.filter((c) => c.status === 'failed').length;
  return {
    runId: e.runId, result: e.result, startedAt: e.startedAt, finishedAt: e.finishedAt, error: e.error,
    checkpoints: { passed, failed, total: e.checkpoints.length }, messages: e.messages.length,
  };
}

function listEvidence(caseKey?: string, limit = 30) {
  const dir = evidenceDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^[a-z0-9-]+\.json$/.test(name) && !name.startsWith('latest-'))
    .map((name) => ({ name, mtime: statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ name }) => ({ name, evidence: readEvidence(path.join(dir, name)) }))
    .filter((row): row is { name: string; evidence: Evidence } => Boolean(row.evidence) && (!caseKey || row.evidence!.case === caseKey))
    .slice(0, limit)
    .map(({ name, evidence }) => ({ name, case: evidence.case, ...summarize(evidence) }));
}

async function probe(url: string, headers: Record<string, string> = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });
    const body = await res.json().catch(() => null);
    return { url, ok: res.ok, status: res.status, ms: Date.now() - started, body };
  } catch (error) {
    return { url, ok: false, status: 0, ms: Date.now() - started, body: null, error: (error as Error).message };
  }
}

function deskHeaders(): Record<string, string> {
  const user = process.env.SIT_KAFKA_DESK_USER || '';
  return user ? { authorization: `Basic ${Buffer.from(`${user}:${process.env.SIT_KAFKA_DESK_PASS || ''}`).toString('base64')}` } : {};
}

export async function kafkaTestRoutes(app: FastifyInstance) {
  app.get('/api/v1/kafka-test', async (_req, reply) => {
    const cases = (KAFKA_TEST_CASES as CaseDef[]).map((def) => {
      const latestFile = path.join(evidenceDir(), `latest-${def.key}.json`);
      const latest = existsSync(latestFile) ? readEvidence(latestFile) : null;
      return {
        ...def,
        testName: testNameIn(def.file),
        onDisk: existsSync(path.join(casesDir, def.file)),
        latest: latest ? { ...summarize(latest), evidence: latest } : null,
      };
    });
    return reply.send({ data: { cases, evidenceDir: evidenceDir() } });
  });

  // Where the systems the tests depend on stand right now. Purely informational: the tests run their own preflight.
  app.get('/api/v1/kafka-test/status', async (_req, reply) => {
    const [ready, deskHealth, deskStatus, sit] = await Promise.all([
      probe(`${sandBenchBase()}/ready`),
      probe(`${deskBase()}/health`),
      probe(`${deskBase()}/app/status`, deskHeaders()),
      probe(`${sitBase()}/api/status`),
    ]);
    const configured: string[] = (ready.body as { delivery?: { configured?: string[] } } | null)?.delivery?.configured || [];
    const tap = (deskStatus.body as { tap?: { connected?: boolean; topics?: string[]; received?: number; lastError?: string | null } } | null)?.tap;
    return reply.send({
      data: {
        sandBench: { base: sandBenchBase(), reachable: ready.ok, kafkaDelivers: configured.includes('kafka'), configuredChannels: configured, status: ready.status, error: ready.error },
        kafkaDesk: { base: deskBase(), reachable: deskHealth.ok, consuming: Boolean(tap?.connected), topics: tap?.topics || [], received: tap?.received ?? 0, lastError: tap?.lastError ?? null, error: deskHealth.error },
        sitRunner: { base: sitBase(), reachable: sit.ok, running: Boolean((sit.body as { running?: boolean } | null)?.running) },
        ready: ready.ok && configured.includes('kafka') && deskHealth.ok && Boolean(tap?.connected) && sit.ok,
      },
    });
  });

  app.get('/api/v1/kafka-test/evidence', async (req, reply) => {
    const q = req.query as { case?: string; limit?: string };
    return reply.send({ data: listEvidence(q.case, Math.min(Number(q.limit) || 30, 100)) });
  });

  app.get<{ Params: { name: string } }>('/api/v1/kafka-test/evidence/:name', async (req, reply) => {
    const name = req.params.name;
    if (!/^[a-z0-9-]+\.json$/.test(name)) return reply.status(400).send({ error: 'Invalid evidence name' });
    const file = path.join(evidenceDir(), name);
    if (!existsSync(file)) return reply.status(404).send({ error: 'Evidence not found' });
    const evidence = readEvidence(file);
    if (!evidence) return reply.status(500).send({ error: 'Evidence file is not valid JSON' });
    return reply.send({ data: evidence });
  });
}
