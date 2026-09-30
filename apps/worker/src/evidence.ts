/**
 * Evidence capture for the execution worker.
 *
 * Every executed case must leave evidence behind: the control plane does not
 * count a result as passed/failed without it (apps/api/src/evidence-gate.ts).
 * Runners write artefacts into the local EVIDENCE_DIR; publishEvidence() then
 * uploads them to the control plane, so evidence outlives the worker and is
 * served from one place even when the worker runs on another machine.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const EVIDENCE_DIR = process.env.EVIDENCE_DIR || path.resolve(process.cwd(), 'evidence');

export interface EvidenceItem {
  type: string;
  storage_key: string;
  content_type?: string;
  size_bytes?: number;
  redacted?: boolean;
  metadata?: Record<string, unknown>;
}

const SECRET_KEY = /authorization|cookie|passw(or)?d|secret|token|api[-_]?key|x-worker-key|credential/i;
const MASK = '[REDACTED]';

/**
 * Values that must never reach an evidence file: anything a secret-named
 * variable holds (password, token captured by `save`, ...). Short values are
 * ignored so masking "1" or "on" does not shred unrelated text.
 */
export function secretValues(vars: Record<string, string> = {}): string[] {
  return Object.entries(vars)
    .filter(([k, v]) => SECRET_KEY.test(k) && typeof v === 'string' && v.length >= 6)
    .map(([, v]) => v);
}

export function redactText(text: string, secrets: string[] = []): string {
  let out = text;
  for (const s of secrets) out = out.split(s).join(MASK);
  return out.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/g, `$1${MASK}`);
}

/** Deep copy with secret-named keys masked and known secret values scrubbed from strings. */
export function redact(value: unknown, secrets: string[] = []): unknown {
  if (typeof value === 'string') return redactText(value, secrets);
  if (Array.isArray(value)) return value.map((v) => redact(v, secrets));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) && v !== null && v !== undefined && v !== '' ? MASK : redact(v, secrets);
    }
    return out;
  }
  return value;
}

/** Body as stored in evidence: JSON is redacted structurally, anything else as text; both are size-capped. */
export function redactBody(text: string | undefined, secrets: string[] = [], limit = 4000): unknown {
  if (text === undefined) return undefined;
  try {
    const parsed = redact(JSON.parse(text), secrets);
    const s = JSON.stringify(parsed);
    return s.length <= limit ? parsed : `${s.slice(0, limit)}… [truncated ${s.length - limit} chars]`;
  } catch {
    const s = redactText(text, secrets);
    return s.length <= limit ? s : `${s.slice(0, limit)}… [truncated ${s.length - limit} chars]`;
  }
}

/** Write one artefact into the local evidence dir. Returns null when the dir is not writable. */
export function writeEvidence(opts: {
  type: string;
  prefix: string;
  ext: string;
  content: Buffer | string;
  contentType: string;
  redacted?: boolean;
  metadata?: Record<string, unknown>;
}): EvidenceItem | null {
  try {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const name = `${opts.prefix}-${Date.now()}-${randomUUID().slice(0, 6)}.${opts.ext}`;
    const buf = typeof opts.content === 'string' ? Buffer.from(opts.content, 'utf8') : opts.content;
    writeFileSync(path.join(EVIDENCE_DIR, name), buf);
    return {
      type: opts.type,
      storage_key: `evidence/${name}`,
      content_type: opts.contentType,
      size_bytes: buf.length,
      redacted: opts.redacted ?? false,
      metadata: opts.metadata,
    };
  } catch (err) {
    console.warn('[evidence] write failed:', (err as Error).message);
    return null;
  }
}

export function writeJsonEvidence(
  type: string,
  prefix: string,
  body: unknown,
  metadata?: Record<string, unknown>
): EvidenceItem | null {
  return writeEvidence({
    type,
    prefix,
    ext: 'json',
    content: JSON.stringify(body, null, 2),
    contentType: 'application/json',
    redacted: true,
    metadata,
  });
}

/**
 * Evidence for runners that report through metrics/output rather than files
 * (performance → metric report, SIT → TAP log). Returns the runner's own
 * evidence untouched when it already produced some.
 */
export function ensureEvidence(
  result: { status: string; message: string; duration_ms: number; classification?: string | null; metrics?: Record<string, unknown>; evidence?: EvidenceItem[]; output?: string },
  ctx: { method: string; caseKey?: string; caseName?: string; target?: string; rules?: Record<string, unknown>; secrets?: string[] }
): EvidenceItem[] {
  const existing = (result.evidence || []).filter(Boolean);
  if (existing.length) return existing;
  if (result.status === 'skipped' || result.status === 'blocked') return [];

  const header = {
    case: ctx.caseKey,
    name: ctx.caseName,
    method: ctx.method,
    target: ctx.target,
    captured_at: new Date().toISOString(),
    status: result.status,
    duration_ms: result.duration_ms,
  };
  const out: EvidenceItem[] = [];

  if (typeof result.output === 'string' && result.output.trim()) {
    const log = writeEvidence({
      type: 'log',
      prefix: `${ctx.method}-output`,
      ext: 'log',
      content: redactText(result.output, ctx.secrets),
      contentType: 'text/plain',
      redacted: true,
      metadata: { case: ctx.caseKey },
    });
    if (log) out.push(log);
  }

  if (result.metrics && Object.keys(result.metrics).length) {
    const sla = (ctx.rules as { sla?: unknown } | undefined)?.sla;
    const report = writeJsonEvidence(
      'metric',
      `${ctx.method}-report`,
      redact({ ...header, message: result.message, classification: result.classification ?? null, sla, metrics: result.metrics }, ctx.secrets),
      { case: ctx.caseKey }
    );
    if (report) out.push(report);
  }
  return out;
}

export interface PublishContext {
  api: string;
  headers: Record<string, string>;
  executionId: string;
  caseKey?: string;
}

/**
 * Upload local artefacts to the control plane and return them re-keyed to the
 * server's storage. An artefact that cannot be read or uploaded is dropped —
 * claiming evidence the control plane cannot serve would defeat the gate.
 */
export async function publishEvidence(items: EvidenceItem[], ctx: PublishContext): Promise<EvidenceItem[]> {
  const published: EvidenceItem[] = [];
  for (const item of items) {
    const name = path.basename(String(item.storage_key || ''));
    const local = path.join(EVIDENCE_DIR, name);
    if (!name || !existsSync(local)) {
      console.warn(`[evidence] ${item.storage_key} missing locally — dropped`);
      continue;
    }
    try {
      const buf = readFileSync(local);
      const res = await fetch(`${ctx.api}/api/v1/evidence/upload`, {
        method: 'POST',
        headers: ctx.headers,
        body: JSON.stringify({
          execution_id: ctx.executionId,
          case_key: ctx.caseKey,
          name,
          evidence_type: item.type,
          content_type: item.content_type,
          content_base64: buf.toString('base64'),
          sha256: createHash('sha256').update(buf).digest('hex'),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { storage_key: string; size_bytes: number; sha256: string } };
      if (!res.ok || !body.data?.storage_key) throw new Error(`upload returned ${res.status}`);
      published.push({
        ...item,
        storage_key: body.data.storage_key,
        size_bytes: body.data.size_bytes,
        metadata: { ...(item.metadata || {}), sha256: body.data.sha256 },
      });
      // The engine holds the record now; the local copy was only scratch.
      rmSync(local, { force: true });
    } catch (err) {
      console.warn(`[evidence] upload of ${name} failed: ${(err as Error).message} — dropped`);
    }
  }
  return published;
}

/**
 * "No evidence, no run": proves the worker can write an artefact locally and
 * that the control plane stores and serves it, before any case is executed.
 */
export async function evidencePreflight(api: string, headers: Record<string, string>): Promise<{ ok: boolean; reason?: string }> {
  const probe = writeEvidence({
    type: 'log',
    prefix: 'probe',
    ext: 'txt',
    content: `evidence preflight ${new Date().toISOString()}`,
    contentType: 'text/plain',
  });
  if (!probe) return { ok: false, reason: `evidence dir ${EVIDENCE_DIR} is not writable` };
  const local = path.join(EVIDENCE_DIR, path.basename(probe.storage_key));
  try {
    const buf = readFileSync(local);
    const res = await fetch(`${api}/api/v1/evidence/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        probe: true,
        // One probe file per worker host on the engine, overwritten each time.
        name: `probe-${os.hostname().replace(/[^A-Za-z0-9._-]/g, '-') || 'worker'}.txt`,
        evidence_type: 'log',
        content_type: 'text/plain',
        content_base64: buf.toString('base64'),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { storage_key: string } };
    if (!res.ok || !body.data?.storage_key) return { ok: false, reason: `evidence store rejected the probe (HTTP ${res.status})` };
    const back = await fetch(`${api}/api/v1/evidence/file?key=${encodeURIComponent(body.data.storage_key)}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!back.ok) return { ok: false, reason: `evidence store cannot serve what it stored (HTTP ${back.status})` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `evidence store unreachable: ${(err as Error).message}` };
  } finally {
    rmSync(local, { force: true });
  }
}
